import { trpc } from "@/providers/trpc";
import { EmptyState, PageHeader, StatCard } from "@/components/shared";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { difficultyLabel, formatDateTime } from "@/lib/labels";
import {
  BookOpenCheck,
  CircleHelp,
  ClipboardList,
  FolderPlus,
  PenLine,
  Plus,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ExamFormDialog, type ExamFormInitial } from "./ExamFormDialog";

const statusLabel: Record<string, string> = {
  draft: "مسودة",
  published: "منشور",
  closed: "مغلق",
};
const statusTone: Record<string, string> = {
  draft: "bg-secondary text-secondary-foreground",
  published: "bg-[hsl(var(--ilo-ok-bg))] text-[hsl(var(--ilo-primary-d))]",
  closed: "bg-muted text-muted-foreground",
};

export default function AdminHome() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const overview = trpc.admin.overview.useQuery();
  const examsList = trpc.admin.listExams.useQuery();
  const catalog = trpc.exams.subjects.useQuery();

  const [createOpen, setCreateOpen] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [deleting, setDeleting] = useState<{ id: number; title: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = () => {
    utils.admin.overview.invalidate();
    utils.admin.listExams.invalidate();
    utils.exams.subjects.invalidate();
    utils.exams.list.invalidate();
  };

  const createExam = trpc.admin.createExam.useMutation({
    onSuccess: (r) => {
      setCreateOpen(false);
      refresh();
      navigate(`/admin/exams/${r.id}`);
    },
    onError: (e) => setActionError(e.message),
  });
  const setStatus = trpc.admin.setExamStatus.useMutation({
    onSuccess: refresh,
    onError: (e) => setActionError(e.message),
  });
  const deleteExam = trpc.admin.deleteExam.useMutation({
    onSuccess: () => {
      setDeleting(null);
      refresh();
    },
    onError: (e) => {
      setDeleting(null);
      setActionError(e.message);
    },
  });
  const createSubject = trpc.admin.createSubject.useMutation({
    onSuccess: () => {
      setSubjectOpen(false);
      refresh();
    },
    onError: (e) => setActionError(e.message),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="لوحة الإدارة"
        description="إنشاء الاختبارات وإدارة الأسئلة ومتابعة النتائج."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSubjectOpen(true)}>
              <FolderPlus className="me-2 h-4 w-4" aria-hidden />
              مادة جديدة
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="me-2 h-4 w-4" aria-hidden />
              اختبار جديد
            </Button>
          </div>
        }
      />

      {actionError && (
        <p role="alert" className="rounded-lg bg-[hsl(var(--ilo-err-bg))] p-3 text-sm text-destructive">
          {actionError}
          <button className="ms-2 underline" onClick={() => setActionError(null)}>
            إخفاء
          </button>
        </p>
      )}

      {/* overview */}
      {overview.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : overview.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard icon={BookOpenCheck} label="الاختبارات" value={overview.data.exams} />
          <StatCard icon={CircleHelp} label="الأسئلة" value={overview.data.questions} />
          <StatCard icon={ClipboardList} label="المحاولات" value={overview.data.attempts} />
          <StatCard icon={Users} label="المستخدمون" value={overview.data.students} />
          <StatCard icon={PenLine} label="بانتظار التصحيح" value={overview.data.pendingGrading} tone="gold" />
        </div>
      ) : null}

      {/* exams table */}
      <section aria-label="إدارة الاختبارات">
        <h2 className="mb-4 text-xl">الاختبارات</h2>
        {examsList.isLoading ? (
          <Skeleton className="h-72 rounded-lg" />
        ) : !examsList.data?.length ? (
          <EmptyState
            icon={BookOpenCheck}
            title="لا توجد اختبارات بعد"
            description="أنشئ أول اختبار ثم أضف إليه الأسئلة وانشره للطلاب."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="me-2 h-4 w-4" aria-hidden />
                اختبار جديد
              </Button>
            }
          />
        ) : (
          <div className="ilo-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">الاختبار</TableHead>
                  <TableHead className="text-start">المادة</TableHead>
                  <TableHead className="text-start">الحالة</TableHead>
                  <TableHead className="text-start">الأسئلة</TableHead>
                  <TableHead className="text-start">المحاولات</TableHead>
                  <TableHead className="text-start">آخر تحديث</TableHead>
                  <TableHead className="text-start">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {examsList.data.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <button
                        className="text-start font-medium text-[hsl(var(--ilo-primary-c))] hover:underline"
                        onClick={() => navigate(`/admin/exams/${e.id}`)}
                      >
                        {e.title}
                      </button>
                      <p className="text-xs text-muted-foreground">
                        {difficultyLabel[e.difficulty]} · {e.durationMinutes} د
                      </p>
                    </TableCell>
                    <TableCell>{e.subject.nameAr}</TableCell>
                    <TableCell>
                      <span className={`ilo-pill ${statusTone[e.status]}`}>
                        {statusLabel[e.status]}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {e.questionCount} ({e.totalMarks} درجة)
                    </TableCell>
                    <TableCell className="tabular-nums">{e.attemptCount}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(e.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {e.status !== "published" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={setStatus.isPending}
                            onClick={() => setStatus.mutate({ id: e.id, status: "published" })}
                          >
                            نشر
                          </Button>
                        )}
                        {e.status === "published" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={setStatus.isPending}
                            onClick={() => setStatus.mutate({ id: e.id, status: "closed" })}
                          >
                            إغلاق
                          </Button>
                        )}
                        {e.status === "closed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={setStatus.isPending}
                            onClick={() => setStatus.mutate({ id: e.id, status: "draft" })}
                          >
                            إلى مسودة
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleting({ id: e.id, title: e.title })}
                        >
                          حذف
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* create exam */}
      <ExamFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        subjects={catalog.data?.subjects ?? []}
        topics={catalog.data?.topics ?? []}
        isPending={createExam.isPending}
        onSubmit={(values) => createExam.mutate(values)}
      />

      {/* create subject */}
      <SubjectDialog
        open={subjectOpen}
        onOpenChange={setSubjectOpen}
        isPending={createSubject.isPending}
        onSubmit={(nameAr, nameEn) => createSubject.mutate({ nameAr, nameEn })}
      />

      {/* delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display flex items-center gap-2 text-xl">
              <ShieldAlert className="h-5 w-5 text-destructive" aria-hidden />
              حذف «{deleting?.title}»؟
            </AlertDialogTitle>
            <AlertDialogDescription>
              يُحذف الاختبار وجميع أسئلته نهائيًا. لا يمكن حذف اختبار له محاولات مسجلة —
              أغلقه بدلًا من ذلك.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteExam.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteExam.mutate({ id: deleting.id });
              }}
            >
              {deleteExam.isPending ? "جارٍ الحذف…" : "حذف نهائي"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SubjectDialog({
  open,
  onOpenChange,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isPending: boolean;
  onSubmit: (nameAr: string, nameEn?: string) => void;
}) {
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-xl">مادة جديدة</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (nameAr.trim().length >= 2) onSubmit(nameAr.trim(), nameEn.trim() || undefined);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="subj-ar">اسم المادة (عربي)</Label>
            <Input
              id="subj-ar"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder="مثال: الجيولوجيا"
              required
              minLength={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subj-en">الاسم بالإنجليزية (اختياري)</Label>
            <Input
              id="subj-en"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="Geology"
              dir="ltr"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending || nameAr.trim().length < 2}>
              {isPending ? "جارٍ الإضافة…" : "إضافة المادة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type { ExamFormInitial };
