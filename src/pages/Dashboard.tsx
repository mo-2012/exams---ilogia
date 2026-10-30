import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import { EmptyState, StatCard } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { difficultyLabel, formatDateTime } from "@/lib/labels";
import {
  ArrowLeft,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Library,
  Percent,
  Sparkles,
  Timer,
  TrendingUp,
} from "lucide-react";
import { Link, useNavigate } from "react-router";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading } = trpc.exams.dashboard.useQuery();

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  const { counts } = data;
  const hasActivity = counts.completed > 0 || counts.inProgress > 0;

  return (
    <div className="space-y-8">
      {/* welcome */}
      <section className="ilo-card relative overflow-hidden p-6 md:p-8">
        <div
          className="absolute inset-y-0 end-0 w-1/3 opacity-[0.06] pointer-events-none bg-[hsl(var(--ilo-primary-c))]"
          style={{ clipPath: "polygon(35% 0, 100% 0, 100% 100%, 0 100%)" }}
          aria-hidden
        />
        <div className="relative">
          <p className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--ilo-gold-d))]">
            <Sparkles className="h-4 w-4" aria-hidden />
            منصة آيلوجيا للاختبارات
          </p>
          <h1 className="mt-2 text-2xl md:text-3xl">
            أهلًا بك، {user?.name?.split(" ")[0] || "طالبنا العزيز"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
            {counts.available > 0
              ? `لديك ${counts.available} اختبارًا متاحًا الآن. بالتوفيق!`
              : counts.upcoming > 0
                ? "لا توجد اختبارات متاحة حاليًا، لكن هناك اختبارات قادمة — استعد لها."
                : "ستظهر اختباراتك هنا فور نشرها من إدارة المنصة."}
          </p>
          {counts.available > 0 && (
            <Button className="mt-4" onClick={() => navigate("/exams")}>
              <Library className="me-2 h-4 w-4" aria-hidden />
              استعرض الاختبارات المتاحة
            </Button>
          )}
        </div>
      </section>

      {/* stats */}
      <section aria-label="نظرة عامة على الأداء">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={BookOpenCheck}
            label="اختبارات متاحة"
            value={counts.available}
            hint={counts.inProgress ? `${counts.inProgress} قيد التنفيذ` : undefined}
          />
          <StatCard
            icon={CalendarClock}
            label="اختبارات قادمة"
            value={counts.upcoming}
            tone="gold"
          />
          <StatCard
            icon={ClipboardList}
            label="اختبارات مكتملة"
            value={counts.completed}
            hint={counts.passed ? `اجتزت ${counts.passed} منها` : undefined}
          />
          <StatCard
            icon={Percent}
            label="متوسط الدرجات"
            value={data.avgPercentage != null ? `${data.avgPercentage}%` : "—"}
            tone="gold"
            hint={data.avgPercentage == null ? "لا توجد نتائج بعد" : undefined}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* quick access to exams */}
        <section className="lg:col-span-2 space-y-4" aria-label="وصول سريع">
          <div className="flex items-center justify-between">
            <h2 className="text-xl">اختباراتك المتاحة</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/exams")}>
              عرض الكل
              <ArrowLeft className="ms-1 h-4 w-4" aria-hidden />
            </Button>
          </div>
          {data.availableExams.length === 0 ? (
            <EmptyState
              icon={Library}
              title="لا توجد اختبارات متاحة حاليًا"
              description="عندما تنشر الإدارة اختبارًا جديدًا سيظهر هنا مباشرة."
              action={
                <Button variant="outline" size="sm" onClick={() => navigate("/exams")}>
                  تصفح كل الاختبارات
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.availableExams.map((e) => (
                <button
                  key={e.id}
                  onClick={() => navigate(`/exams/${e.id}`)}
                  className="ilo-card ilo-card-hover p-4 text-start cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[hsl(var(--ilo-primary-c))]">
                      {e.subject}
                    </span>
                    <span className="ilo-pill bg-secondary text-secondary-foreground">
                      {difficultyLabel[e.difficulty]}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base leading-snug">{e.title}</h3>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Timer className="h-3.5 w-3.5" aria-hidden />
                    {e.durationMinutes} دقيقة
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* upcoming */}
          {data.upcomingExams.length > 0 && (
            <>
              <h2 className="pt-2 text-xl">اختبارات قادمة</h2>
              <div className="ilo-card divide-y">
                {data.upcomingExams.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 p-4">
                    <CalendarClock className="h-5 w-5 shrink-0 text-[hsl(var(--ilo-gold-d))]" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">{e.subject}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      يبدأ {formatDateTime(e.startsAt)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* side column: recent results + subject progress */}
        <div className="space-y-6">
          <section aria-label="أحدث النتائج">
            <h2 className="mb-4 text-xl">أحدث النتائج</h2>
            {data.recentResults.length === 0 ? (
              <div className="ilo-card p-5 text-sm text-muted-foreground">
                لم تُسلّم أي اختبار بعد — ستظهر نتائجك هنا.
              </div>
            ) : (
              <div className="ilo-card divide-y">
                {data.recentResults.map((r) => (
                  <Link
                    key={r.attemptId}
                    to={`/results/${r.attemptId}`}
                    className="flex items-center gap-3 p-4 transition-colors hover:bg-secondary/60"
                  >
                    {r.passed === true ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-[hsl(var(--ilo-primary-c))]" aria-hidden />
                    ) : (
                      <ClipboardList className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.subject}</p>
                    </div>
                    <span
                      className={`font-display text-lg font-bold ${
                        r.passed === false ? "text-destructive" : "text-[hsl(var(--ilo-primary-c))]"
                      }`}
                    >
                      {r.percentage != null ? `${Math.round(r.percentage)}%` : "—"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section aria-label="التقدم حسب المادة">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[hsl(var(--ilo-primary-c))]" aria-hidden />
              <h2 className="text-xl">التقدم حسب المادة</h2>
            </div>
            {data.subjectProgress.length === 0 ? (
              <div className="ilo-card p-5 text-sm text-muted-foreground">
                {!hasActivity
                  ? "ابدأ أول اختبار لك لتبدأ رحلة تتبع التقدم."
                  : "لا توجد بيانات كافية بعد."}
              </div>
            ) : (
              <div className="ilo-card space-y-4 p-5">
                {data.subjectProgress.map((s) => (
                  <div key={s.subject}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium">{s.subject}</span>
                      <span className="text-muted-foreground">
                        {s.average}% · {s.attempts} محاولة
                      </span>
                    </div>
                    <Progress value={s.average} className="h-2" />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
