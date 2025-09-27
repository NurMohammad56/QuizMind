import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import AppError from "../errors/AppError.js";
import { User } from "../model/user.model.js";
import { generatePersonalizedLearningPlan } from "../utils/aiLearningPlanner.js";

// Generate Access & Refresh Tokens
const generateTokens = (user) => {
  const payload = { id: user._id, email: user.email, role: user.role };

  const accessToken = createToken(
    payload,
    process.env.JWT_ACCESS_SECRET,
    process.env.JWT_ACCESS_EXPIRES_IN
  );

  const refreshToken = createToken(
    payload,
    process.env.JWT_REFRESH_SECRET,
    process.env.JWT_REFRESH_EXPIRES_IN
  );

  return { accessToken, refreshToken };
};

export const register = catchAsync(async (req, res) => {
  const { email, password, profile } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    throw new AppError(httpStatus.BAD_REQUEST, "User already exists");
  }

  const user = await User.create({ email, password, profile });

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
        email: user.email,
        profile: user.profile,
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
  if (!user || !(await user.correctPassword(password, user.password))) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid credentials");
  }

  const { accessToken, refreshToken } = generateTokens(user);

  user.refreshToken = refreshToken;
  user.lastLogin = Date.now();
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
        email: user.email,
        profile: user.profile,
      },
    },
  });
});

export const getMe = catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    data: user,
  });
});

export const updateProfile = catchAsync(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $set: { profile: req.body } },
    { new: true, runValidators: true }
  );

  if (req.body.skillLevel || req.body.goals || req.body.growthAreas) {
    const newLearningPlan = await generatePersonalizedLearningPlan(
      user.profile
    );
    user.learningJourney.currentCourse = {
      title: newLearningPlan.courseTitle,
      duration: newLearningPlan.duration,
      focusArea: newLearningPlan.focusArea,
    };
    user.learningJourney.totalDays = newLearningPlan.duration;
    await user.save();
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile updated successfully",
    data: user,
  });
});
