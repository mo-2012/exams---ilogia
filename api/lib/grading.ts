import { and, eq, inArray } from "drizzle-orm";
import {
  examAnswers,
  examAttempts,
  questionOptions,
  questions,
  type Exam,
  type ExamAttempt,
  type Question,
  type QuestionOption,
} from "@db/schema";
import { getDb } from "../queries/connection";

/** Grace window after the server deadline during which a late (auto) submit is
 *  still accepted and marked as "expired" rather than rejected outright. */
export const SUBMIT_GRACE_MS = 90_000;

export type GradeOutcome = {
  isCorrect: boolean | null; // null => pending manual grading
  marksAwarded: number | null;
};

/** Grade one objective question against its saved answer. Text questions are
 *  never auto-graded — they stay pending for a human reviewer. */
export function gradeAnswer(
  question: Question,
  options: QuestionOption[],
  selectedIds: number[] | null | undefined,
  exam: Exam,
): GradeOutcome {
  if (question.type === "text") {
    return { isCorrect: null, marksAwarded: null };
  }
  const correctIds = options.filter((o) => o.isCorrect).map((o) => o.id);
  const selected = new Set(selectedIds ?? []);
  if (selected.size === 0) {
    return { isCorrect: false, marksAwarded: 0 };
  }
  const correctPicks = correctIds.filter((id) => selected.has(id)).length;
  const wrongPicks = [...selected].filter((id) => !correctIds.includes(id)).length;

  if (question.type === "mcq_multi") {
    if (exam.multiSelectScoring === "partial") {
      const per = question.marks / Math.max(correctIds.length, 1);
      const marks = Math.max(0, (correctPicks - wrongPicks) * per);
      const full = wrongPicks === 0 && correctPicks === correctIds.length;
      return {
        isCorrect: full,
        marksAwarded: Math.round(marks * 100) / 100,
      };
    }
    // all_or_nothing
    const full = wrongPicks === 0 && correctPicks === correctIds.length;
    return { isCorrect: full, marksAwarded: full ? question.marks : 0 };
  }

  // mcq_single / true_false: exactly one correct option
  const full =
    selected.size === 1 && correctIds.length === 1 && selected.has(correctIds[0]);
  return { isCorrect: full, marksAwarded: full ? question.marks : 0 };
}

/** Finalize an attempt: grade every answer server-side, persist per-question
 *  results, and roll up totals onto the attempt. Idempotent. */
export async function finalizeAttempt(
  attempt: ExamAttempt,
  exam: Exam,
  finalStatus: "submitted" | "expired",
) {
  const db = getDb();
  if (attempt.status !== "in_progress") return attempt;

  const qs = await db
    .select()
    .from(questions)
    .where(eq(questions.examId, attempt.examId))
    .orderBy(questions.sortOrder);
  const qIds = qs.map((q) => q.id);
  const opts = qIds.length
    ? await db
        .select()
        .from(questionOptions)
        .where(inArray(questionOptions.questionId, qIds))
    : [];
  const saved = await db
    .select()
    .from(examAnswers)
    .where(eq(examAnswers.attemptId, attempt.id));
  const savedByQ = new Map(saved.map((a) => [a.questionId, a]));

  let score = 0;
  let maxScore = 0;
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  let pending = 0;
  const now = new Date();

  for (const q of qs) {
    maxScore += q.marks;
    const ans = savedByQ.get(q.id);
    const hasResponse =
      q.type === "text"
        ? !!(ans?.textAnswer && ans.textAnswer.trim().length > 0)
        : (ans?.selectedOptionIds?.length ?? 0) > 0;

    if (!hasResponse) {
      unanswered += 1;
      continue;
    }
    const qOpts = opts.filter((o) => o.questionId === q.id);
    const outcome = gradeAnswer(q, qOpts, ans?.selectedOptionIds, exam);

    if (outcome.isCorrect === null) {
      pending += 1;
    } else if (outcome.isCorrect) {
      correct += 1;
    } else {
      incorrect += 1;
    }
    score += outcome.marksAwarded ?? 0;

    await db
      .update(examAnswers)
      .set({ isCorrect: outcome.isCorrect, marksAwarded: outcome.marksAwarded })
      .where(
        and(
          eq(examAnswers.attemptId, attempt.id),
          eq(examAnswers.questionId, q.id),
        ),
      );
  }

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 1000) / 10 : 0;
  const passed =
    exam.passingScore == null ? null : percentage >= exam.passingScore;
  const timeUsed = Math.max(
    0,
    Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000),
  );

  await db
    .update(examAttempts)
    .set({
      status: finalStatus,
      submittedAt: now,
      score: Math.round(score * 100) / 100,
      maxScore,
      percentage,
      passed,
      correctCount: correct,
      incorrectCount: incorrect,
      unansweredCount: unanswered,
      pendingGradingCount: pending,
      timeUsedSeconds: Math.min(
        timeUsed,
        Math.round((attempt.deadlineAt.getTime() - attempt.startedAt.getTime()) / 1000),
      ),
    })
    .where(eq(examAttempts.id, attempt.id));

  const [fresh] = await db
    .select()
    .from(examAttempts)
    .where(eq(examAttempts.id, attempt.id))
    .limit(1);
  return fresh;
}
