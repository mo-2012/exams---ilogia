import { trpc } from "@/providers/trpc";
import { EmptyState } from "@/components/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  availabilityLabel,
  availabilityTone,
  difficultyLabel,
  difficultyTone,
  formatDateTime,
  formatDuration,
  reviewPolicyLabel,
} from "@/lib/labels";
import {
  ArrowRight,
  CalendarClock,
  CalendarX,
  CircleHelp,
  Eye,
  FileText,
  History,
  ListChecks,
  PlayCircle,
  Repeat,
  ShieldAlert,
  Target,
  Timer,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router";

export default function ExamDetails() {
  const { id } = useParams<{ id: string }>();
  const examId = Number(id);
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, error: loadError } = trpc.exams.byId.useQuery(
    { id: examId },
    { retry: false, enabled: Number.isFinite(examId) },
  );
  const startMutation = trpc.exams.start.useMutation({
    onSuccess: (r) => navigate(`/exam/${r.attemptId}`),
    onError: (e) => {
      setConfirmOpen(false);
      setError(e.message);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-52 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }
  if (loadError || !data) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="تعذر العثور على الاختبار"
        description="ربما حُذف الاختبار أو أن الرابط غير صحيح."
        action={
          <Button variant="outline" onClick={() => navigate("/exams")}>
            العودة إلى الاختبارات
          </Button>
        }
      />
    );
  }

  const { exam, subject, topic, availability } = data;
  const canStart = availability === "available";
  const canResume = availability === "in_progress" && data.liveAttemptId;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/exams")}>
        <ArrowRight className="me-1 h-4 w-4" aria-hidden />
        كل الاختبارات
      </Button>

      {/* header card */}
      <div className="ilo-card p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[hsl(var(--ilo-primary-c))]">
            {subject.nameAr}
            {topic ? ` · ${topic.nameAr}` : ""}
          </span>
          <span className={`ilo-pill ${availabilityTone[availability]}`}>
            {availabilityLabel[availability]}
          </span>
          <span className={`ilo-pill ${difficultyTone[exam.difficulty]}`}>
            {difficultyLabel[exam.difficulty]}
          </span>
        </div>
        <h1 className="mt-3 text-2xl md:text-3xl">{exam.title}</h1>
        {exam.description && (
          <p className="mt-3 text-muted-foreground">{exam.description}</p>
        )}

        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Spec icon={CircleHelp} label="الأسئلة" value={`${data.questionCount} سؤال`} />
          <Spec icon={ListChecks} label="الدرجة الكلية" value={`${data.totalMarks} درجة`} />
          <Spec icon={Timer} label="المدة" value={formatDuration(exam.durationMinutes)} />
          <Spec
            icon={Repeat}
            label="المحاولات"
            value={`${data.attemptsUsed}/${exam.maxAttempts}`}
          />
          <Spec
            icon={Target}
            label="درجة النجاح"
            value={exam.passingScore != null ? `${exam.passingScore}%` : "غير محددة"}
          />
          <Spec icon={Eye} label="مراجعة الإجابات" value={reviewPolicyLabel[exam.reviewPolicy]} />
        </dl>

        <div className="mt-4 grid gap-3 rounded-lg bg-secondary/70 p-4 text-sm sm:grid-cols-2">
          <p className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[hsl(var(--ilo-primary-c))]" aria-hidden />
            {exam.startsAt ? `يبدأ: ${formatDateTime(exam.startsAt)}` : "متاح فور النشر"}
          </p>
          <p className="flex items-center gap-2">
            <CalendarX className="h-4 w-4 text-[hsl(var(--ilo-primary-c))]" aria-hidden />
            {exam.endsAt ? `ينتهي: ${formatDateTime(exam.endsAt)}` : "بلا موعد إغلاق"}
          </p>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-[hsl(var(--ilo-err-bg))] p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6">
          {canResume ? (
            <Button size="lg" className="w-full sm:w-auto" onClick={() => navigate(`/exam/${data.liveAttemptId}`)}>
              <PlayCircle className="me-2 h-5 w-5" aria-hidden />
              استئناف المحاولة الجارية
            </Button>
          ) : canStart ? (
            <Button size="lg" className="w-full sm:w-auto" onClick={() => setConfirmOpen(true)}>
              <PlayCircle className="me-2 h-5 w-5" aria-hidden />
              بدء الاختبار
            </Button>
          ) : availability === "upcoming" ? (
            <p className="rounded-lg bg-[hsl(var(--ilo-gold-t))] p-3 text-sm font-medium text-[hsl(var(--ilo-gold-d))]">
              لم يبدأ موعد هذا الاختبار بعد — عُد عند {formatDateTime(exam.startsAt)}.
            </p>
          ) : availability === "completed" ? (
            <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
              استنفدت كل محاولاتك لهذا الاختبار. يمكنك مراجعة نتائجك من سجل الاختبارات.
            </p>
          ) : (
            <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
              هذا الاختبار مغلق ولم يعد متاحًا.
            </p>
          )}
        </div>
      </div>

      {/* instructions */}
      {exam.instructions && (
        <div className="ilo-card p-6">
          <h2 className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-[hsl(var(--ilo-primary-c))]" aria-hidden />
            تعليمات الاختبار
          </h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {exam.instructions}
          </p>
        </div>
      )}

      {/* past attempts */}
      {data.pastAttempts.length > 0 && (
        <div className="ilo-card p-6">
          <h2 className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5 text-[hsl(var(--ilo-primary-c))]" aria-hidden />
            محاولاتك السابقة
          </h2>
          <div className="mt-3 divide-y">
            {data.pastAttempts.map((a, i) => (
              <Link
                key={a.id}
                to={`/results/${a.id}`}
                className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-secondary/50 rounded-md px-2"
              >
                <span className="text-sm">
                  المحاولة {data.pastAttempts.length - i}
                  <span className="ms-2 text-xs text-muted-foreground">
                    {formatDateTime(a.submittedAt)}
                  </span>
                </span>
                <span
                  className={`font-display text-lg font-bold ${
                    a.passed === false ? "text-destructive" : "text-[hsl(var(--ilo-primary-c))]"
                  }`}
                >
                  {a.percentage != null ? `${Math.round(a.percentage)}%` : "—"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* rules confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">
              جاهز لبدء «{exam.title}»؟
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>قبل البدء، تأكد من فهمك للقواعد التالية:</p>
                <ul className="list-disc space-y-1.5 pe-5 text-foreground/80">
                  <li>
                    المدة <strong>{formatDuration(exam.durationMinutes)}</strong> ويبدأ
                    المؤقت فور الضغط على «ابدأ الآن».
                  </li>
                  <li>يُدار الوقت من الخادم — إغلاق المتصفح أو تحديث الصفحة لا يوقف المؤقت.</li>
                  <li>تُحفظ إجاباتك تلقائيًا أثناء الاختبار ويمكنك الاستئناف بعد انقطاع الاتصال.</li>
                  <li>عند انتهاء الوقت يُسلَّم الاختبار تلقائيًا بإجاباتك المحفوظة.</li>
                  <li>
                    هذه المحاولة ستُحتسب من رصيد محاولاتك (
                    {data.attemptsUsed + 1} من {exam.maxAttempts}).
                  </li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setError(null);
                startMutation.mutate({ examId: exam.id });
              }}
              disabled={startMutation.isPending}
            >
              {startMutation.isPending ? "جارٍ التحضير…" : "ابدأ الآن"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Spec({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
