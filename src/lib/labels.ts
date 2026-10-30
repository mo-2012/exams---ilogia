// Arabic labels & formatters shared across the app (Arabic-first UI).

export const difficultyLabel: Record<string, string> = {
  easy: "سهل",
  medium: "متوسط",
  hard: "صعب",
};

export const difficultyTone: Record<string, string> = {
  easy: "bg-[hsl(var(--ilo-ok-bg))] text-[hsl(var(--ilo-primary-d))]",
  medium: "bg-[hsl(var(--ilo-gold-t))] text-[hsl(var(--ilo-gold-d))]",
  hard: "bg-[hsl(var(--ilo-err-bg))] text-[hsl(var(--ilo-err))]",
};

export const availabilityLabel: Record<string, string> = {
  available: "متاح الآن",
  upcoming: "قادم",
  in_progress: "جارٍ",
  completed: "مكتمل",
  closed: "مغلق",
};

export const availabilityTone: Record<string, string> = {
  available: "bg-[hsl(var(--ilo-ok-bg))] text-[hsl(var(--ilo-primary-d))]",
  upcoming: "bg-[hsl(var(--ilo-gold-t))] text-[hsl(var(--ilo-gold-d))]",
  in_progress: "bg-[hsl(207_60%_92%)] text-[hsl(207_80%_30%)]",
  completed: "bg-secondary text-secondary-foreground",
  closed: "bg-muted text-muted-foreground",
};

export const attemptStatusLabel: Record<string, string> = {
  in_progress: "قيد التنفيذ",
  submitted: "مُسلَّمة",
  expired: "منتهية بالوقت",
};

export const questionTypeLabel: Record<string, string> = {
  mcq_single: "اختيار واحد",
  mcq_multi: "اختيارات متعددة",
  true_false: "صح أو خطأ",
  text: "سؤال مقالي",
};

export const reviewPolicyLabel: Record<string, string> = {
  immediate: "فور التسليم",
  after_close: "بعد إغلاق الاختبار",
  never: "غير متاحة",
};

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} دقيقة`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} ساعة و${m} دقيقة` : `${h} ساعة`;
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatTimeUsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h} س ${m % 60} د`;
  }
  return s ? `${m} د ${s} ث` : `${m} د`;
}
