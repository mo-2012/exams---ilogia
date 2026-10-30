import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  examAnswers,
  examAttempts,
  exams,
  questionOptions,
  questions,
  subjects,
  topics,
  users,
} from "@db/schema";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";

const examInput = z.object({
  subjectId: z.number().int().positive(),
  topicId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(3).max(255),
  description: z.string().max(5000).nullable().optional(),
  instructions: z.string().max(5000).nullable().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  durationMinutes: z.number().int().min(1).max(600),
  passingScore: z.number().int().min(0).max(100).nullable().optional(),
  maxAttempts: z.number().int().min(1).max(20).default(1),
  startsAt: z.date().nullable().optional(),
  endsAt: z.date().nullable().optional(),
  reviewPolicy: z.enum(["immediate", "after_close", "never"]).default("after_close"),
  multiSelectScoring: z.enum(["all_or_nothing", "partial"]).default("all_or_nothing"),
});

const optionInput = z.object({
  id: z.number().int().positive().optional(),
  text: z.string().trim().min(1).max(2000),
  isCorrect: z.boolean(),
  sortOrder: z.number().int().min(0).default(0),
});

const questionInput = z.object({
  id: z.number().int().positive().optional(),
  examId: z.number().int().positive(),
  topicId: z.number().int().positive().nullable().optional(),
  type: z.enum(["mcq_single", "mcq_multi", "true_false", "text"]),
  text: z.string().trim().min(1).max(10_000),
  explanation: z.string().max(5000).nullable().optional(),
  imageUrl: z.string().url().max(2000).nullable().optional(),
  marks: z.number().min(0.5).max(100),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  sortOrder: z.number().int().min(0).default(0),
  options: z.array(optionInput).max(20).default([]),
});

async function examOrThrow(examId: number) {
  const db = getDb();
  const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam) throw new TRPCError({ code: "NOT_FOUND", message: "الاختبار غير موجود" });
  return exam;
}

function validateQuestion(q: z.infer<typeof questionInput>) {
  if (q.type === "text") return;
  if (q.type === "true_false") {
    const correct = q.options.filter((o) => o.isCorrect).length;
    if (q.options.length !== 2 || correct !== 1) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "سؤال صح/خطأ يجب أن يحتوي خيارين فقط وأحدهما صحيح",
      });
    }
    return;
  }
  if (q.options.length < 2) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "أضف خيارين على الأقل" });
  }
  const correct = q.options.filter((o) => o.isCorrect).length;
  if (q.type === "mcq_single" && correct !== 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "سؤال الاختيار الواحد يجب أن يحتوي إجابة صحيحة واحدة فقط",
    });
  }
  if (q.type === "mcq_multi" && correct < 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "حدد إجابة صحيحة واحدة على الأقل",
    });
  }
}

