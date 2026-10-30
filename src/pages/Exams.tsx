import { trpc } from "@/providers/trpc";
import { EmptyState, PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  availabilityLabel,
  availabilityTone,
  difficultyLabel,
  difficultyTone,
  formatDateTime,
  formatDuration,
} from "@/lib/labels";
import {
  CalendarClock,
  CircleHelp,
  ListFilter,
  Repeat,
  Search,
  Timer,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

export default function Exams() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [subjectId, setSubjectId] = useState<string>("all");
  const [difficulty, setDifficulty] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      subjectId: subjectId === "all" ? undefined : Number(subjectId),
      difficulty:
        difficulty === "all" ? undefined : (difficulty as "easy" | "medium" | "hard"),
      status:
        status === "all"
          ? undefined
          : (status as "available" | "upcoming" | "in_progress" | "completed" | "closed"),
    }),
    [search, subjectId, difficulty, status],
  );

  const { data: catalog } = trpc.exams.subjects.useQuery();
  const { data, isLoading } = trpc.exams.list.useQuery(filters);

  const hasFilters = search.trim() || subjectId !== "all" || difficulty !== "all" || status !== "all";

  return (
    <div>
      <PageHeader
        title="الاختبارات"
        description="تصفح الاختبارات المتاحة والقادمة، ورشّحها حسب المادة أو الصعوبة أو الحالة."
      />

      {/* filters */}
      <div className="ilo-card mb-6 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_160px_170px]">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم الاختبار…"
              className="ps-9"
              aria-label="بحث في الاختبارات"
            />
          </div>
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger aria-label="المادة">
              <SelectValue placeholder="كل المواد" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المواد</SelectItem>
              {catalog?.subjects.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.nameAr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger aria-label="الصعوبة">
              <SelectValue placeholder="كل المستويات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المستويات</SelectItem>
              <SelectItem value="easy">سهل</SelectItem>
              <SelectItem value="medium">متوسط</SelectItem>
              <SelectItem value="hard">صعب</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="الحالة">
              <SelectValue placeholder="كل الحالات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="available">متاح الآن</SelectItem>
              <SelectItem value="upcoming">قادم</SelectItem>
              <SelectItem value="in_progress">جارٍ</SelectItem>
              <SelectItem value="completed">مكتمل</SelectItem>
              <SelectItem value="closed">مغلق</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasFilters ? (
          <div className="mt-3 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setSubjectId("all");
                setDifficulty("all");
                setStatus("all");
              }}
            >
              <X className="me-1 h-4 w-4" aria-hidden />
              مسح الترشيحات
            </Button>
          </div>
        ) : null}
      </div>

      {/* listing */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={ListFilter}
          title={hasFilters ? "لا توجد نتائج مطابقة" : "لا توجد اختبارات بعد"}
          description={
            hasFilters
              ? "جرّب تعديل كلمات البحث أو إزالة بعض الترشيحات."
              : "ستظهر الاختبارات هنا فور نشرها."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((row) => (
            <button
              key={row.exam.id}
              onClick={() => navigate(`/exams/${row.exam.id}`)}
              className="ilo-card ilo-card-hover flex flex-col p-5 text-start cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[hsl(var(--ilo-primary-c))]">
                  {row.subject.nameAr}
                  {row.topic ? ` · ${row.topic.nameAr}` : ""}
                </span>
                <span className={`ilo-pill ${availabilityTone[row.availability]}`}>
                  {availabilityLabel[row.availability]}
                </span>
              </div>

              <h3 className="mt-2 text-lg leading-snug">{row.exam.title}</h3>
              {row.exam.description ? (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {row.exam.description}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                <span className={`ilo-pill ${difficultyTone[row.exam.difficulty]}`}>
                  {difficultyLabel[row.exam.difficulty]}
                </span>
                <span className="flex items-center gap-1">
                  <Timer className="h-3.5 w-3.5" aria-hidden />
                  {formatDuration(row.exam.durationMinutes)}
                </span>
                <span className="flex items-center gap-1">
                  <CircleHelp className="h-3.5 w-3.5" aria-hidden />
                  {row.questionCount} سؤال · {row.totalMarks} درجة
                </span>
                <span className="flex items-center gap-1">
                  <Repeat className="h-3.5 w-3.5" aria-hidden />
                  {row.attemptsUsed}/{row.exam.maxAttempts} محاولات
                </span>
                {row.availability === "upcoming" && row.exam.startsAt && (
                  <span className="flex items-center gap-1 text-[hsl(var(--ilo-gold-d))]">
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                    يبدأ {formatDateTime(row.exam.startsAt)}
                  </span>
                )}
                {row.bestPercentage != null && (
                  <span className="font-semibold text-[hsl(var(--ilo-primary-c))]">
                    أفضل نتيجة: {Math.round(row.bestPercentage)}%
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
