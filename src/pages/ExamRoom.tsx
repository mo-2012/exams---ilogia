import { trpc } from "@/providers/trpc";
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
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatClock, questionTypeLabel } from "@/lib/labels";
import {
  AlarmClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  Flag,
  FlagOff,
  LayoutGrid,
  Send,
  ShieldAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";

type AnswersMap = Record<number, { selectedOptionIds: number[]; textAnswer: string }>;

export default function ExamRoom() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const id = Number(attemptId);
  const navigate = useNavigate();

  const { data, isLoading, error } = trpc.exams.attempt.useQuery(
    { attemptId: id },
    { retry: false, enabled: Number.isFinite(id) },
  );

  // finalized elsewhere (expired on another tab / auto-submit) -> go to results
  useEffect(() => {
    if (data && data.status !== "in_progress") {
      navigate(`/results/${id}`, { replace: true });
    }
  }, [data, id, navigate]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }
  if (error || !data || data.status !== "in_progress") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" aria-hidden />
        <h1 className="text-xl">تعذر فتح الاختبار</h1>
        <p className="text-sm text-muted-foreground">
          {error?.message || "المحاولة غير متاحة — ربما انتهت أو سُلّمت بالفعل."}
        </p>
        <Button onClick={() => navigate("/exams")}>العودة إلى الاختبارات</Button>
      </div>
    );
  }

  return <ExamSession key={data.attemptId} data={data} />;
}

// ---------------------------------------------------------------------------

// composite DTO returned by exams.attempt for a live attempt (matches the
// server response; DB rows are never re-typed here)
type SessionData = {
  status: "in_progress";
  attemptId: number;
  exam: { id: number; title: string; instructions: string | null; durationMinutes: number };
  serverNow: Date;
  startedAt: Date;
  deadlineAt: Date;
  questions: Array<{
    id: number;
    type: "mcq_single" | "mcq_multi" | "true_false" | "text";
    text: string;
    imageUrl: string | null;
    marks: number;
    options: Array<{ id: number; text: string }>;
  }>;
  answers: Array<{ questionId: number; selectedOptionIds: number[]; textAnswer: string }>;
};

