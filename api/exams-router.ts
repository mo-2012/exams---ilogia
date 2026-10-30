import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  examAnswers,
  examAttempts,
  exams,
  questionOptions,
  questions,
  subjects,
  topics,
  type Exam,
  type ExamAttempt,
} from "@db/schema";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { finalizeAttempt, SUBMIT_GRACE_MS } from "./lib/grading";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

type ExamAvailability =
  | "available" // published, inside window, attempts remaining
  | "upcoming" // published, starts in the future
  | "in_progress" // the student has a live attempt
  | "completed" // no attempts remaining / already used
  | "closed"; // window passed or exam closed

function computeAvailability(
  exam: Exam,
  now: Date,
  attemptCount: number,
  hasLive: boolean,
): ExamAvailability {
  if (exam.status === "closed") return "closed";
  if (exam.endsAt && now > exam.endsAt) return "closed";
  if (exam.status !== "published") return "closed"; // drafts hidden anyway
  if (exam.startsAt && now < exam.startsAt) return "upcoming";
  if (hasLive) return "in_progress";
  if (attemptCount >= exam.maxAttempts) return "completed";
  return "available";
}

async function attemptsForUser(userId: number, examIds?: number[]) {
  const db = getDb();
  const conds = [eq(examAttempts.userId, userId)];
  if (examIds?.length) conds.push(inArray(examAttempts.examId, examIds));
  return db.select().from(examAttempts).where(and(...conds));
}

async function loadAttemptForUser(attemptId: number, userId: number) {
  const db = getDb();
  const [attempt] = await db
    .select()
    .from(examAttempts)
    .where(eq(examAttempts.id, attemptId))
    .limit(1);
  if (!attempt || attempt.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "المحاولة غير موجودة" });
  }
  const [exam] = await db
    .select()
    .from(exams)
    .where(eq(exams.id, attempt.examId))
    .limit(1);
  if (!exam) throw new TRPCError({ code: "NOT_FOUND", message: "الاختبار غير موجود" });
  return { attempt, exam };
}

/** Lazily expire a live attempt whose server deadline has passed. */
async function ensureNotExpired(attempt: ExamAttempt, exam: Exam) {
  if (attempt.status === "in_progress" && new Date() > attempt.deadlineAt) {
    return finalizeAttempt(attempt, exam, "expired");
  }
  return attempt;
}

function reviewAllowed(exam: Exam, now: Date) {
  if (exam.reviewPolicy === "immediate") return true;
  if (exam.reviewPolicy === "never") return false;
  // after_close
  return exam.status === "closed" || (exam.endsAt != null && now > exam.endsAt);
}

// ---------------------------------------------------------------------------
// router
// ---------------------------------------------------------------------------