export const adminRouter = createRouter({
  // ---- overview -----------------------------------------------------------
  overview: adminQuery.query(async () => {
    const db = getDb();
    const [examCount] = await db
      .select({ n: sql<number>`count(*)` })
      .from(exams);
    const [questionCount] = await db
      .select({ n: sql<number>`count(*)` })
      .from(questions);
    const [attemptCount] = await db
      .select({ n: sql<number>`count(*)` })
      .from(examAttempts);
    const [studentCount] = await db
      .select({ n: sql<number>`count(*)` })
      .from(users);
    const [pendingGrading] = await db
      .select({ n: sql<number>`count(*)` })
      .from(examAnswers)
      .where(
        and(
          isNull(examAnswers.isCorrect),
          sql`${examAnswers.textAnswer} is not null and ${examAnswers.textAnswer} != ''`,
        ),
      );
    return {
      exams: Number(examCount?.n ?? 0),
      questions: Number(questionCount?.n ?? 0),
      attempts: Number(attemptCount?.n ?? 0),
      students: Number(studentCount?.n ?? 0),
      pendingGrading: Number(pendingGrading?.n ?? 0),
    };
  }),

  // ---- subjects & topics ----------------------------------------------------
  createSubject: adminQuery
    .input(z.object({ nameAr: z.string().trim().min(2).max(255), nameEn: z.string().max(255).optional(), icon: z.string().max(64).optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [row] = await db.insert(subjects).values(input).$returningId();
      return { id: row.id };
    }),

  createTopic: adminQuery
    .input(z.object({ subjectId: z.number().int().positive(), nameAr: z.string().trim().min(2).max(255), nameEn: z.string().max(255).optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [row] = await db.insert(topics).values(input).$returningId();
      return { id: row.id };
    }),

  // ---- exams ----------------------------------------------------------------
  listExams: adminQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({ exam: exams, subject: subjects })
      .from(exams)
      .innerJoin(subjects, eq(exams.subjectId, subjects.id))
      .orderBy(desc(exams.updatedAt));
    const qCounts = await db
      .select({ examId: questions.examId, n: sql<number>`count(*)`, marks: sql<number>`coalesce(sum(${questions.marks}),0)` })
      .from(questions)
      .groupBy(questions.examId);
    const aCounts = await db
      .select({ examId: examAttempts.examId, n: sql<number>`count(*)` })
      .from(examAttempts)
      .groupBy(examAttempts.examId);
    const qBy = new Map(qCounts.map((c) => [c.examId, c]));
    const aBy = new Map(aCounts.map((c) => [c.examId, c]));
    return rows.map(({ exam, subject }) => ({
      ...exam,
      subject,
      questionCount: Number(qBy.get(exam.id)?.n ?? 0),
      totalMarks: Number(qBy.get(exam.id)?.marks ?? 0),
      attemptCount: Number(aBy.get(exam.id)?.n ?? 0),
    }));
  }),

  createExam: adminQuery.input(examInput).mutation(async ({ ctx, input }) => {
    const db = getDb();
    const [row] = await db
      .insert(exams)
      .values({ ...input, createdBy: ctx.user.id, status: "draft" })
      .$returningId();
    return { id: row.id };
  }),

  updateExam: adminQuery
    .input(z.object({ id: z.number().int().positive(), data: examInput }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await examOrThrow(input.id);
      await db.update(exams).set(input.data).where(eq(exams.id, input.id));
      return { ok: true };
    }),

  setExamStatus: adminQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["draft", "published", "closed"]),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await examOrThrow(input.id);
      if (input.status === "published") {
        const [c] = await db
          .select({ n: sql<number>`count(*)` })
          .from(questions)
          .where(eq(questions.examId, input.id));
        if (Number(c?.n ?? 0) === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "لا يمكن نشر اختبار بلا أسئلة",
          });
        }
      }
      await db.update(exams).set({ status: input.status }).where(eq(exams.id, input.id));
      return { ok: true };
    }),

  deleteExam: adminQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await examOrThrow(input.id);
      const [c] = await db
        .select({ n: sql<number>`count(*)` })
        .from(examAttempts)
        .where(eq(examAttempts.examId, input.id));
      if (Number(c?.n ?? 0) > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "لا يمكن حذف اختبار له محاولات مسجلة — أغلقه بدلًا من ذلك",
        });
      }
      const qs = await db.select({ id: questions.id }).from(questions).where(eq(questions.examId, input.id));
      if (qs.length) {
        await db.delete(questionOptions).where(inArray(questionOptions.questionId, qs.map((q) => q.id)));
        await db.delete(questions).where(eq(questions.examId, input.id));
      }
      await db.delete(exams).where(eq(exams.id, input.id));
      return { ok: true };
    }),

  // ---- questions --------------------------------------------------------------
  examDetail: adminQuery
    .input(z.object({ examId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const exam = await examOrThrow(input.examId);
      const qs = await db
        .select()
        .from(questions)
        .where(eq(questions.examId, exam.id))
        .orderBy(asc(questions.sortOrder));
      const qIds = qs.map((q) => q.id);
      const opts = qIds.length
        ? await db
            .select()
            .from(questionOptions)
            .where(inArray(questionOptions.questionId, qIds))
            .orderBy(asc(questionOptions.sortOrder))
        : [];
      return {
        exam,
        questions: qs.map((q) => ({
          ...q,
          options: opts.filter((o) => o.questionId === q.id),
        })),
      };
    }),

  upsertQuestion: adminQuery.input(questionInput).mutation(async ({ input }) => {
    const db = getDb();
    await examOrThrow(input.examId);
    validateQuestion(input);
    const { options: opts, id, ...data } = input;

    let questionId: number;
    if (id) {
      await db.update(questions).set(data).where(eq(questions.id, id));
      questionId = id;
      // replace options wholesale (question is only editable in full)
      await db.delete(questionOptions).where(eq(questionOptions.questionId, id));
    } else {
      const [row] = await db.insert(questions).values(data).$returningId();
      questionId = row.id;
    }
    if (opts.length) {
      await db.insert(questionOptions).values(
        opts.map((o, i) => ({
          questionId,
          text: o.text,
          isCorrect: o.isCorrect,
          sortOrder: o.sortOrder || i,
        })),
      );
    }
    return { id: questionId };
  }),

  deleteQuestion: adminQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [answered] = await db
        .select({ n: sql<number>`count(*)` })
        .from(examAnswers)
        .where(eq(examAnswers.questionId, input.id));
      if (Number(answered?.n ?? 0) > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "لا يمكن حذف سؤال أجاب عنه طلاب بالفعل — عدّل نصه بدلًا من ذلك",
        });
      }
      await db.delete(questionOptions).where(eq(questionOptions.questionId, input.id));
      await db.delete(questions).where(eq(questions.id, input.id));
      return { ok: true };
    }),

  reorderQuestions: adminQuery
    .input(
      z.object({
        examId: z.number().int().positive(),
        orderedIds: z.array(z.number().int().positive()).min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await examOrThrow(input.examId);
      await Promise.all(
        input.orderedIds.map((id, i) =>
          db
            .update(questions)
            .set({ sortOrder: i })
            .where(and(eq(questions.id, id), eq(questions.examId, input.examId))),
        ),
      );
      return { ok: true };
    }),

  // ---- results & manual grading -------------------------------------------------
  examAttempts: adminQuery
    .input(z.object({ examId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      await examOrThrow(input.examId);
      const rows = await db
        .select({ attempt: examAttempts, user: users })
        .from(examAttempts)
        .innerJoin(users, eq(examAttempts.userId, users.id))
        .where(eq(examAttempts.examId, input.examId))
        .orderBy(desc(examAttempts.startedAt));
      return rows.map(({ attempt, user }) => ({
        ...attempt,
        student: { id: user.id, name: user.name, email: user.email },
      }));
    }),

  attemptReview: adminQuery
    .input(z.object({ attemptId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select({ attempt: examAttempts, user: users })
        .from(examAttempts)
        .innerJoin(users, eq(examAttempts.userId, users.id))
        .where(eq(examAttempts.id, input.attemptId))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "المحاولة غير موجودة" });
      const exam = await examOrThrow(row.attempt.examId);
      const qs = await db
        .select()
        .from(questions)
        .where(eq(questions.examId, exam.id))
        .orderBy(asc(questions.sortOrder));
      const qIds = qs.map((q) => q.id);
      const opts = qIds.length
        ? await db
            .select()
            .from(questionOptions)
            .where(inArray(questionOptions.questionId, qIds))
            .orderBy(asc(questionOptions.sortOrder))
        : [];
      const answers = await db
        .select()
        .from(examAnswers)
        .where(eq(examAnswers.attemptId, row.attempt.id));
      const byQ = new Map(answers.map((a) => [a.questionId, a]));
      return {
        attempt: row.attempt,
        student: { id: row.user.id, name: row.user.name, email: row.user.email },
        exam,
        questions: qs.map((q) => {
          const a = byQ.get(q.id);
          return {
            ...q,
            options: opts.filter((o) => o.questionId === q.id),
            answer: a ?? null,
          };
        }),
      };
    }),

  /** Manually grade a text answer, then re-roll the attempt totals. */
  gradeTextAnswer: adminQuery
    .input(
      z.object({
        attemptId: z.number().int().positive(),
        questionId: z.number().int().positive(),
        marksAwarded: z.number().min(0).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [attempt] = await db
        .select()
        .from(examAttempts)
        .where(eq(examAttempts.id, input.attemptId))
        .limit(1);
      if (!attempt) throw new TRPCError({ code: "NOT_FOUND", message: "المحاولة غير موجودة" });
      if (attempt.status === "in_progress") {
        throw new TRPCError({ code: "CONFLICT", message: "المحاولة ما زالت جارية" });
      }
      const [q] = await db
        .select()
        .from(questions)
        .where(and(eq(questions.id, input.questionId), eq(questions.examId, attempt.examId)))
        .limit(1);
      if (!q || q.type !== "text") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "هذا السؤال ليس سؤالًا مقاليًا" });
      }
      const marks = Math.min(input.marksAwarded, q.marks);
      await db
        .update(examAnswers)
        .set({
          marksAwarded: marks,
          isCorrect: marks >= q.marks / 2,
          gradedBy: ctx.user.id,
        })
        .where(
          and(
            eq(examAnswers.attemptId, attempt.id),
            eq(examAnswers.questionId, q.id),
          ),
        );

      // recompute totals
      const exam = await examOrThrow(attempt.examId);
      const allAnswers = await db
        .select()
        .from(examAnswers)
        .where(eq(examAnswers.attemptId, attempt.id));
      const qs = await db.select().from(questions).where(eq(questions.examId, exam.id));
      const byQ = new Map(allAnswers.map((a) => [a.questionId, a]));
      let score = 0;
      let correct = 0;
      let incorrect = 0;
      let unanswered = 0;
      let pending = 0;
      for (const question of qs) {
        const a = byQ.get(question.id);
        const has =
          question.type === "text"
            ? !!(a?.textAnswer && a.textAnswer.trim())
            : (a?.selectedOptionIds?.length ?? 0) > 0;
        if (!has) {
          unanswered += 1;
          continue;
        }
        if (a?.isCorrect == null) {
          pending += 1;
          continue;
        }
        if (a.isCorrect) correct += 1;
        else incorrect += 1;
        score += a.marksAwarded ?? 0;
      }
      const maxScore = qs.reduce((s, question) => s + question.marks, 0);
      const percentage = maxScore > 0 ? Math.round((score / maxScore) * 1000) / 10 : 0;
      await db
        .update(examAttempts)
        .set({
          score: Math.round(score * 100) / 100,
          maxScore,
          percentage,
          passed: exam.passingScore == null ? null : percentage >= exam.passingScore,
          correctCount: correct,
          incorrectCount: incorrect,
          unansweredCount: unanswered,
          pendingGradingCount: pending,
        })
        .where(eq(examAttempts.id, attempt.id));
      return { ok: true };
    }),
});
