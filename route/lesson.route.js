// routes/lessons.js
import express from "express";
import {
  getTodaysLesson,
  completeLesson,
  getLearningProgress,
  generateNewCourse,
} from "../controller/lesson.controller.js";

import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/today", protect, getTodaysLesson);
router.post("/complete", protect, completeLesson);
router.get("/progress", protect, getLearningProgress);
router.post("/new-course", protect, generateNewCourse);

export default router;
