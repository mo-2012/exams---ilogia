import { trpc } from "@/providers/trpc";
import { EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  attemptStatusLabel,
  formatDateTime,
  formatTimeUsed,
  questionTypeLabel,
  reviewPolicyLabel,
} from "@/lib/labels";
import {
  Award,
  CheckCircle2,
  CircleHelp,
  Clock3,
  EyeOff,
  Home,
  Library,
  MinusCircle,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { useNavigate, useParams } from "react-router";

export default function Results() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const id = Number(attemptId);
  const navigate = useNavigate();

  const { data, isLoading, error } = trpc.exams.result.useQuery(
    { attemptId: id },
    { retry: false, enabled: Number.isFinite(id) },
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="تعذر عرض النتيجة"
        description={error?.message || "هذه المحاولة غير متاحة."}
        action={<Button variant="outline" onClick={() => navigate("/history")}>سجل اختباراتي</Button>}
      />
    );
  }

  const { attempt, exam, canReview, review } = data;
  const pct = attempt.percentage ?? 0;
  const passed = attempt.passed;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* score hero */}
      <div className="ilo-card overflow-hidden">
        <div
          className={cn(
            "p-6 text-center md:p-10",
            passed === false
              ? "bg-[hsl(var(--ilo-err-bg))]"
              : "bg-[hsl(var(--ilo-ok-bg))]",
          )}
        >
          {passed === true ? (
            <Award className="mx-auto h-12 w-12 text-[hsl(var(--ilo-gold-d))]" aria-hidden />
          ) : passed === false ? (
            <XCircle className="mx-auto h-12 w-12 text-destructive" aria-hidden />
          ) : (
            <CheckCircle2 className="mx-auto h-12 w-12 text-[hsl(var(--ilo-primary-c))]" aria-hidden />
          )}
          <h1 className="mt-3 text-2xl md:text-3xl">{exam.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {attemptStatusLabel[attempt.status]} · {formatDateTime(attempt.submittedAt)}
          </p>

          <div className="mt-6 flex items-end justify-center gap-2" dir="ltr">
            <span
              className={cn(
                "font-display text-6xl font-bold leading-none tabular-nums",
                passed === false ? "text-destructive" : "text-[hsl(var(--ilo-primary-d))]",
              )}
            >
              {Math.round(pct)}%
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground" dir="rtl">
            {attempt.score ?? 0} من {attempt.maxScore ?? 0} درجة
            {exam.passingScore != null && (
              <>
                {" "}· درجة النجاح {exam.passingScore}% ·{" "}
                <strong className={passed ? "text-[hsl(var(--ilo-primary-d))]" : "text-destructive"}>
                  {passed ? "ناجح" : "لم يجتز"}
                </strong>
              </>
            )}
          </p>
          {attempt.pendingGradingCount > 0 && (
            <p className="mx-auto mt-4 max-w-md rounded-lg bg-[hsl(var(--ilo-gold-t))] p-3 text-sm text-[hsl(var(--ilo-gold-d))]">
              يحتوي الاختبار على {attempt.pendingGradingCount}{" "}
              {attempt.pendingGradingCount === 1 ? "سؤال مقالي" : "أسئلة مقالية"} بانتظار
              التصحيح اليدوي — قد تتغير نتيجتك النهائية بعد مراجعة المعلم.
            </p>
          )}
        </div>

        {/* breakdown */}
        <dl className="grid grid-cols-2 divide-x divide-x-reverse sm:grid-cols-4">
          <Stat icon={CheckCircle2} label="إجابات صحيحة" value={attempt.correctCount} tone="ok" />
          <Stat icon={XCircle} label="إجابات خاطئة" value={attempt.incorrectCount} tone="err" />
          <Stat icon={MinusCircle} label="بلا إجابة" value={attempt.unansweredCount} />
          <Stat icon={Clock3} label="الوقت المستغرق" value={formatTimeUsed(attempt.timeUsedSeconds)} />
        </dl>
      </div>

      {/* review */}
      {canReview && review ? (
        <section aria-label="مراجعة الإجابات" className="space-y-4">
          <h2 className="text-xl">مراجعة الإجابات</h2>
          {review.map((q, i) => (
            <article key={q.id} className="ilo-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-[hsl(var(--ilo-primary-c))]">
                  السؤال {i + 1}
                </span>
                <span className="ilo-pill bg-secondary text-secondary-foreground">
                  {questionTypeLabel[q.type]}
                </span>
                {q.isCorrect === true ? (
                  <span className="ilo-pill bg-[hsl(var(--ilo-ok-bg))] text-[hsl(var(--ilo-primary-d))]">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    صحيحة · {q.marksAwarded ?? 0}/{q.marks}
                  </span>
                ) : q.isCorrect === false ? (
                  <span className="ilo-pill bg-[hsl(var(--ilo-err-bg))] text-destructive">
                    <XCircle className="h-3.5 w-3.5" aria-hidden />
                    خاطئة · {q.marksAwarded ?? 0}/{q.marks}
                  </span>
                ) : (
                  <span className="ilo-pill bg-[hsl(var(--ilo-gold-t))] text-[hsl(var(--ilo-gold-d))]">
                    <CircleHelp className="h-3.5 w-3.5" aria-hidden />
                    بانتظار التصحيح
                  </span>
                )}
              </div>
              <p className="mt-3 leading-relaxed">{q.text}</p>

              {q.type === "text" ? (
                <div className="mt-4 rounded-lg border bg-secondary/50 p-4">
                  <p className="text-xs font-semibold text-muted-foreground">إجابتك:</p>
                  <p className="mt-1 whitespace-pre-line text-sm">
                    {q.textAnswer?.trim() || "— لم تُجب —"}
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {q.options.map((opt) => {
                    const picked = q.selectedOptionIds.includes(opt.id);
                    const state = opt.isCorrect ? "correct" : picked ? "wrong" : undefined;
                    return (
                      <div key={opt.id} className="ilo-option cursor-default" data-correct={state === "correct"} data-wrong={state === "wrong"}>
                        <span className="mt-0.5 shrink-0" aria-hidden>
                          {opt.isCorrect ? (
                            <CheckCircle2 className="h-5 w-5 text-[hsl(var(--ilo-primary-c))]" />
                          ) : picked ? (
                            <XCircle className="h-5 w-5 text-destructive" />
                          ) : (
                            <span className="block h-5 w-5 rounded-full border border-muted-foreground/30" />
                          )}
                        </span>
                        <span className="text-sm leading-relaxed">
                          {opt.text}
                          {picked && !opt.isCorrect && (
                            <span className="ms-2 text-xs text-destructive">(اختيارك)</span>
                          )}
                          {picked && opt.isCorrect && (
                            <span className="ms-2 text-xs text-[hsl(var(--ilo-primary-c))]">(اختيارك)</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {q.explanation && (
                <div className="mt-4 rounded-lg bg-[hsl(var(--ilo-gold-t))] p-3 text-sm leading-relaxed">
                  <strong className="text-[hsl(var(--ilo-gold-d))]">التوضيح: </strong>
                  {q.explanation}
                </div>
              )}
            </article>
          ))}
        </section>
      ) : (
        <div className="ilo-card flex items-start gap-3 p-5">
          <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <h2 className="text-base">مراجعة الإجابات غير متاحة حاليًا</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              سياسة المراجعة لهذا الاختبار: {reviewPolicyLabel[exam.reviewPolicy]}.
              {exam.reviewPolicy === "after_close" &&
                " ستتمكن من مراجعة إجاباتك بعد إغلاق الاختبار."}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => navigate("/exams")}>
          <Library className="me-2 h-4 w-4" aria-hidden />
          اختبارات أخرى
        </Button>
        <Button variant="outline" onClick={() => navigate("/")}>
          <Home className="me-2 h-4 w-4" aria-hidden />
          الرئيسية
        </Button>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone?: "ok" | "err";
}) {
  return (
    <div className="flex flex-col items-center gap-1 p-4 text-center">
      <Icon
        className={cn(
          "h-5 w-5",
          tone === "ok" ? "text-[hsl(var(--ilo-primary-c))]" : tone === "err" ? "text-destructive" : "text-muted-foreground",
        )}
        aria-hidden
      />
      <dd className="font-display text-xl font-bold tabular-nums">{value}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}
