import express from "express";
import {
  getMe,
  updateProfile,
  changePassword,
  updateLearningPreferences,
} from "../controller/user.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/me", protect, getMe);
router.patch("/profile", protect, updateProfile);
router.put("/preferences", protect, updateLearningPreferences);
router.post("/change-password", protect, changePassword);

export default router;
