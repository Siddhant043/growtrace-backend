import { Router } from "express";

import analyticsRouter from "./analytics";
import authRouter from "./auth";
import linkRouter from "./link";
import userRouter from "./users";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/links", linkRouter);
apiRouter.use("/analytics", analyticsRouter);

export default apiRouter;
