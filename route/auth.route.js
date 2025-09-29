import express from "express";
import {
  register,
  login,
  refreshToken,
  resetPassword,
  verifyOtp,
  forgotPassword,
  logout,
} from "../controller/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);
router.post("/logout", protect, logout);
router.post("/refresh-token", refreshToken);

export default router;
