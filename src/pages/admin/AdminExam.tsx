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
import { Checkbox } from "@/components/ui/checkbox";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  attemptStatusLabel,
  difficultyLabel,
  formatDateTime,
  questionTypeLabel,
  reviewPolicyLabel,
} from "@/lib/labels";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  ClipboardList,
  Eye,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ExamFormDialog, type ExamFormValues } from "./ExamFormDialog";

type QuestionFormState = {
  type: "mcq_single" | "mcq_multi" | "true_false" | "text";
  text: string;
  explanation: string;
  marks: number;
  difficulty: "easy" | "medium" | "hard";
  options: Array<{ text: string; isCorrect: boolean }>;
};

const emptyQuestion: QuestionFormState = {
  type: "mcq_single",
  text: "",
  explanation: "",
  marks: 1,
  difficulty: "medium",
  options: [
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ],
};

export default function AdminExam() {
  const { id } = useParams<{ id: string }>();
  const examId = Number(id);
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const detail = trpc.admin.examDetail.useQuery({ examId }, { enabled: Number.isFinite(examId) });
  const attempts = trpc.admin.examAttempts.useQuery({ examId }, { enabled: Number.isFinite(examId) });
  const catalog = trpc.exams.subjects.useQuery();

  const [editExamOpen, setEditExamOpen] = useState(false);
  const [questionOpen, setQuestionOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionFormState & { id?: number }>(emptyQuestion);
  const [deletingQuestion, setDeletingQuestion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    utils.admin.examDetail.invalidate({ examId });
    utils.admin.examAttempts.invalidate({ examId });
    utils.admin.listExams.invalidate();
    utils.admin.overview.invalidate();
    utils.exams.list.invalidate();
  };

  const updateExam = trpc.admin.updateExam.useMutation({
    onSuccess: () => {
      setEditExamOpen(false);
      refresh();
    },
    onError: (e) => setError(e.message),
  });
  const upsertQuestion = trpc.admin.upsertQuestion.useMutation({
    onSuccess: () => {
      setQuestionOpen(false);
      refresh();
    },
    onError: (e) => setError(e.message),
  });
  const deleteQuestion = trpc.admin.deleteQuestion.useMutation({
    onSuccess: () => {
      setDeletingQuestion(null);
      refresh();
    },
    onError: (e) => {
      setDeletingQuestion(null);
      setError(e.message);
    },
  });
  const reorder = trpc.admin.reorderQuestions.useMutation({ onSuccess: refresh });

  if (detail.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-44 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }
  if (!detail.data) {
    return (
      <EmptyState
        title="الاختبار غير موجود"
        action={<Button variant="outline" onClick={() => navigate("/admin")}>العودة للوحة الإدارة</Button>}
      />
    );
  }

  const { exam, questions } = detail.data;
  const totalMarks = questions.reduce((s, q) => s + q.marks, 0);

  const move = (index: number, dir: -1 | 1) => {
    const ids = questions.map((q) => q.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    reorder.mutate({ examId, orderedIds: ids });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
            <ArrowRight className="me-1 h-4 w-4" aria-hidden />
            لوحة الإدارة
          </Button>
          <h1 className="text-2xl">{exam.title}</h1>
        </div>
        <Button variant="outline" onClick={() => setEditExamOpen(true)}>
          <Pencil className="me-2 h-4 w-4" aria-hidden />
          تعديل الإعدادات
        </Button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-[hsl(var(--ilo-err-bg))] p-3 text-sm text-destructive">
          {error}
          <button className="ms-2 underline" onClick={() => setError(null)}>إخفاء</button>
        </p>
      )}

      {/* summary strip */}
      <div className="ilo-card flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
        <span>الحالة: <strong>{exam.status === "draft" ? "مسودة" : exam.status === "published" ? "منشور" : "مغلق"}</strong></span>
        <span>الأسئلة: <strong className="tabular-nums">{questions.length}</strong></span>
        <span>الدرجة الكلية: <strong className="tabular-nums">{totalMarks}</strong></span>
        <span>المدة: <strong>{exam.durationMinutes} دقيقة</strong></span>
        <span>الصعوبة: <strong>{difficultyLabel[exam.difficulty]}</strong></span>
        <span>مراجعة الإجابات: <strong>{reviewPolicyLabel[exam.reviewPolicy]}</strong></span>
      </div>

      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions">الأسئلة ({questions.length})</TabsTrigger>
          <TabsTrigger value="attempts">
            المحاولات ({attempts.data?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* ---- questions ---- */}
        <TabsContent value="questions" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setEditingQuestion({ ...emptyQuestion, sortOrder: undefined } as never);
                setEditingQuestion({ ...emptyQuestion });
                setQuestionOpen(true);
              }}
            >
              <Plus className="me-2 h-4 w-4" aria-hidden />
              إضافة سؤال
            </Button>
          </div>

          {questions.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="لا توجد أسئلة بعد"
              description="أضف أسئلة الاختبار ثم انشره من لوحة الإدارة."
            />
          ) : (
            questions.map((q, i) => (
              <div key={q.id} className="ilo-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[hsl(var(--ilo-primary-c))] text-sm font-bold text-white tabular-nums">
                    {i + 1}
                  </span>
                  <span className="ilo-pill bg-secondary text-secondary-foreground">
                    {questionTypeLabel[q.type]}
                  </span>
                  <span className="ilo-pill bg-[hsl(var(--ilo-gold-t))] text-[hsl(var(--ilo-gold-d))]">
                    {q.marks} {q.marks === 1 ? "درجة" : "درجات"}
                  </span>
                  <span className="ilo-pill bg-secondary text-secondary-foreground">
                    {difficultyLabel[q.difficulty]}
                  </span>
                  <div className="ms-auto flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0 || reorder.isPending} aria-label="تحريك لأعلى">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === questions.length - 1 || reorder.isPending} aria-label="تحريك لأسفل">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="تعديل السؤال"
                      onClick={() => {
                        setEditingQuestion({
                          id: q.id,
                          type: q.type,
                          text: q.text,
                          explanation: q.explanation ?? "",
                          marks: q.marks,
                          difficulty: q.difficulty,
                          options:
                            q.type === "text"
                              ? []
                              : q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
                        });
                        setQuestionOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      aria-label="حذف السؤال"
                      onClick={() => setDeletingQuestion(q.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="mt-3 leading-relaxed">{q.text}</p>
                {q.type !== "text" && (
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {q.options.map((o) => (
                      <li key={o.id} className="flex items-center gap-2">
                        <CheckCircle2
                          className={cn("h-4 w-4", o.isCorrect ? "text-[hsl(var(--ilo-primary-c))]" : "text-muted-foreground/30")}
                          aria-hidden
                        />
                        <span className={o.isCorrect ? "font-medium text-foreground" : undefined}>{o.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </TabsContent>

        {/* ---- attempts ---- */}
        <TabsContent value="attempts" className="mt-4">
          {attempts.isLoading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : !attempts.data?.length ? (
            <EmptyState title="لا توجد محاولات بعد" description="ستظهر محاولات الطلاب هنا فور بدئها." />
          ) : (
            <div className="ilo-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">الطالب</TableHead>
                    <TableHead className="text-start">البدء</TableHead>
                    <TableHead className="text-start">الحالة</TableHead>
                    <TableHead className="text-start">الدرجة</TableHead>
                    <TableHead className="text-start">بانتظار التصحيح</TableHead>
                    <TableHead className="text-start">مراجعة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.data.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <p className="font-medium">{a.student.name || "طالب"}</p>
                        <p className="text-xs text-muted-foreground" dir="ltr">{a.student.email}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDateTime(a.startedAt)}
                      </TableCell>
                      <TableCell>{attemptStatusLabel[a.status]}</TableCell>
                      <TableCell>
                        {a.percentage != null ? (
                          <span className={cn("font-bold tabular-nums", a.passed === false ? "text-destructive" : "text-[hsl(var(--ilo-primary-c))]")}>
                            {Math.round(a.percentage)}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {a.pendingGradingCount > 0 ? (
                          <span className="ilo-pill bg-[hsl(var(--ilo-gold-t))] text-[hsl(var(--ilo-gold-d))]">
                            {a.pendingGradingCount}
                          </span>
                        ) : (
                          "0"
                        )}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => navigate(`/admin/attempts/${a.id}`)}>
                          <Eye className="me-1 h-4 w-4" aria-hidden />
                          مراجعة
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* edit exam settings */}
      <ExamFormDialog
        open={editExamOpen}
        onOpenChange={setEditExamOpen}
        title="تعديل إعدادات الاختبار"
        subjects={catalog.data?.subjects ?? []}
        topics={catalog.data?.topics ?? []}
        initial={{
          title: exam.title,
          description: exam.description ?? "",
          instructions: exam.instructions ?? "",
          subjectId: exam.subjectId,
          topicId: exam.topicId,
          difficulty: exam.difficulty,
          durationMinutes: exam.durationMinutes,
          passingScore: exam.passingScore,
          maxAttempts: exam.maxAttempts,
          startsAt: exam.startsAt,
          endsAt: exam.endsAt,
          reviewPolicy: exam.reviewPolicy,
          multiSelectScoring: exam.multiSelectScoring,
        }}
        isPending={updateExam.isPending}
        onSubmit={(values: ExamFormValues) => updateExam.mutate({ id: exam.id, data: values })}
      />

      {/* question dialog */}
      <QuestionDialog
        open={questionOpen}
        onOpenChange={setQuestionOpen}
        value={editingQuestion}
        onChange={setEditingQuestion}
        isPending={upsertQuestion.isPending}
        onSubmit={() => {
          const q = editingQuestion;
          upsertQuestion.mutate({
            id: q.id,
            examId,
            type: q.type,
            text: q.text,
            explanation: q.explanation || null,
            marks: q.marks,
            difficulty: q.difficulty,
            sortOrder: q.id ? (questions.find((x) => x.id === q.id)?.sortOrder ?? 0) : questions.length,
            options: q.type === "text" ? [] : q.options.map((o, i) => ({ ...o, sortOrder: i })),
          });
        }}
      />

      {/* delete question */}
      <AlertDialog open={deletingQuestion != null} onOpenChange={(o) => !o && setDeletingQuestion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">حذف هذا السؤال؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيُحذف السؤال وخياراته نهائيًا. إذا كان طلاب قد أجابوا عنه بالفعل فلن يمكنك حذفه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteQuestion.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deletingQuestion != null) deleteQuestion.mutate({ id: deletingQuestion });
              }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------

function QuestionDialog({
  open,
  onOpenChange,
  value,
  onChange,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  value: QuestionFormState & { id?: number };
  onChange: (v: QuestionFormState & { id?: number }) => void;
  isPending: boolean;
  onSubmit: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const set = (patch: Partial<QuestionFormState>) => onChange({ ...value, ...patch });

  const setType = (type: QuestionFormState["type"]) => {
    if (type === "true_false") {
      set({
        type,
        options: [
          { text: "صح", isCorrect: true },
          { text: "خطأ", isCorrect: false },
        ],
      });
    } else if (type === "text") {
      set({ type, options: [] });
    } else {
      set({
        type,
        options:
          value.options.length >= 2 && value.type !== "true_false" && value.type !== "text"
            ? value.options
            : [
                { text: "", isCorrect: true },
                { text: "", isCorrect: false },
                { text: "", isCorrect: false },
                { text: "", isCorrect: false },
              ],
      });
    }
  };

  const validate = (): string | null => {
    if (!value.text.trim()) return "أدخل نص السؤال";
    if (value.marks < 0.5) return "الدرجة يجب أن تكون 0.5 على الأقل";
    if (value.type === "text") return null;
    if (value.type === "true_false") {
      return value.options.filter((o) => o.isCorrect).length === 1
        ? null
        : "حدد الإجابة الصحيحة (صح أو خطأ)";
    }
    const filled = value.options.filter((o) => o.text.trim());
    if (filled.length < 2) return "أدخل خيارين على الأقل";
    const correct = value.options.filter((o) => o.isCorrect && o.text.trim()).length;
    if (value.type === "mcq_single" && correct !== 1) return "سؤال الاختيار الواحد يحتاج إجابة صحيحة واحدة فقط";
    if (value.type === "mcq_multi" && correct < 1) return "حدد إجابة صحيحة واحدة على الأقل";
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {value.id ? "تعديل السؤال" : "سؤال جديد"}
          </DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const err = validate();
            if (err) return setError(err);
            onSubmit();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label>نوع السؤال</Label>
              <Select value={value.type} onValueChange={(v) => setType(v as QuestionFormState["type"])}>
                <SelectTrigger aria-label="نوع السؤال">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq_single">اختيار واحد</SelectItem>
                  <SelectItem value="mcq_multi">اختيارات متعددة</SelectItem>
                  <SelectItem value="true_false">صح أو خطأ</SelectItem>
                  <SelectItem value="text">سؤال مقالي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="q-marks">الدرجة</Label>
              <Input
                id="q-marks"
                type="number"
                min={0.5}
                step={0.5}
                value={value.marks}
                onChange={(e) => set({ marks: Number(e.target.value) })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="q-text">نص السؤال</Label>
            <Textarea
              id="q-text"
              value={value.text}
              onChange={(e) => set({ text: e.target.value })}
              placeholder="اكتب السؤال… يدعم العربية والرموز الرياضية"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>الصعوبة</Label>
              <Select value={value.difficulty} onValueChange={(v) => set({ difficulty: v as QuestionFormState["difficulty"] })}>
                <SelectTrigger aria-label="صعوبة السؤال">
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
              <Label htmlFor="q-exp">التوضيح (اختياري — يظهر عند المراجعة)</Label>
              <Input
                id="q-exp"
                value={value.explanation}
                onChange={(e) => set({ explanation: e.target.value })}
                placeholder="لماذا هذه هي الإجابة الصحيحة؟"
              />
            </div>
          </div>

          {value.type !== "text" && (
            <div className="space-y-2">
              <Label>
                الخيارات
                <span className="ms-2 text-xs font-normal text-muted-foreground">
                  {value.type === "mcq_multi"
                    ? "فعّل كل الإجابات الصحيحة"
                    : "فعّل الإجابة الصحيحة الوحيدة"}
                </span>
              </Label>
              <div className="space-y-2">
                {value.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <Checkbox
                        checked={opt.isCorrect}
                        onCheckedChange={(checked) => {
                          const options = value.options.map((o, j) => ({
                            ...o,
                            isCorrect:
                              value.type === "mcq_multi"
                                ? j === i
                                  ? !!checked
                                  : o.isCorrect
                                : j === i,
                          }));
                          set({ options });
                        }}
                        aria-label={`الخيار ${i + 1} صحيح`}
                      />
                      صحيح
                    </label>
                    <Input
                      value={opt.text}
                      onChange={(e) => {
                        const options = [...value.options];
                        options[i] = { ...options[i], text: e.target.value };
                        set({ options });
                      }}
                      disabled={value.type === "true_false"}
                      placeholder={`الخيار ${i + 1}`}
                      required
                    />
                    {value.type !== "true_false" && value.options.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="حذف الخيار"
                        onClick={() => set({ options: value.options.filter((_, j) => j !== i) })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {(value.type === "mcq_single" || value.type === "mcq_multi") && value.options.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => set({ options: [...value.options, { text: "", isCorrect: false }] })}
                >
                  <Plus className="me-1 h-4 w-4" aria-hidden />
                  إضافة خيار
                </Button>
              )}
            </div>
          )}

          {value.type === "text" && (
            <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
              الأسئلة المقالية لا تُصحح آليًا — سيراجعها المعلم يدويًا من صفحة المحاولات بعد التسليم.
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-[hsl(var(--ilo-err-bg))] p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "جارٍ الحفظ…" : value.id ? "حفظ التعديلات" : "إضافة السؤال"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