function ExamSession({ data }: { data: SessionData }) {
  const navigate = useNavigate();
  const questions = data.questions;

  // server clock: deadline & now both come from the server; the offset keeps
  // the countdown honest even if the device clock is wrong.
  const offsetRef = useRef(data.serverNow.getTime() - Date.now());
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((data.deadlineAt.getTime() - data.serverNow.getTime()) / 1000)),
  );

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<AnswersMap>(() => {
    const map: AnswersMap = {};
    for (const a of data.answers) {
      map[a.questionId] = {
        selectedOptionIds: a.selectedOptionIds ?? [],
        textAnswer: a.textAnswer ?? "",
      };
    }
    return map;
  });
  const [reviewMarks, setReviewMarks] = useState<Set<number>>(() => {
    try {
      const raw = sessionStorage.getItem(`review-marks-${data.attemptId}`);
      return raw ? new Set<number>(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");

  const saveMutation = trpc.exams.saveAnswer.useMutation({
    onMutate: () => setSaveState("saving"),
    onSuccess: (r) => {
      offsetRef.current = r.serverNow.getTime() - Date.now();
      setSaveState("saved");
    },
    onError: () => setSaveState("error"),
  });
  const submitMutation = trpc.exams.submit.useMutation({
    onSuccess: (r) => {
      sessionStorage.removeItem(`review-marks-${data.attemptId}`);
      navigate(`/results/${r.attemptId}`, { replace: true });
    },
  });

  const doSubmit = useCallback(() => {
    if (!submitMutation.isPending) submitMutation.mutate({ attemptId: data.attemptId });
  }, [submitMutation, data.attemptId]);
  const doSubmitRef = useRef(doSubmit);
  doSubmitRef.current = doSubmit;

  // countdown driven by the server deadline
  useEffect(() => {
    const tick = () => {
      const serverNow = Date.now() + offsetRef.current;
      const left = Math.max(0, Math.floor((data.deadlineAt.getTime() - serverNow) / 1000));
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(timer);
        doSubmitRef.current(); // server-validated auto submission
      }
    };
    const timer = window.setInterval(tick, 1000);
    tick();
    return () => window.clearInterval(timer);
  }, [data.deadlineAt]);

  // persist review marks across refresh
  useEffect(() => {
    sessionStorage.setItem(
      `review-marks-${data.attemptId}`,
      JSON.stringify([...reviewMarks]),
    );
  }, [reviewMarks, data.attemptId]);

  const debounceRef = useRef<number | undefined>(undefined);
  const persist = useCallback(
    (questionId: number, value: AnswersMap[number]) => {
      window.clearTimeout(debounceRef.current);
      setSaveState("saving");
      debounceRef.current = window.setTimeout(() => {
        saveMutation.mutate({
          attemptId: data.attemptId,
          questionId,
          selectedOptionIds: value.selectedOptionIds,
          textAnswer: value.textAnswer,
        });
      }, 400);
    },
    [saveMutation, data.attemptId],
  );

  const question = questions[current];
  const qAnswer = answers[question.id] ?? { selectedOptionIds: [], textAnswer: "" };
  const answeredCount = useMemo(
    () =>
      questions.filter((q) => {
        const a = answers[q.id];
        if (!a) return false;
        return q.type === "text" ? a.textAnswer.trim().length > 0 : a.selectedOptionIds.length > 0;
      }).length,
    [questions, answers],
  );
  const unansweredCount = questions.length - answeredCount;
  const lowTime = remaining <= 60;
  const midTime = remaining <= 300 && !lowTime;

  const selectOption = (optionId: number) => {
    let next: number[];
    if (question.type === "mcq_multi") {
      next = qAnswer.selectedOptionIds.includes(optionId)
        ? qAnswer.selectedOptionIds.filter((x) => x !== optionId)
        : [...qAnswer.selectedOptionIds, optionId];
    } else {
      next = [optionId];
    }
    const value = { ...qAnswer, selectedOptionIds: next };
    setAnswers((p) => ({ ...p, [question.id]: value }));
    persist(question.id, value);
  };

  const setText = (text: string) => {
    const value = { selectedOptionIds: [], textAnswer: text };
    setAnswers((p) => ({ ...p, [question.id]: value }));
    persist(question.id, value);
  };

  const toggleReview = () => {
    setReviewMarks((prev) => {
      const next = new Set(prev);
      if (next.has(question.id)) next.delete(question.id);
      else next.add(question.id);
      return next;
    });
  };

  const goTo = (i: number) => {
    setCurrent(Math.min(Math.max(i, 0), questions.length - 1));
    setPaletteOpen(false);
  };

  const palette = (
    <div className="grid grid-cols-6 gap-2 sm:grid-cols-8" role="navigation" aria-label="التنقل بين الأسئلة">
      {questions.map((q, i) => {
        const a = answers[q.id];
        const answered = q.type === "text" ? !!a?.textAnswer.trim() : (a?.selectedOptionIds.length ?? 0) > 0;
        const marked = reviewMarks.has(q.id);
        return (
          <button
            key={q.id}
            onClick={() => goTo(i)}
            className={cn(
              "relative flex h-10 items-center justify-center rounded-md border text-sm font-semibold transition-colors",
              i === current
                ? "border-[hsl(var(--ilo-primary-c))] bg-[hsl(var(--ilo-primary-c))] text-white"
                : answered
                  ? "border-[hsl(var(--ilo-primary-c))]/40 bg-[hsl(var(--ilo-ok-bg))] text-[hsl(var(--ilo-primary-d))]"
                  : "border-border bg-card text-muted-foreground hover:border-[hsl(var(--ilo-primary-c))]/50",
            )}
            aria-label={`السؤال ${i + 1}${answered ? " — مُجاب" : " — غير مُجاب"}${marked ? " — مُعلَّم للمراجعة" : ""}`}
            aria-current={i === current ? "true" : undefined}
          >
            {i + 1}
            {marked && (
              <Flag
                className="absolute -top-1.5 -end-1.5 h-3.5 w-3.5 fill-[hsl(var(--ilo-gold))] text-[hsl(var(--ilo-gold-d))]"
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* exam header — compact on mobile */}
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold md:text-base">{data.exam.title}</h1>
          </div>

          {/* save state */}
          <span
            className={cn(
              "hidden items-center gap-1 text-xs sm:flex",
              saveState === "error" ? "text-destructive" : "text-muted-foreground",
            )}
            role="status"
          >
            <CloudUpload className="h-3.5 w-3.5" aria-hidden />
            {saveState === "saving" ? "جارٍ الحفظ…" : saveState === "error" ? "تعذر الحفظ" : "محفوظ"}
          </span>

          {/* countdown */}
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-sm font-bold tabular-nums",
              lowTime
                ? "bg-[hsl(var(--ilo-err-bg))] text-destructive"
                : midTime
                  ? "bg-[hsl(var(--ilo-gold-t))] text-[hsl(var(--ilo-gold-d))]"
                  : "bg-secondary text-secondary-foreground",
            )}
            role="timer"
            aria-live="off"
            aria-label={`الوقت المتبقي ${formatClock(remaining)}`}
          >
            <AlarmClock className="h-4 w-4" aria-hidden />
            <span dir="ltr">{formatClock(remaining)}</span>
          </span>

          {/* palette (mobile: sheet) */}
          <Sheet open={paletteOpen} onOpenChange={setPaletteOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden" aria-label="فتح قائمة الأسئلة">
                <LayoutGrid className="h-4 w-4" aria-hidden />
                <span className="ms-1 tabular-nums">
                  {current + 1}/{questions.length}
                </span>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[70dvh]">
              <SheetHeader>
                <SheetTitle className="font-display">الأسئلة</SheetTitle>
              </SheetHeader>
              <div className="mt-4 overflow-y-auto pb-6">{palette}</div>
            </SheetContent>
          </Sheet>

          <Button
            size="sm"
            className="ilo-btn-gold font-semibold"
            onClick={() => setConfirmOpen(true)}
          >
            <Send className="me-1.5 h-4 w-4" aria-hidden />
            تسليم
          </Button>
        </div>
        <Progress value={(answeredCount / questions.length) * 100} className="h-1 rounded-none" />
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-6 px-4 py-6">
        {/* question area */}
        <main className="min-w-0 flex-1">
          <div className="ilo-card p-5 md:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-[hsl(var(--ilo-primary-c))]">
                السؤال {current + 1} من {questions.length}
              </span>
              <span className="ilo-pill bg-secondary text-secondary-foreground">
                {questionTypeLabel[question.type]}
              </span>
              <span className="ilo-pill bg-[hsl(var(--ilo-gold-t))] text-[hsl(var(--ilo-gold-d))]">
                {question.marks} {question.marks === 1 ? "درجة" : "درجات"}
              </span>
              <button
                onClick={toggleReview}
                className={cn(
                  "ms-auto flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
                  reviewMarks.has(question.id)
                    ? "bg-[hsl(var(--ilo-gold-t))] text-[hsl(var(--ilo-gold-d))]"
                    : "text-muted-foreground hover:bg-secondary",
                )}
                aria-pressed={reviewMarks.has(question.id)}
              >
                {reviewMarks.has(question.id) ? (
                  <>
                    <FlagOff className="h-3.5 w-3.5" aria-hidden />
                    إزالة علامة المراجعة
                  </>
                ) : (
                  <>
                    <Flag className="h-3.5 w-3.5" aria-hidden />
                    وضع علامة للمراجعة
                  </>
                )}
              </button>
            </div>

            <p className="mt-4 text-lg leading-relaxed">{question.text}</p>
            {question.imageUrl && (
              <img
                src={question.imageUrl}
                alt="صورة توضيحية للسؤال"
                className="mt-4 max-h-64 rounded-lg border object-contain"
              />
            )}

            {/* answers */}
            <div className="mt-6 space-y-3" role="group" aria-label="خيارات الإجابة">
              {question.type === "text" ? (
                <div>
                  <Textarea
                    value={qAnswer.textAnswer}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="اكتب إجابتك هنا…"
                    className="min-h-40 text-base leading-relaxed"
                    aria-label="إجابتك"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    هذا السؤال مقالي — سيصححه المعلم يدويًا بعد التسليم.
                  </p>
                </div>
              ) : (
                question.options.map((opt, idx) => {
                  const selected = qAnswer.selectedOptionIds.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => selectOption(opt.id)}
                      className="ilo-option"
                      data-selected={selected}
                      aria-pressed={selected}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border text-xs font-bold transition-colors",
                          question.type === "mcq_multi" ? "rounded-md" : "rounded-full",
                          selected
                            ? "border-[hsl(var(--ilo-primary-c))] bg-[hsl(var(--ilo-primary-c))] text-white"
                            : "border-muted-foreground/40 text-muted-foreground",
                        )}
                        aria-hidden
                      >
                        {selected ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          String.fromCharCode(65 + idx)
                        )}
                      </span>
                      <span className="text-base leading-relaxed">{opt.text}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* prev / next */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => goTo(current - 1)}
              disabled={current === 0}
              className="min-h-[44px]"
            >
              <ChevronRight className="me-1 h-4 w-4" aria-hidden />
              السابق
            </Button>
            <span className="text-sm tabular-nums text-muted-foreground">
              أجبت عن {answeredCount} من {questions.length}
            </span>
            {current < questions.length - 1 ? (
              <Button onClick={() => goTo(current + 1)} className="min-h-[44px]">
                التالي
                <ChevronLeft className="ms-1 h-4 w-4" aria-hidden />
              </Button>
            ) : (
              <Button className="ilo-btn-gold min-h-[44px] font-semibold" onClick={() => setConfirmOpen(true)}>
                <Send className="me-1.5 h-4 w-4" aria-hidden />
                تسليم الاختبار
              </Button>
            )}
          </div>
        </main>

        {/* side palette — desktop */}
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="ilo-card sticky top-24 p-4">
            <h2 className="mb-3 text-sm font-semibold">خريطة الأسئلة</h2>
            {palette}
            <div className="mt-4 space-y-1.5 border-t pt-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-[hsl(var(--ilo-ok-bg))] ring-1 ring-[hsl(var(--ilo-primary-c))]/40" aria-hidden />
                مُجاب عنه
              </p>
              <p className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm border bg-card" aria-hidden />
                غير مُجاب عنه
              </p>
              <p className="flex items-center gap-2">
                <Flag className="h-3.5 w-3.5 fill-[hsl(var(--ilo-gold))] text-[hsl(var(--ilo-gold-d))]" aria-hidden />
                مُعلَّم للمراجعة
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* submit confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">تسليم الاختبار؟</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  أجبت عن <strong>{answeredCount}</strong> من {questions.length} سؤالًا.
                  {unansweredCount > 0 && (
                    <span className="text-destructive">
                      {" "}
                      يتبقى {unansweredCount} {unansweredCount === 1 ? "سؤال" : "أسئلة"} بلا إجابة.
                    </span>
                  )}
                </p>
                <p>بعد التسليم لا يمكنك تعديل إجاباتك، وستُحتسب النتيجة فورًا.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>متابعة الإجابة</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                doSubmit();
              }}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? "جارٍ التسليم…" : "تسليم نهائي"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
