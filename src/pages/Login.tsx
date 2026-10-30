import { Button } from "@/components/ui/button";
import { GraduationCap, ShieldCheck, TimerReset, TrendingUp } from "lucide-react";

function getOAuthUrl() {
  const kimiAuthUrl = import.meta.env.VITE_KIMI_AUTH_URL;
  const appID = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${kimiAuthUrl}/api/oauth/authorize`);
  url.searchParams.set("client_id", appID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "profile");
  url.searchParams.set("state", state);

  return url.toString();
}

export default function Login() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[hsl(var(--ilo-primary))] p-10 text-[hsl(var(--ilo-ivory))] lg:flex">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 80% 20%, hsl(46 65% 52%) 0, transparent 45%), radial-gradient(circle at 15% 85%, hsl(46 65% 52%) 0, transparent 40%)",
          }}
          aria-hidden
        />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
            <GraduationCap className="h-6 w-6 text-[hsl(var(--ilo-gold))]" aria-hidden />
          </span>
          <div>
            <p className="font-display text-xl font-bold">آيلوجيا</p>
            <p className="text-xs text-white/70">منصة الاختبارات الإلكترونية</p>
          </div>
        </div>

        <div className="relative space-y-8">
          <h1 className="font-display text-4xl font-bold leading-snug text-white">
            اختبارات آمنة،
            <br />
            ونتائج تستحق الثقة.
          </h1>
          <ul className="space-y-5">
            <Feature
              icon={TimerReset}
              title="مؤقت يُدار من الخادم"
              hint="لا يمكن تمديد الوقت من المتصفح — التسليم التلقائي مضمون."
            />
            <Feature
              icon={ShieldCheck}
              title="تصحيح موثّق"
              hint="تُحتسب الدرجات على الخادم فقط، ومفاتيح الإجابة محمية دائمًا."
            />
            <Feature
              icon={TrendingUp}
              title="تتبع تقدمك"
              hint="تحليلات حقيقية لأدائك في كل مادة عبر الزمن."
            />
          </ul>
        </div>

        <p className="relative text-xs text-white/60">exams.ilogia-eg.com</p>
      </div>

      {/* login form */}
      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--ilo-primary))]">
              <GraduationCap className="h-6 w-6 text-[hsl(var(--ilo-gold))]" aria-hidden />
            </span>
            <div>
              <p className="font-display text-xl font-bold">آيلوجيا</p>
              <p className="text-xs text-muted-foreground">منصة الاختبارات الإلكترونية</p>
            </div>
          </div>

          <h2 className="text-2xl">تسجيل الدخول</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            سجّل الدخول للوصول إلى اختباراتك ونتائجك وتقارير أدائك الدراسي.
          </p>
          <Button
            size="lg"
            className="mt-8 w-full"
            onClick={() => {
              window.location.href = getOAuthUrl();
            }}
          >
            المتابعة وتسجيل الدخول
          </Button>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            بدخولك أنت توافق على قواعد الاختبارات وسياسة الخصوصية الخاصة بالمنصة.
          </p>
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
}) {
  return (
    <li className="flex items-start gap-4">
      <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
        <Icon className="h-5 w-5 text-[hsl(var(--ilo-gold))]" aria-hidden />
      </span>
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="text-sm text-white/70">{hint}</p>
      </div>
    </li>
  );
}
