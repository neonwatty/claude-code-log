import { Router } from "express";
import sessionsRouter from "./sessions";
import projectsRouter from "./projects";
import exportRouter from "./export";

const router = Router();

// Mount route handlers
router.use("/sessions", sessionsRouter);
router.use("/projects", projectsRouter);
router.use("/export", exportRouter);

// Default API route
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Claude Code Log API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    endpoints: {
      sessions: {
        list: "GET /api/sessions",
        detail: "GET /api/sessions/:id",
        continue: "POST /api/sessions/continue",
      },
      projects: {
        list: "GET /api/projects",
        detail: "GET /api/projects/:path",
      },
      export: {
        create: "POST /api/export",
        status: "GET /api/export/:exportId",
        download: "GET /api/export/:exportId/download",
        metrics: "GET /api/export/metrics",
        cleanup: "POST /api/export/cleanup",
      },
    },
  });
});

export default router;
