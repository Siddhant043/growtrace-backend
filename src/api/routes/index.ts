import { Router } from "express";

import analyticsRouter from "./analytics";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import funnelRouter from "./funnel";
import linkRouter from "./link";
import metricsRouter from "./metrics";
import trackRouter from "./track";
import userRouter from "./users";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/links", linkRouter);
apiRouter.use("/analytics", analyticsRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/metrics", metricsRouter);
apiRouter.use("/funnel", funnelRouter);
apiRouter.use("/track", trackRouter);

export default apiRouter;
