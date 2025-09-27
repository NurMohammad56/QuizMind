import express from "express";

import authRoute from "../route/auth.route.js";
import userRoute from "../route/user.route.js";
import lessonRoute from "../route/lesson.route.js";

const router = express.Router();

// Mounting the routes
router.use("/auth", authRoute);
router.use("/user", userRoute);
router.use("/lesson", lessonRoute);

export default router;
