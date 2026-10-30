import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import { EmptyState, PageHeader, StatCard } from "@/components/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Award,
  BookOpenCheck,
  ClipboardList,
  Medal,
  Percent,
  ShieldCheck,
  Target,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router";

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading } = trpc.exams.dashboard.useQuery();

  return (
    <div className="space-y-8">
      <PageHeader title="الملف الشخصي" description="معلوماتك وإحصاءاتك الدراسية على المنصة." />

      {/* identity */}
      <div className="ilo-card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
        <Avatar className="h-16 w-16 border-2 border-[hsl(var(--ilo-gold))]">
          <AvatarFallback className="bg-[hsl(var(--ilo-primary-c))] text-2xl font-bold text-white">
            {(user?.name || "ط").trim().charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-xl">
            {user?.name || "طالب"}
            {user?.role === "admin" && (
              <span className="ilo-pill bg-[hsl(var(--ilo-gold-t))] text-[hsl(var(--ilo-gold-d))]">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                مسؤول
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground" dir="ltr">
            {user?.email || ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            <UserRound className="me-1 inline h-3.5 w-3.5" aria-hidden />
            بياناتك ظاهرة لك فقط ولإدارة المنصة — نحترم خصوصيتك.
          </p>
        </div>
      </div>

      {/* stats */}
      {isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={BookOpenCheck} label="اختبارات مكتملة" value={data.counts.completed} />
            <StatCard icon={Percent} label="متوسط الدرجات" value={data.avgPercentage != null ? `${data.avgPercentage}%` : "—"} />
            <StatCard icon={Target} label="اختبارات مجتازة" value={data.counts.passed} tone="gold" />
            <StatCard icon={Award} label="مواد متقدم فيها" value={data.subjectProgress.filter((s) => s.average >= 75).length} />
          </div>

          {/* achievements */}
          <section className="ilo-card p-6" aria-label="الإنجازات">
            <h2 className="mb-4 flex items-center gap-2 text-lg">
              <Medal className="h-5 w-5 text-[hsl(var(--ilo-gold-d))]" aria-hidden />
              الإنجازات
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Achievement
                unlocked={data.counts.completed >= 1}
                title="الخطوة الأولى"
                hint="أكمل أول اختبار"
              />
              <Achievement
                unlocked={data.counts.completed >= 5}
                title="مثابر"
                hint="أكمل 5 اختبارات"
                progress={Math.min(1, data.counts.completed / 5)}
              />
              <Achievement
                unlocked={(data.avgPercentage ?? 0) >= 90}
                title="متفوق"
                hint="حافظ على متوسط 90%+"
                progress={Math.min(1, (data.avgPercentage ?? 0) / 90)}
              />
            </div>
          </section>

          {/* subject progress */}
          <section className="ilo-card p-6" aria-label="تقدم المواد">
            <h2 className="mb-4 text-lg">تقدمك في المواد</h2>
            {data.subjectProgress.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="لا توجد بيانات بعد"
                description="أكمل اختبارات لعرض تقدمك في كل مادة."
                action={<Button onClick={() => navigate("/exams")}>تصفح الاختبارات</Button>}
              />
            ) : (
              <div className="space-y-4">
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
        </>
      )}
    </div>
  );
}

function Achievement({
  unlocked,
  title,
  hint,
  progress,
}: {
  unlocked: boolean;
  title: string;
  hint: string;
  progress?: number;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        unlocked ? "border-[hsl(var(--ilo-gold))] bg-[hsl(var(--ilo-gold-t))]" : "bg-secondary/50 opacity-70"
      }`}
    >
      <p className="flex items-center gap-2 font-semibold">
        <Medal
          className={`h-5 w-5 ${unlocked ? "text-[hsl(var(--ilo-gold-d))]" : "text-muted-foreground"}`}
          aria-hidden
        />
        {title}
        {unlocked && <span className="ilo-pill bg-[hsl(var(--ilo-gold))] text-[hsl(var(--ilo-ink))]">مُحقق</span>}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      {!unlocked && progress != null && <Progress value={progress * 100} className="mt-2 h-1.5" />}
    </div>
  );
}
