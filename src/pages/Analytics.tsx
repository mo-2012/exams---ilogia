import { trpc } from "@/providers/trpc";
import { EmptyState, PageHeader, StatCard } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/labels";
import {
  Award,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router";

export default function Analytics() {
  const navigate = useNavigate();
  const { data, isLoading } = trpc.exams.analytics.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  // honest analytics: no attempt data -> empty state, never fabricated charts
  if (!data || data.empty) {
    return (
      <div>
        <PageHeader title="التحليلات" description="تحليل أدائك مبني على محاولاتك الحقيقية فقط." />
        <EmptyState
          icon={BarChart3}
          title="لا توجد بيانات كافية بعد"
          description="أكمل اختبارًا واحدًا على الأقل لتظهر هنا تحليلات أدائك ونقاط قوتك وما يحتاج إلى تحسين."
          action={<Button onClick={() => navigate("/exams")}>ابدأ اختبارًا الآن</Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="التحليلات"
        description="كل الأرقام أدناه محسوبة من محاولاتك الفعلية المُسلَّمة."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ClipboardList} label="محاولات مكتملة" value={data.totalAttempts} />
        <StatCard icon={TrendingUp} label="المتوسط العام" value={`${data.overall}%`} />
        <StatCard icon={Award} label="أفضل نتيجة" value={`${Math.round(data.bestPercentage ?? 0)}%`} tone="gold" />
        <StatCard icon={CheckCircle2} label="اختبارات مجتازة" value={data.passedCount} />
      </div>

      {/* score trend */}
      <section className="ilo-card p-6" aria-label="التقدم عبر الزمن">
        <h2 className="text-lg">التقدم عبر الزمن</h2>
        <p className="mb-4 text-sm text-muted-foreground">نسبتك المئوية في كل محاولة مُسلَّمة بالترتيب الزمني.</p>
        <TrendChart points={data.trend.map((t) => ({ label: formatDate(t.date), value: t.percentage, title: t.title }))} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* subject performance */}
        <section className="ilo-card p-6" aria-label="الأداء حسب المادة">
          <h2 className="mb-4 text-lg">الأداء حسب المادة</h2>
          <div className="space-y-4">
            {data.subjectPerformance.map((s) => (
              <div key={s.subject}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium">{s.subject}</span>
                  <span className="text-muted-foreground">
                    {s.average}% · {s.attempts} محاولة · الأفضل {Math.round(s.best)}%
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-[hsl(var(--ilo-primary-c))] transition-[width]"
                    style={{ width: `${Math.min(100, s.average)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* strengths & improvements */}
        <section className="ilo-card p-6" aria-label="نقاط القوة والتحسين">
          <h2 className="mb-4 text-lg">نقاط القوة وما يحتاج تحسينًا</h2>
          <div className="space-y-4">
            <div className="rounded-lg bg-[hsl(var(--ilo-ok-bg))] p-4">
              <p className="flex items-center gap-2 font-semibold text-[hsl(var(--ilo-primary-d))]">
                <TrendingUp className="h-4 w-4" aria-hidden />
                نقاط القوة
              </p>
              {data.strengths.length ? (
                <ul className="mt-2 list-disc space-y-1 pe-5 text-sm">
                  {data.strengths.map((s) => (
                    <li key={s}>{s} — متوسط ≥ 75%</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  لم تصل أي مادة إلى متوسط 75% بعد — استمر!
                </p>
              )}
            </div>
            <div className="rounded-lg bg-[hsl(var(--ilo-err-bg))] p-4">
              <p className="flex items-center gap-2 font-semibold text-destructive">
                <TrendingDown className="h-4 w-4" aria-hidden />
                يحتاج إلى تحسين
              </p>
              {data.improvements.length ? (
                <ul className="mt-2 list-disc space-y-1 pe-5 text-sm">
                  {data.improvements.map((s) => (
                    <li key={s}>{s} — متوسط أقل من 60%</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  لا توجد مواد دون 60% — أداء مستقر.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function TrendChart({
  points,
}: {
  points: Array<{ label: string; value: number; title: string }>;
}) {
  const W = 640;
  const H = 220;
  const PAD = { top: 16, right: 16, bottom: 28, left: 40 };
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const n = points.length;
  const x = (i: number) => PAD.left + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => PAD.top + ih - (Math.min(100, Math.max(0, v)) / 100) * ih;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="min-w-[420px] w-full"
        role="img"
        aria-label="رسم بياني لتطور الدرجات عبر الزمن"
      >
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="hsl(var(--ilo-line))"
              strokeDasharray={v === 0 ? undefined : "3 4"}
            />
            <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="hsl(var(--ilo-mut))">
              {v}%
            </text>
          </g>
        ))}
        {n > 1 && (
          <path d={path} fill="none" stroke="hsl(var(--ilo-primary-c))" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r="4.5" fill="hsl(var(--ilo-gold))" stroke="hsl(var(--ilo-gold-d))" strokeWidth="1.5">
              <title>{`${p.title} — ${p.label}: ${Math.round(p.value)}%`}</title>
            </circle>
            {n <= 10 && (
              <text
                x={x(i)}
                y={H - 8}
                textAnchor="middle"
                fontSize="10"
                fill="hsl(var(--ilo-mut))"
              >
                {i + 1}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