export const examsRouter = createRouter({
  // ---- catalogue ----------------------------------------------------------
  subjects: authedQuery.query(async () => {
    const db = getDb();
    const subs = await db.select().from(subjects).orderBy(subjects.sortOrder);
    const tops = await db.select().from(topics).orderBy(topics.sortOrder);
    return { subjects: subs, topics: tops };
  }),

  // ---- exam listing -------------------------------------------------------
  list: authedQuery
    .input(
      z
        .object({
          search: z.string().trim().max(120).optional(),
          subjectId: z.number().int().positive().optional(),
          topicId: z.number().int().positive().optional(),
          difficulty: z.enum(["easy", "medium", "hard"]).optional(),
          status: z
            .enum(["available", "upcoming", "in_progress", "completed", "closed"])
            .optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const now = new Date();
      const rows = await db
        .select({ exam: exams, subject: subjects, topic: topics })
        .from(exams)
        .innerJoin(subjects, eq(exams.subjectId, subjects.id))
        .leftJoin(topics, eq(exams.topicId, topics.id))
        .where(inArray(exams.status, ["published", "closed"]));

      const myAttempts = await attemptsForUser(ctx.user.id);
      const byExam = new Map<number, ExamAttempt[]>();
      for (const a of myAttempts) {
        const list = byExam.get(a.examId) ?? [];
        list.push(a);
        byExam.set(a.examId, list);
      }
      const qCounts = await db
        .select({ examId: questions.examId, n: sql<number>`count(*)`, marks: sql<number>`coalesce(sum(${questions.marks}),0)` })
        .from(questions)
        .groupBy(questions.examId);
      const countByExam = new Map(qCounts.map((c) => [c.examId, c]));

      let out = rows.map(({ exam, subject, topic }) => {
        const mine = byExam.get(exam.id) ?? [];
        const live = mine.some((a) => a.status === "in_progress");
        const availability = computeAvailability(exam, now, mine.length, live);
        const best = mine
          .filter((a) => a.status !== "in_progress" && a.percentage != null)
          .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))[0];
        return {
          exam,
          subject,
          topic,
          availability,
          questionCount: Number(countByExam.get(exam.id)?.n ?? 0),
          totalMarks: Number(countByExam.get(exam.id)?.marks ?? 0),
          attemptsUsed: mine.length,
          liveAttemptId: mine.find((a) => a.status === "in_progress")?.id ?? null,
          bestPercentage: best?.percentage ?? null,
        };
      });

      const f = input ?? {};
      if (f.search) {
        const s = f.search.toLowerCase();
        out = out.filter(
          (r) =>
            r.exam.title.toLowerCase().includes(s) ||
            (r.exam.description ?? "").toLowerCase().includes(s),
        );
      }
      if (f.subjectId) out = out.filter((r) => r.exam.subjectId === f.subjectId);
      if (f.topicId) out = out.filter((r) => r.exam.topicId === f.topicId);
      if (f.difficulty) out = out.filter((r) => r.exam.difficulty === f.difficulty);
      if (f.status) out = out.filter((r) => r.availability === f.status);
      return out;
    }),

  // ---- exam details + eligibility ----------------------------------------
  byId: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const now = new Date();
      const [row] = await db
        .select({ exam: exams, subject: subjects, topic: topics })
        .from(exams)
        .innerJoin(subjects, eq(exams.subjectId, subjects.id))
        .leftJoin(topics, eq(exams.topicId, topics.id))
        .where(eq(exams.id, input.id))
        .limit(1);
      if (!row || row.exam.status === "draft") {
        throw new TRPCError({ code: "NOT_FOUND", message: "الاختبار غير موجود" });
      }
      const mine = await attemptsForUser(ctx.user.id, [row.exam.id]);
      const live = mine.find((a) => a.status === "in_progress") ?? null;
      const availability = computeAvailability(
        row.exam,
        now,
        mine.length,
        !!live,
      );
      const qs = await db
        .select({ marks: questions.marks })
        .from(questions)
        .where(eq(questions.examId, row.exam.id));
      return {
        ...row,
        availability,
        questionCount: qs.length,
        totalMarks: qs.reduce((s, q) => s + q.marks, 0),
        attemptsUsed: mine.length,
        liveAttemptId: live?.id ?? null,
        pastAttempts: mine
          .filter((a) => a.status !== "in_progress")
          .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0)),
      };
    }),

  // ---- start (or resume) an attempt --------------------------------------
  start: authedQuery
    .input(z.object({ examId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const now = new Date();
      const [exam] = await db
        .select()
        .from(exams)
        .where(eq(exams.id, input.examId))
        .limit(1);
      if (!exam || exam.status !== "published") {
        throw new TRPCError({ code: "NOT_FOUND", message: "الاختبار غير متاح" });
      }
      const mine = await attemptsForUser(ctx.user.id, [exam.id]);
      const live = mine.find((a) => a.status === "in_progress");
      if (live) {
        const current = await ensureNotExpired(live, exam);
        if (current.status === "in_progress") {
          return { attemptId: current.id, resumed: true };
        }
      }
      if (exam.startsAt && now < exam.startsAt) {
        throw new TRPCError({ code: "FORBIDDEN", message: "لم يبدأ موعد هذا الاختبار بعد" });
      }
      if (exam.endsAt && now > exam.endsAt) {
        throw new TRPCError({ code: "FORBIDDEN", message: "انتهى موعد هذا الاختبار" });
      }
      if (mine.length >= exam.maxAttempts) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "استنفدت عدد المحاولات المسموح بها لهذا الاختبار",
        });
      }
      const durationMs = exam.durationMinutes * 60_000;
      let deadline = new Date(now.getTime() + durationMs);
      if (exam.endsAt && deadline > exam.endsAt) deadline = exam.endsAt;
      if (deadline <= now) {
        throw new TRPCError({ code: "FORBIDDEN", message: "لم يعد هناك وقت متاح لهذا الاختبار" });
      }
      const [inserted] = await db
        .insert(examAttempts)
        .values({
          examId: exam.id,
          userId: ctx.user.id,
          startedAt: now,
          deadlineAt: deadline,
        })
        .$returningId();
      return { attemptId: inserted.id, resumed: false };
    }),

  // ---- live attempt state (refresh recovery) ------------------------------
  attempt: authedQuery
    .input(z.object({ attemptId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const { attempt, exam } = await loadAttemptForUser(
        input.attemptId,
        ctx.user.id,
      );
      const current = await ensureNotExpired(attempt, exam);
      if (current.status !== "in_progress") {
        return { status: current.status as "submitted" | "expired", attemptId: current.id };
      }
      const qs = await db
        .select()
        .from(questions)
        .where(eq(questions.examId, exam.id))
        .orderBy(questions.sortOrder);
      const qIds = qs.map((q) => q.id);
      const opts = qIds.length
        ? await db
            .select()
            .from(questionOptions)
            .where(inArray(questionOptions.questionId, qIds))
            .orderBy(questionOptions.sortOrder)
        : [];
      const saved = await db
        .select()
        .from(examAnswers)
        .where(eq(examAnswers.attemptId, current.id));
      return {
        status: "in_progress" as const,
        attemptId: current.id,
        exam: {
          id: exam.id,
          title: exam.title,
          instructions: exam.instructions,
          durationMinutes: exam.durationMinutes,
        },
        // the server clock + deadline drive the countdown; the browser never
        // decides when time is up, it only displays what the server says
        serverNow: new Date(),
        startedAt: current.startedAt,
        deadlineAt: current.deadlineAt,
        questions: qs.map((q) => ({
          id: q.id,
          type: q.type,
          text: q.text,
          imageUrl: q.imageUrl,
          marks: q.marks,
          options: opts
            .filter((o) => o.questionId === q.id)
            .map((o) => ({ id: o.id, text: o.text })), // isCorrect stays server-side
        })),
        answers: saved.map((a) => ({
          questionId: a.questionId,
          selectedOptionIds: a.selectedOptionIds ?? [],
          textAnswer: a.textAnswer ?? "",
        })),
      };
    }),

  // ---- persist one answer (autosave) --------------------------------------
  saveAnswer: authedQuery
    .input(
      z.object({
        attemptId: z.number().int().positive(),
        questionId: z.number().int().positive(),
        selectedOptionIds: z.array(z.number().int().positive()).max(50).optional(),
        textAnswer: z.string().max(10_000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { attempt, exam } = await loadAttemptForUser(
        input.attemptId,
        ctx.user.id,
      );
      const current = await ensureNotExpired(attempt, exam);
      if (current.status !== "in_progress") {
        throw new TRPCError({ code: "CONFLICT", message: "انتهى وقت هذه المحاولة" });
      }
      if (new Date() > current.deadlineAt) {
        throw new TRPCError({ code: "CONFLICT", message: "انتهى وقت هذه المحاولة" });
      }
      const [q] = await db
        .select()
        .from(questions)
        .where(
          and(eq(questions.id, input.questionId), eq(questions.examId, exam.id)),
        )
        .limit(1);
      if (!q) throw new TRPCError({ code: "NOT_FOUND", message: "السؤال غير موجود" });

      const selected =
        q.type === "text"
          ? null
          : (input.selectedOptionIds ?? []).slice(
              0,
              q.type === "mcq_multi" ? 50 : 1,
            );
      const textAnswer = q.type === "text" ? (input.textAnswer ?? "") : null;

      const existing = await db
        .select()
        .from(examAnswers)
        .where(
          and(
            eq(examAnswers.attemptId, current.id),
            eq(examAnswers.questionId, q.id),
          ),
        )
        .limit(1);
      if (existing.length) {
        await db
          .update(examAnswers)
          .set({ selectedOptionIds: selected, textAnswer })
          .where(eq(examAnswers.id, existing[0].id));
      } else {
        await db.insert(examAnswers).values({
          attemptId: current.id,
          questionId: q.id,
          selectedOptionIds: selected,
          textAnswer,
        });
      }
      return { ok: true, serverNow: new Date() };
    }),

  // ---- submit (idempotent, server-graded) ----------------------------------
  submit: authedQuery
    .input(z.object({ attemptId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { attempt, exam } = await loadAttemptForUser(
        input.attemptId,
        ctx.user.id,
      );
      if (attempt.status !== "in_progress") {
        // duplicate submission — return the already-finalized state
        return { attemptId: attempt.id, status: attempt.status, duplicate: true };
      }
      const now = new Date();
      const withinGrace =
        now.getTime() <= attempt.deadlineAt.getTime() + SUBMIT_GRACE_MS;
      const finalized = await finalizeAttempt(
        attempt,
        exam,
        withinGrace ? "submitted" : "expired",
      );
      return { attemptId: finalized.id, status: finalized.status, duplicate: false };
    }),

  // ---- result --------------------------------------------------------------
  result: authedQuery
    .input(z.object({ attemptId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const { attempt, exam } = await loadAttemptForUser(
        input.attemptId,
        ctx.user.id,
      );
      const current = await ensureNotExpired(attempt, exam);
      if (current.status === "in_progress") {
        throw new TRPCError({ code: "CONFLICT", message: "المحاولة ما زالت جارية" });
      }
      const now = new Date();
      const canReview = reviewAllowed(exam, now);

      const summary = {
        attempt: current,
        exam: {
          id: exam.id,
          title: exam.title,
          passingScore: exam.passingScore,
          reviewPolicy: exam.reviewPolicy,
          durationMinutes: exam.durationMinutes,
        },
        canReview,
        review: null as null | Array<{
          id: number;
          type: string;
          text: string;
          imageUrl: string | null;
          marks: number;
          explanation: string | null;
          selectedOptionIds: number[];
          textAnswer: string | null;
          isCorrect: boolean | null;
          marksAwarded: number | null;
          options: Array<{ id: number; text: string; isCorrect: boolean }>;
        }>,
      };
      if (!canReview) return summary;

      const qs = await db
        .select()
        .from(questions)
        .where(eq(questions.examId, exam.id))
        .orderBy(questions.sortOrder);
      const qIds = qs.map((q) => q.id);
      const opts = qIds.length
        ? await db
            .select()
            .from(questionOptions)
            .where(inArray(questionOptions.questionId, qIds))
            .orderBy(questionOptions.sortOrder)
        : [];
      const answers = await db
        .select()
        .from(examAnswers)
        .where(eq(examAnswers.attemptId, current.id));
      const byQ = new Map(answers.map((a) => [a.questionId, a]));
      summary.review = qs.map((q) => {
        const a = byQ.get(q.id);
        return {
          id: q.id,
          type: q.type,
          text: q.text,
          imageUrl: q.imageUrl,
          marks: q.marks,
          explanation: q.explanation,
          selectedOptionIds: a?.selectedOptionIds ?? [],
          textAnswer: a?.textAnswer ?? null,
          isCorrect: a?.isCorrect ?? null,
          marksAwarded: a?.marksAwarded ?? null,
          options: opts
            .filter((o) => o.questionId === q.id)
            .map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
        };
      });
      return summary;
    }),

  // ---- student dashboard ----------------------------------------------------
  dashboard: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const now = new Date();
    const rows = await db
      .select({ exam: exams, subject: subjects })
      .from(exams)
      .innerJoin(subjects, eq(exams.subjectId, subjects.id))
      .where(inArray(exams.status, ["published", "closed"]));
    const mine = await attemptsForUser(ctx.user.id);
    const byExam = new Map<number, ExamAttempt[]>();
    for (const a of mine) {
      const list = byExam.get(a.examId) ?? [];
      list.push(a);
      byExam.set(a.examId, list);
    }

    let available = 0;
    let upcoming = 0;
    const upcomingExams: Array<{ id: number; title: string; startsAt: Date | null; subject: string }> = [];
    const availableExams: Array<{ id: number; title: string; subject: string; difficulty: string; durationMinutes: number }> = [];

    for (const { exam, subject } of rows) {
      const list = byExam.get(exam.id) ?? [];
      const av = computeAvailability(
        exam,
        now,
        list.length,
        list.some((a) => a.status === "in_progress"),
      );
      if (av === "upcoming") {
        upcoming += 1;
        upcomingExams.push({ id: exam.id, title: exam.title, startsAt: exam.startsAt, subject: subject.nameAr });
      } else if (av === "available" || av === "in_progress") {
        available += 1;
        availableExams.push({
          id: exam.id,
          title: exam.title,
          subject: subject.nameAr,
          difficulty: exam.difficulty,
          durationMinutes: exam.durationMinutes,
        });
      }
    }

    const finished = mine
      .filter((a) => a.status !== "in_progress")
      .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0));
    const scored = finished.filter((a) => a.percentage != null);
    const avgPercentage = scored.length
      ? Math.round((scored.reduce((s, a) => s + (a.percentage ?? 0), 0) / scored.length) * 10) / 10
      : null;
    const passedCount = finished.filter((a) => a.passed === true).length;

    const examById = new Map(rows.map((r) => [r.exam.id, r]));
    const recentResults = finished.slice(0, 5).map((a) => ({
      attemptId: a.id,
      examId: a.examId,
      title: examById.get(a.examId)?.exam.title ?? "اختبار",
      subject: examById.get(a.examId)?.subject.nameAr ?? "",
      percentage: a.percentage,
      passed: a.passed,
      status: a.status,
      submittedAt: a.submittedAt,
    }));

    // per-subject progress from real attempts only
    const subjectAgg = new Map<string, { sum: number; n: number }>();
    for (const a of scored) {
      const name = examById.get(a.examId)?.subject.nameAr;
      if (!name) continue;
      const agg = subjectAgg.get(name) ?? { sum: 0, n: 0 };
      agg.sum += a.percentage ?? 0;
      agg.n += 1;
      subjectAgg.set(name, agg);
    }
    const subjectProgress = [...subjectAgg.entries()].map(([name, agg]) => ({
      subject: name,
      average: Math.round((agg.sum / agg.n) * 10) / 10,
      attempts: agg.n,
    }));

    return {
      counts: {
        available,
        upcoming,
        completed: finished.length,
        inProgress: mine.filter((a) => a.status === "in_progress").length,
        passed: passedCount,
      },
      avgPercentage,
      recentResults,
      subjectProgress,
      upcomingExams: upcomingExams
        .sort((a, b) => (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0))
        .slice(0, 5),
      availableExams: availableExams.slice(0, 6),
    };
  }),

  // ---- history ---------------------------------------------------------------
  history: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const mine = await attemptsForUser(ctx.user.id);
    if (!mine.length) return [];
    const examIds = [...new Set(mine.map((a) => a.examId))];
    const rows = await db
      .select({ exam: exams, subject: subjects })
      .from(exams)
      .innerJoin(subjects, eq(exams.subjectId, subjects.id))
      .where(inArray(exams.id, examIds));
    const examById = new Map(rows.map((r) => [r.exam.id, r]));
    return mine
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .map((a) => ({
        attempt: a,
        exam: examById.get(a.examId)?.exam ?? null,
        subject: examById.get(a.examId)?.subject ?? null,
        canReview: examById.get(a.examId)
          ? reviewAllowed(examById.get(a.examId)!.exam, new Date())
          : false,
      }));
  }),

  // ---- analytics (real attempt data only) --------------------------------------
  analytics: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const mine = (await attemptsForUser(ctx.user.id))
      .filter((a) => a.status !== "in_progress" && a.percentage != null)
      .sort((a, b) => (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0));
    if (!mine.length) return { empty: true as const };
    const examIds = [...new Set(mine.map((a) => a.examId))];
    const rows = await db
      .select({ exam: exams, subject: subjects })
      .from(exams)
      .innerJoin(subjects, eq(exams.subjectId, subjects.id))
      .where(inArray(exams.id, examIds));
    const examById = new Map(rows.map((r) => [r.exam.id, r]));

    const overall =
      Math.round(
        (mine.reduce((s, a) => s + (a.percentage ?? 0), 0) / mine.length) * 10,
      ) / 10;
    const best = mine.reduce((m, a) => ((a.percentage ?? 0) > (m.percentage ?? 0) ? a : m), mine[0]);

    const bySubject = new Map<string, { sum: number; n: number; best: number }>();
    const trend: Array<{ date: Date | null; percentage: number; title: string }> = [];
    for (const a of mine) {
      const meta = examById.get(a.examId);
      const name = meta?.subject.nameAr ?? "عام";
      const agg = bySubject.get(name) ?? { sum: 0, n: 0, best: 0 };
      agg.sum += a.percentage ?? 0;
      agg.n += 1;
      agg.best = Math.max(agg.best, a.percentage ?? 0);
      bySubject.set(name, agg);
      trend.push({
        date: a.submittedAt,
        percentage: a.percentage ?? 0,
        title: meta?.exam.title ?? "اختبار",
      });
    }
    const subjectPerformance = [...bySubject.entries()]
      .map(([subject, agg]) => ({
        subject,
        average: Math.round((agg.sum / agg.n) * 10) / 10,
        attempts: agg.n,
        best: agg.best,
      }))
      .sort((a, b) => b.average - a.average);

    return {
      empty: false as const,
      overall,
      totalAttempts: mine.length,
      passedCount: mine.filter((a) => a.passed === true).length,
      bestPercentage: best.percentage,
      subjectPerformance,
      strengths: subjectPerformance.filter((s) => s.average >= 75).map((s) => s.subject),
      improvements: subjectPerformance.filter((s) => s.average < 60).map((s) => s.subject),
      trend,
    };
  }),
});
