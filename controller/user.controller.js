import httpStatus from "http-status";
import { User } from "../model/user.model.js";
import AppError from "../errors/AppError.js";
import sendResponse from "../utils/sendResponse.js";
import catchAsync from "../utils/catchAsync.js";

export const getMe = catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id).populate(
    "learningProgress.completedLessons.lessonId"
  );

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Current user retrieved successfully",
    data: user,
  });
});

export const updateProfile = catchAsync(async (req, res) => {
  const { skillLevel, desiredLevel, ageGroup, mainSkills, goals, growthAreas } =
    req.body;

  const user = await User.findByIdAndUpdate(
    req.user.id,
    {
      $set: {
        "profile.skillLevel": skillLevel,
        "profile.desiredLevel": desiredLevel,
        "profile.ageGroup": ageGroup,
        "profile.mainSkills": mainSkills,
        "profile.goals": goals,
        "profile.growthAreas": growthAreas,
      },
    },
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User profile updated successfully",
    data: user,
  });
});

export const updateLearningPreferences = catchAsync(async (req, res) => {
  const { dailyReminder, notificationTime, notificationsEnabled } = req.body;

  if (
    dailyReminder === undefined &&
    notificationTime === undefined &&
    notificationsEnabled === undefined
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "At least one preference must be provided"
    );
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        "preferences.dailyReminder": dailyReminder,
        "preferences.notificationTime": notificationTime,
        "preferences.notificationsEnabled": notificationsEnabled,
      },
    },
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Learning preferences updated successfully",
    data: user,
  });
});

// Change user password
export const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password");
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (newPassword !== confirmPassword) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "New password and confirm password do not match"
    );
  }

  if (!(await User.isPasswordMatched(currentPassword, user.password))) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Current password is incorrect"
    );
  }

  user.password = newPassword;
  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password changed successfully",
    data: user,
  });
});
