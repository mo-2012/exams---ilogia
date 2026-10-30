import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { LOGIN_PATH } from "@/const";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  GraduationCap,
  History,
  LayoutDashboard,
  Library,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";

const navItems = [
  { to: "/", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/exams", label: "الاختبارات", icon: Library },
  { to: "/history", label: "السجل", icon: History },
  { to: "/analytics", label: "التحليلات", icon: BarChart3 },
  { to: "/profile", label: "ملفي", icon: UserRound },
];

export default function AppLayout() {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-dvh">
        <div className="border-b bg-card">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-5 w-40" />
          </div>
        </div>
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-8">
          <Skeleton className="h-8 w-56" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4">
        <Brand />
        <div className="ilo-card w-full max-w-md p-8 text-center">
          <h1 className="text-xl">منصة آيلوجيا للاختبارات</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            سجّل الدخول للوصول إلى اختباراتك ونتائجك وتقارير أدائك.
          </p>
          <Button
            size="lg"
            className="mt-6 w-full"
            onClick={() => (window.location.href = LOGIN_PATH)}
          >
            تسجيل الدخول
          </Button>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === "admin";
  // the exam room is distraction-free: no chrome at all
  const inExamRoom = location.pathname.startsWith("/exam/");

  if (inExamRoom) return <Outlet />;

  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <button
            onClick={() => navigate("/")}
            className="shrink-0 cursor-pointer"
            aria-label="الصفحة الرئيسية"
          >
            <Brand />
          </button>

          <nav className="ms-6 hidden items-center gap-1 md:flex" aria-label="التنقل الرئيسي">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-[hsl(var(--ilo-primary-d))]"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )
                }
              >
                <item.icon className="h-4 w-4" aria-hidden />
                {item.label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[hsl(var(--ilo-gold-t))] text-[hsl(var(--ilo-gold-d))]"
                      : "text-[hsl(var(--ilo-gold-d))] hover:bg-[hsl(var(--ilo-gold-t))]",
                  )
                }
              >
                <ShieldCheck className="h-4 w-4" aria-hidden />
                الإدارة
              </NavLink>
            )}
          </nav>

          <div className="ms-auto flex items-center gap-2">
            {isAdmin && (
              <span className="ilo-pill bg-[hsl(var(--ilo-gold-t))] text-[hsl(var(--ilo-gold-d))] hidden sm:inline-flex">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                مسؤول
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-secondary focus-visible:outline-none"
                  aria-label="قائمة المستخدم"
                >
                  <Avatar className="h-9 w-9 border">
                    <AvatarFallback className="bg-[hsl(var(--ilo-primary-c))] text-white text-sm font-semibold">
                      {(user.name || "ط").trim().charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="font-semibold">{user.name || "طالب"}</p>
                  <p className="text-xs font-normal text-muted-foreground" dir="ltr">
                    {user.email || ""}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
                  <UserRound className="me-2 h-4 w-4" />
                  الملف الشخصي
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate("/admin")} className="cursor-pointer">
                    <ShieldCheck className="me-2 h-4 w-4" />
                    لوحة الإدارة
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="me-2 h-4 w-4" />
                  تسجيل الخروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8">
        <Outlet />
      </main>

      {/* mobile bottom navigation — dedicated mobile experience, not a shrunk desktop bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="التنقل السفلي"
      >
        <div className="grid grid-cols-5">
          {navItems.map((item) => {
            const active =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            return (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active
                    ? "text-[hsl(var(--ilo-primary-c))]"
                    : "text-muted-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <item.icon className="h-5 w-5" aria-hidden />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--ilo-primary))]">
        <GraduationCap className="h-5 w-5 text-[hsl(var(--ilo-gold))]" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-lg font-bold">آيلوجيا</span>
        <span className="block text-[11px] font-medium tracking-wide text-[hsl(var(--ilo-gold-d))]">
          منصة الاختبارات
        </span>
      </span>
    </span>
  );
}
