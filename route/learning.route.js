import express from "express";
import {
  calibrateProficiency,
  getLearningPlan,
  updateLearningPlan,
  getDashboard,
  getTodaysLesson,
  completeLesson,
} from "../controller/learning.controller.js";

import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/calibrate-proficiency", protect, calibrateProficiency);
router.get("/learning-plan", protect, getLearningPlan);
router.post("/update-learning-plan", protect, updateLearningPlan);
router.get("/dashboard", protect, getDashboard);
router.get("/todays-lesson", protect, getTodaysLesson);
router.post("/complete-lesson", protect, completeLesson);

export default router;
