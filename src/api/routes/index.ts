import { Router } from "express";

import analyticsRouter from "./analytics";
import attributionRouter from "./attribution";
import audienceRouter from "./audience";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import funnelRouter from "./funnel";
import linkRouter from "./link";
import metricsRouter from "./metrics";
import notificationsRouter from "./notifications";
import paymentsRouter from "./payments";
import reportsRouter from "./reports";
import sessionRouter from "./session";
import trackRouter from "./track";
import userRouter from "./users";
import webhooksRouter from "./webhooks";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/links", linkRouter);
apiRouter.use("/analytics", analyticsRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/metrics", metricsRouter);
apiRouter.use("/funnel", funnelRouter);
apiRouter.use("/sessions", sessionRouter);
apiRouter.use("/reports", reportsRouter);
apiRouter.use("/attribution", attributionRouter);
apiRouter.use("/audience", audienceRouter);
apiRouter.use("/notifications", notificationsRouter);
apiRouter.use("/payments", paymentsRouter);
apiRouter.use("/webhooks", webhooksRouter);
apiRouter.use("/track", trackRouter);

export default apiRouter;
