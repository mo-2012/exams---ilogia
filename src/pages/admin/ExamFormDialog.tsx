import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";

export type ExamFormValues = {
  subjectId: number;
  topicId?: number | null;
  title: string;
  description?: string | null;
  instructions?: string | null;
  difficulty: "easy" | "medium" | "hard";
  durationMinutes: number;
  passingScore?: number | null;
  maxAttempts: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  reviewPolicy: "immediate" | "after_close" | "never";
  multiSelectScoring: "all_or_nothing" | "partial";
};

export type ExamFormInitial = Partial<ExamFormValues> & { title?: string };

type Subject = { id: number; nameAr: string };
type Topic = { id: number; nameAr: string; subjectId: number };

function toLocalInput(d?: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ExamFormDialog({
  open,
  onOpenChange,
  subjects,
  topics,
  initial,
  isPending,
  onSubmit,
  title = "اختبار جديد",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  subjects: Subject[];
  topics: Topic[];
  initial?: ExamFormInitial;
  isPending: boolean;
  onSubmit: (values: ExamFormValues) => void;
  title?: string;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    instructions: "",
    subjectId: "",
    topicId: "none",
    difficulty: "medium" as ExamFormValues["difficulty"],
    durationMinutes: 30,
    passingScore: "",
    maxAttempts: 1,
    startsAt: "",
    endsAt: "",
    reviewPolicy: "after_close" as ExamFormValues["reviewPolicy"],
    multiSelectScoring: "all_or_nothing" as ExamFormValues["multiSelectScoring"],
  });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFormError(null);
      setForm({
        title: initial?.title ?? "",
        description: initial?.description ?? "",
        instructions: initial?.instructions ?? "",
        subjectId: initial?.subjectId ? String(initial.subjectId) : "",
        topicId: initial?.topicId ? String(initial.topicId) : "none",
        difficulty: initial?.difficulty ?? "medium",
        durationMinutes: initial?.durationMinutes ?? 30,
        passingScore: initial?.passingScore != null ? String(initial.passingScore) : "",
        maxAttempts: initial?.maxAttempts ?? 1,
        startsAt: toLocalInput(initial?.startsAt),
        endsAt: toLocalInput(initial?.endsAt),
        reviewPolicy: initial?.reviewPolicy ?? "after_close",
        multiSelectScoring: initial?.multiSelectScoring ?? "all_or_nothing",
      });
    }
  }, [open, initial]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const subjectTopics = topics.filter((t) => String(t.subjectId) === form.subjectId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subjectId) return setFormError("اختر المادة");
    if (form.title.trim().length < 3) return setFormError("أدخل عنوانًا لا يقل عن 3 أحرف");
    if (form.durationMinutes < 1) return setFormError("المدة يجب أن تكون دقيقة واحدة على الأقل");
    const passing = form.passingScore.trim() ? Number(form.passingScore) : null;
    if (passing != null && (passing < 0 || passing > 100 || Number.isNaN(passing))) {
      return setFormError("درجة النجاح يجب أن تكون بين 0 و100");
    }
    const startsAt = form.startsAt ? new Date(form.startsAt) : null;
    const endsAt = form.endsAt ? new Date(form.endsAt) : null;
    if (startsAt && endsAt && endsAt <= startsAt) {
      return setFormError("موعد الانتهاء يجب أن يكون بعد موعد البدء");
    }
    setFormError(null);
    onSubmit({
      subjectId: Number(form.subjectId),
      topicId: form.topicId === "none" ? null : Number(form.topicId),
      title: form.title.trim(),
      description: form.description.trim() || null,
      instructions: form.instructions.trim() || null,
      difficulty: form.difficulty,
      durationMinutes: form.durationMinutes,
      passingScore: passing,
      maxAttempts: form.maxAttempts,
      startsAt,
      endsAt,
      reviewPolicy: form.reviewPolicy,
      multiSelectScoring: form.multiSelectScoring,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="ex-title">عنوان الاختبار</Label>
            <Input
              id="ex-title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="مثال: المعادلات التربيعية — اختبار قصير"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>المادة</Label>
              <Select value={form.subjectId} onValueChange={(v) => set("subjectId", v)}>
                <SelectTrigger aria-label="المادة">
                  <SelectValue placeholder="اختر المادة" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الموضوع (اختياري)</Label>
              <Select
                value={form.topicId}
                onValueChange={(v) => set("topicId", v)}
                disabled={!form.subjectId}
              >
                <SelectTrigger aria-label="الموضوع">
                  <SelectValue placeholder="بدون موضوع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون موضوع</SelectItem>
                  {subjectTopics.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ex-desc">الوصف</Label>
            <Textarea
              id="ex-desc"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="ما الذي يقيسه هذا الاختبار؟"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ex-instr">التعليمات للطالب</Label>
            <Textarea
              id="ex-instr"
              value={form.instructions}
              onChange={(e) => set("instructions", e.target.value)}
              placeholder="قواعد وإرشادات تظهر للطالب قبل البدء"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>الصعوبة</Label>
              <Select value={form.difficulty} onValueChange={(v) => set("difficulty", v as typeof form.difficulty)}>
                <SelectTrigger aria-label="الصعوبة">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">سهل</SelectItem>
                  <SelectItem value="medium">متوسط</SelectItem>
                  <SelectItem value="hard">صعب</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ex-dur">المدة (دقيقة)</Label>
              <Input
                id="ex-dur"
                type="number"
                min={1}
                max={600}
                value={form.durationMinutes}
                onChange={(e) => set("durationMinutes", Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ex-attempts">عدد المحاولات</Label>
              <Input
                id="ex-attempts"
                type="number"
                min={1}
                max={20}
                value={form.maxAttempts}
                onChange={(e) => set("maxAttempts", Number(e.target.value))}
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="ex-pass">درجة النجاح % (اختياري)</Label>
              <Input
                id="ex-pass"
                type="number"
                min={0}
                max={100}
                value={form.passingScore}
                onChange={(e) => set("passingScore", e.target.value)}
                placeholder="مثال: 60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ex-start">يبدأ في (اختياري)</Label>
              <Input
                id="ex-start"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => set("startsAt", e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ex-end">ينتهي في (اختياري)</Label>
              <Input
                id="ex-end"
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => set("endsAt", e.target.value)}
                dir="ltr"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>مراجعة الإجابات للطالب</Label>
              <Select value={form.reviewPolicy} onValueChange={(v) => set("reviewPolicy", v as typeof form.reviewPolicy)}>
                <SelectTrigger aria-label="سياسة المراجعة">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">فور التسليم</SelectItem>
                  <SelectItem value="after_close">بعد إغلاق الاختبار</SelectItem>
                  <SelectItem value="never">غير متاحة أبدًا</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>تصحيح الأسئلة متعددة الاختيارات</Label>
              <Select
                value={form.multiSelectScoring}
                onValueChange={(v) => set("multiSelectScoring", v as typeof form.multiSelectScoring)}
              >
                <SelectTrigger aria-label="نظام التصحيح">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_or_nothing">الكل أو لا شيء</SelectItem>
                  <SelectItem value="partial">درجات جزئية</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formError && (
            <p role="alert" className="rounded-lg bg-[hsl(var(--ilo-err-bg))] p-3 text-sm text-destructive">
              {formError}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "جارٍ الحفظ…" : "حفظ الاختبار"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
