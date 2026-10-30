import { authRouter } from "./auth-router";
import { examsRouter } from "./exams-router";
import { adminRouter } from "./admin-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  exams: examsRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
