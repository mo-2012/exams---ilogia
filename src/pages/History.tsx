import { trpc } from "@/providers/trpc";
import { EmptyState, PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
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
import { attemptStatusLabel, formatDateTime } from "@/lib/labels";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Eye,
  History as HistoryIcon,
  PlayCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

type SortKey = "date" | "score";

export default function History() {
  const navigate = useNavigate();
  const { data, isLoading } = trpc.exams.history.useQuery();
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDesc, setSortDesc] = useState(true);

  const subjects = useMemo(() => {
    const names = new Set<string>();
    data?.forEach((r) => r.subject && names.add(r.subject.nameAr));
    return [...names];
  }, [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    let out = data.filter(
      (r) =>
        (subjectFilter === "all" || r.subject?.nameAr === subjectFilter) &&
        (statusFilter === "all" || r.attempt.status === statusFilter),
    );
    out = [...out].sort((a, b) => {
      const av = sortKey === "date" ? a.attempt.startedAt.getTime() : (a.attempt.percentage ?? -1);
      const bv = sortKey === "date" ? b.attempt.startedAt.getTime() : (b.attempt.percentage ?? -1);
      return sortDesc ? bv - av : av - bv;
    });
    return out;
  }, [data, subjectFilter, statusFilter, sortKey, sortDesc]);

  return (
    <div>
      <PageHeader
        title="سجل الاختبارات"
        description="كل محاولاتك السابقة والجارية مع إمكانية الترتيب والترشيح."
      />

      <div className="ilo-card mb-4 flex flex-wrap items-center gap-3 p-4">
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-44" aria-label="ترشيح حسب المادة">
            <SelectValue placeholder="كل المواد" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المواد</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44" aria-label="ترشيح حسب الحالة">
            <SelectValue placeholder="كل الحالات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
            <SelectItem value="submitted">مُسلَّمة</SelectItem>
            <SelectItem value="expired">منتهية بالوقت</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          className="ms-auto"
          onClick={() => setSortDesc((d) => !d)}
        >
          {sortDesc ? (
            <ArrowDownWideNarrow className="me-1 h-4 w-4" aria-hidden />
          ) : (
            <ArrowUpNarrowWide className="me-1 h-4 w-4" aria-hidden />
          )}
          {sortDesc ? "الأحدث أولًا" : "الأقدم أولًا"}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-72 rounded-lg" />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="لا يوجد سجل بعد"
          description="عندما تبدأ أول اختبار ستظهر محاولاتك هنا."
          action={<Button onClick={() => navigate("/exams")}>تصفح الاختبارات</Button>}
        />
      ) : rows.length === 0 ? (
        <EmptyState title="لا توجد نتائج مطابقة للترشيحات" />
      ) : (
        <div className="ilo-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">الاختبار</TableHead>
                <TableHead className="text-start">المادة</TableHead>
                <TableHead className="text-start">
                  <button
                    className="flex items-center gap-1 font-semibold"
                    onClick={() => setSortKey("date")}
                  >
                    التاريخ
                  </button>
                </TableHead>
                <TableHead className="text-start">
                  <button
                    className="flex items-center gap-1 font-semibold"
                    onClick={() => setSortKey("score")}
                  >
                    الدرجة
                  </button>
                </TableHead>
                <TableHead className="text-start">الحالة</TableHead>
                <TableHead className="text-start">الإجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.attempt.id}>
                  <TableCell className="font-medium">{r.exam?.title ?? "اختبار"}</TableCell>
                  <TableCell>{r.subject?.nameAr ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDateTime(r.attempt.startedAt)}
                  </TableCell>
                  <TableCell>
                    {r.attempt.percentage != null ? (
                      <span
                        className={
                          r.attempt.passed === false
                            ? "font-bold text-destructive"
                            : "font-bold text-[hsl(var(--ilo-primary-c))]"
                        }
                      >
                        {Math.round(r.attempt.percentage)}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`ilo-pill ${
                        r.attempt.status === "in_progress"
                          ? "bg-[hsl(207_60%_92%)] text-[hsl(207_80%_30%)]"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {attemptStatusLabel[r.attempt.status]}
                    </span>
                  </TableCell>
                  <TableCell>
                    {r.attempt.status === "in_progress" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/exam/${r.attempt.id}`)}
                      >
                        <PlayCircle className="me-1 h-4 w-4" aria-hidden />
                        استئناف
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/results/${r.attempt.id}`)}
                      >
                        <Eye className="me-1 h-4 w-4" aria-hidden />
                        النتيجة
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
