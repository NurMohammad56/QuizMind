import jwt from "jsonwebtoken";
import httpStatus from "http-status";
import AppError from "../errors/AppError.js";
import { User } from "./../model/user.model.js";

export const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      throw new AppError(httpStatus.UNAUTHORIZED, "Token not found");
    }

    const decoded = await jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Use decoded.id (since that's what you put in the token)
    const user = await User.findById(decoded.id);
    if (!user) {
      throw new AppError(401, "User not found");
    }

    // Check if OTP verification is required and implemented
    if (user.isOTPVerified !== undefined && !user.isOTPVerified) {
      throw new AppError(401, "OTP not verified");
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    if (err.name === "JsonWebTokenError") {
      throw new AppError(401, "Invalid token");
    }
    if (err.name === "TokenExpiredError") {
      throw new AppError(401, "Token expired");
    }
    throw new AppError(401, "Authentication failed");
  }
};

export const isAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    throw new AppError(403, "Access denied. You are not an admin.");
  }
  next();
};

export const isDriver = (req, res, next) => {
  if (req.user?.role !== "driver") {
    throw new AppError(403, "Access denied. You are not a driver.");
  }
  next();
};
