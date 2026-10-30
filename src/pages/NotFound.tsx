import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";
import { useNavigate } from "react-router";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <Compass className="h-12 w-12 text-[hsl(var(--ilo-primary-c))]" aria-hidden />
      <h1 className="text-2xl">الصفحة غير موجودة</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        الرابط الذي تبحث عنه غير متاح — ربما تغيّر العنوان أو حُذفت الصفحة.
      </p>
      <Button onClick={() => navigate("/")}>العودة للرئيسية</Button>
    </div>
  );
}
