import { trpc } from "@/providers/trpc";
import { EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  attemptStatusLabel,
  formatDateTime,
  formatTimeUsed,
  questionTypeLabel,
} from "@/lib/labels";
import {
  ArrowRight,
  CheckCircle2,
  MinusCircle,
  PenLine,
  Save,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";

export default function AdminAttempt() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const id = Number(attemptId);
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.admin.attemptReview.useQuery(
    { attemptId: id },
    { retry: false, enabled: Number.isFinite(id) },
  );
  const [gradeInputs, setGradeInputs] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  const grade = trpc.admin.gradeTextAnswer.useMutation({
    onSuccess: () => {
      utils.admin.attemptReview.invalidate({ attemptId: id });
      utils.admin.examAttempts.invalidate();
      utils.admin.overview.invalidate();
    },
    onError: (e) => setError(e.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }
  if (!data) {
    return (
      <EmptyState
        title="المحاولة غير موجودة"
        action={<Button variant="outline" onClick={() => navigate("/admin")}>العودة للوحة الإدارة</Button>}
      />
    );
  }

  const { attempt, student, exam, questions } = data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/exams/${exam.id}`)}>
          <ArrowRight className="me-1 h-4 w-4" aria-hidden />
          {exam.title}
        </Button>
      </div>

      <div className="ilo-card p-6">
        <h1 className="text-xl">مراجعة محاولة — {student.name || "طالب"}</h1>
        <p className="text-sm text-muted-foreground" dir="ltr">{student.email}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">الحالة</dt>
            <dd className="font-semibold">{attemptStatusLabel[attempt.status]}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">الدرجة</dt>
            <dd className="font-semibold tabular-nums">
              {attempt.score ?? "—"} / {attempt.maxScore ?? "—"} ({Math.round(attempt.percentage ?? 0)}%)
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">الوقت المستغرق</dt>
            <dd className="font-semibold">{formatTimeUsed(attempt.timeUsedSeconds)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">التسليم</dt>
            <dd className="font-semibold">{formatDateTime(attempt.submittedAt)}</dd>
          </div>
        </dl>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-[hsl(var(--ilo-err-bg))] p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="space-y-4">
        {questions.map((q, i) => {
          const a = q.answer;
          const isPendingText = q.type === "text" && !!a?.textAnswer?.trim() && a.isCorrect == null;
          return (
            <article key={q.id} className="ilo-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-[hsl(var(--ilo-primary-c))]">
                  السؤال {i + 1}
                </span>
                <span className="ilo-pill bg-secondary text-secondary-foreground">
                  {questionTypeLabel[q.type]}
                </span>
                <span className="ilo-pill bg-[hsl(var(--ilo-gold-t))] text-[hsl(var(--ilo-gold-d))]">
                  {q.marks} {q.marks === 1 ? "درجة" : "درجات"}
                </span>
                {a == null || (q.type !== "text" && !(a.selectedOptionIds?.length)) || (q.type === "text" && !a.textAnswer?.trim()) ? (
                  <span className="ilo-pill bg-secondary text-muted-foreground">
                    <MinusCircle className="h-3.5 w-3.5" aria-hidden />
                    بلا إجابة
                  </span>
                ) : a.isCorrect === true ? (
                  <span className="ilo-pill bg-[hsl(var(--ilo-ok-bg))] text-[hsl(var(--ilo-primary-d))]">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    صحيحة · {a.marksAwarded}/{q.marks}
                  </span>
                ) : a.isCorrect === false ? (
                  <span className="ilo-pill bg-[hsl(var(--ilo-err-bg))] text-destructive">
                    <XCircle className="h-3.5 w-3.5" aria-hidden />
                    خاطئة · {a.marksAwarded ?? 0}/{q.marks}
                  </span>
                ) : (
                  <span className="ilo-pill bg-[hsl(var(--ilo-gold-t))] text-[hsl(var(--ilo-gold-d))]">
                    <PenLine className="h-3.5 w-3.5" aria-hidden />
                    بانتظار التصحيح
                  </span>
                )}
              </div>

              <p className="mt-3 leading-relaxed">{q.text}</p>

              {q.type === "text" ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg border bg-secondary/50 p-4">
                    <p className="text-xs font-semibold text-muted-foreground">إجابة الطالب:</p>
                    <p className="mt-1 whitespace-pre-line text-sm">{a?.textAnswer?.trim() || "— لم يُجب —"}</p>
                  </div>
                  {q.explanation && (
                    <p className="text-sm text-muted-foreground">
                      <strong>إرشاد التصحيح:</strong> {q.explanation}
                    </p>
                  )}
                  {a?.textAnswer?.trim() && (
                    <form
                      className="flex flex-wrap items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const raw = gradeInputs[q.id];
                        const marks = Number(raw);
                        if (raw == null || raw === "" || Number.isNaN(marks) || marks < 0 || marks > q.marks) {
                          setError(`أدخل درجة بين 0 و ${q.marks} للسؤال ${i + 1}`);
                          return;
                        }
                        setError(null);
                        grade.mutate({ attemptId: id, questionId: q.id, marksAwarded: marks });
                      }}
                    >
                      <label htmlFor={`grade-${q.id}`} className="text-sm font-medium">
                        الدرجة (من {q.marks}):
                      </label>
                      <Input
                        id={`grade-${q.id}`}
                        type="number"
                        min={0}
                        max={q.marks}
                        step={0.5}
                        className="w-24"
                        value={gradeInputs[q.id] ?? (a.marksAwarded != null ? String(a.marksAwarded) : "")}
                        onChange={(e) => setGradeInputs((p) => ({ ...p, [q.id]: e.target.value }))}
                        required
                      />
                      <Button size="sm" type="submit" disabled={grade.isPending}>
                        <Save className="me-1 h-4 w-4" aria-hidden />
                        {isPendingText ? "اعتماد الدرجة" : "تحديث الدرجة"}
                      </Button>
                    </form>
                  )}
                </div>
              ) : (
                <ul className="mt-4 space-y-2">
                  {q.options.map((opt) => {
                    const picked = a?.selectedOptionIds?.includes(opt.id);
                    return (
                      <li
                        key={opt.id}
                        className={cn(
                          "ilo-option cursor-default",
                        )}
                        data-correct={opt.isCorrect || undefined}
                        data-wrong={picked && !opt.isCorrect || undefined}
                      >
                        <span className="mt-0.5 shrink-0" aria-hidden>
                          {opt.isCorrect ? (
                            <CheckCircle2 className="h-5 w-5 text-[hsl(var(--ilo-primary-c))]" />
                          ) : picked ? (
                            <XCircle className="h-5 w-5 text-destructive" />
                          ) : (
                            <span className="block h-5 w-5 rounded-full border border-muted-foreground/30" />
                          )}
                        </span>
                        <span className="text-sm">
                          {opt.text}
                          {picked && <span className="ms-2 text-xs text-muted-foreground">(اختيار الطالب)</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
