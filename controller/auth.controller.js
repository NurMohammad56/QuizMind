import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import AppError from "../errors/AppError.js";
import { User } from "../model/user.model.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmail.js";

// Generate Access & Refresh Tokens
const generateTokens = (user) => {
  const payload = { id: user._id, email: user.email }; // Using 'id' consistently
  const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  });
  return { accessToken, refreshToken };
};

export const register = catchAsync(async (req, res) => {
  const { email, password, profile } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    throw new AppError(httpStatus.BAD_REQUEST, "User already exists");
  }

  const user = await User.create({
    email,
    password,
    profile: { name: profile?.name || "" },
    isOTPVerified: true,
  });

  const { accessToken, refreshToken } = generateTokens(user);
  user.refreshToken = refreshToken;
  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "User registered successfully",
    data: {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email,
        profile: user.profile,
        role: user.role,
      },
    },
  });
});

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Please provide email and password"
    );
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.correctPassword(password))) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid credentials");
  }

  const { accessToken, refreshToken } = generateTokens(user);
  user.refreshToken = refreshToken;
  user.lastLogin = new Date();
  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User logged in successfully",
    data: {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email,
        profile: user.profile,
        role: user.role,
      },
    },
  });
});

export const logout = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  user.refreshToken = null;
  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User logged out successfully",
  });
});

export const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    throw new AppError(httpStatus.BAD_REQUEST, "Email is required");
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  user.resetPasswordOTP = otp;
  user.resetPasswordOTPExpiry = Date.now() + 10 * 60 * 1000;
  user.resetPasswordVerified = false;
  await user.save({ validateBeforeSave: false });

  sendEmail(user.email, "Reset Password", `Your OTP is ${otp}`);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "OTP sent to email",
  });
});

export const verifyOtp = catchAsync(async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    throw new AppError(httpStatus.BAD_REQUEST, "Email and OTP required");
  }

  const user = await User.findOne({ email }).select(
    "+resetPasswordOTP +resetPasswordOTPExpiry"
  );
  if (
    !user ||
    user.resetPasswordOTP !== otp ||
    user.resetPasswordOTPExpiry < Date.now()
  ) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
  }

  user.resetPasswordVerified = true;
  await user.save({ validateBeforeSave: false });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "OTP verified successfully",
  });
});

export const resetPassword = catchAsync(async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Email and new password required"
    );
  }

  const user = await User.findOne({ email }).select(
    "+resetPasswordVerified +password"
  );
  if (!user || !user.resetPasswordVerified) {
    throw new AppError(httpStatus.BAD_REQUEST, "OTP not verified");
  }

  user.password = newPassword;
  user.resetPasswordOTP = undefined;
  user.resetPasswordOTPExpiry = undefined;
  user.resetPasswordVerified = false;

  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password reset successful",
  });
});

export const setupProfile = catchAsync(async (req, res) => {
  const {
    name,
    profession,
    ageGroup,
    mainSkills,
    goals,
    growthAreas,
    skillLevel,
    desiredLevel,
  } = req.body;

  if (!req.user || !req.user._id)
    throw new AppError(httpStatus.UNAUTHORIZED, "User not authenticated");

  const user = await User.findById(req.user._id);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const processedMainSkills = [];
  if (mainSkills && Array.isArray(mainSkills)) {
    for (const skillObj of mainSkills) {
      if (typeof skillObj === "object" && skillObj.skill) {
        let skillValue = skillObj.skill;
        if (Array.isArray(skillValue)) skillValue = skillValue.join("");
        if (
          ![
            "strategic_vision",
            "user_engineering",
            "leadership",
            "technical_mastery",
            "measurement",
          ].includes(skillValue)
        ) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            `Invalid skill: ${skillValue}`
          );
        }
        processedMainSkills.push({
          skill: skillValue,
          currentLevel: Math.max(1, Math.min(10, skillObj.currentLevel || 1)),
          desiredLevel: Math.max(1, Math.min(10, skillObj.desiredLevel || 5)),
        });
      }
    }
  }

  user.profile = {
    name: name || user.profile?.name || "",
    profession: profession || user.profile?.profession || "",
    ageGroup: ageGroup || user.profile?.ageGroup || "",
    mainSkills:
      processedMainSkills.length > 0
        ? processedMainSkills
        : user.profile?.mainSkills || [],
    goals: goals || user.profile?.goals || [],
    growthAreas: growthAreas || user.profile?.growthAreas || [],
    skillLevel: skillLevel || user.profile?.skillLevel || "beginner",
    desiredLevel: desiredLevel || user.profile?.desiredLevel || "intermediate",
  };

  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile setup completed successfully",
    data: { user: { id: user._id, profile: user.profile } },
  });
});

// Add refresh token endpoint
export const refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError(httpStatus.BAD_REQUEST, "Refresh token required");
  }

  try {
    const decoded = await jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );
    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      throw new AppError(httpStatus.UNAUTHORIZED, "Invalid refresh token");
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    user.refreshToken = newRefreshToken;
    await user.save();

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Token refreshed successfully",
      data: {
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (err) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid refresh token");
  }
});
