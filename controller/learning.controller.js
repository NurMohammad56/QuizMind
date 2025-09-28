import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { generateDailyLesson } from "../utils/aiLessonGenerator.js";
import { generatePersonalizedLearningPlan } from "../utils/aiLearningPlanner.js";
import { User } from "../model/user.model.js";
import AppError from "../errors/AppError.js";
import httpStatus from "http-status";

export const calibrateProficiency = catchAsync(async (req, res) => {
  const { skillLevel, desiredLevel } = req.body;
  const user = await User.findById(req.user.id);

  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  user.profile.skillLevel = skillLevel || "beginner";
  user.profile.desiredLevel = desiredLevel || "improve_little";
  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Proficiency calibrated successfully",
    data: { skillLevel, desiredLevel },
  });
});

export const getLearningPlan = catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user.learningJourney.currentCourse) {
    const learningPlan = await generatePersonalizedLearningPlan(user.profile);
    user.learningJourney.currentCourse = {
      title: learningPlan.courseTitle,
      duration: learningPlan.duration,
      focusArea: learningPlan.focusArea,
    };
    user.learningJourney.totalDays = learningPlan.duration;
    await user.save();
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Your learning plan is ready!",
    data: {
      courseTitle: user.learningJourney.currentCourse.title,
      modules: learningPlan.learningObjectives.map(
        (obj, index) => `${index + 1}. ${obj}`
      ),
      duration: user.learningJourney.totalDays,
    },
  });
});

export const updateLearningPlan = catchAsync(async (req, res) => {
  const { focusArea, duration } = req.body;
  const user = await User.findById(req.user.id);

  const newLearningPlan = await generatePersonalizedLearningPlan(
    user.profile,
    focusArea,
    duration
  );
  user.learningJourney.currentCourse = {
    title: newLearningPlan.courseTitle,
    duration: newLearningPlan.duration,
    focusArea: newLearningPlan.focusArea,
  };
  user.learningJourney.totalDays = newLearningPlan.duration;
  user.learningJourney.currentDay = 1;
  user.learningJourney.completedDays = [];
  user.learningJourney.streak = 0;
  user.learningJourney.totalScore = 0;
  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Learning plan updated successfully",
    data: newLearningPlan,
  });
});

export const getDashboard = catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const completedDays = user.learningJourney.completedDays.length;
  const totalScore = user.learningJourney.totalScore || 0;
  const averageScore =
    completedDays > 0 ? Math.round(totalScore / completedDays) : 0;
  const rating = completedDays > 0 ? (averageScore / 20).toFixed(1) : "0.0"; // Scale to 5
  const trend =
    completedDays > 1
      ? user.learningJourney.completedDays[completedDays - 1].score >
        user.learningJourney.completedDays[completedDays - 2].score
        ? "Trending Up"
        : "Trending Down"
      : "Stable";

  const now = new Date();
  const nextLessonTime = getNextLessonTime(now);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    data: {
      courseName: user.learningJourney.currentCourse?.title || "No Course",
      averageScore,
      rating: `${rating} / 5`,
      trend,
      lessonsCompleted: completedDays,
      nextLessonTime,
    },
  });
});

export const getTodaysLesson = catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const now = new Date();
  const lastLessonDate = user.learningJourney.lastLessonDate
    ? new Date(user.learningJourney.lastLessonDate)
    : null;
  const lastAccessDay = lastLessonDate ? new Date(lastLessonDate) : new Date(0);
  lastAccessDay.setHours(0, 0, 0, 0);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (!lastLessonDate || today > lastAccessDay) {
    if (lastLessonDate && (today - lastAccessDay) / (1000 * 60 * 60 * 24) > 1) {
      user.learningJourney.streak = 0;
    }
    if (user.learningJourney.currentDay >= user.learningJourney.totalDays) {
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Course completed!",
        data: { courseCompleted: true },
      });
    }
    user.learningJourney.currentDay = user.learningJourney.currentDay + 1 || 1;
    user.learningJourney.lastLessonDate = now;
    await user.save();
  }

  const dailyLesson = await generateDailyLesson({
    userProfile: user.profile,
    currentDay: user.learningJourney.currentDay,
    totalDays: user.learningJourney.totalDays,
    previousDays: user.learningJourney.completedDays,
    language: user.preferences.language,
    learningPace: user.preferences.learningPace,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    data: {
      todaysGoal: `Today's Goal: ${dailyLesson.title}`,
      lesson: dailyLesson,
      progress: {
        currentDay: user.learningJourney.currentDay,
        totalDays: user.learningJourney.totalDays,
        completedDays: user.learningJourney.completedDays.length,
      },
    },
  });
});

export const completeLesson = catchAsync(async (req, res) => {
  const { answers, timeSpent, lessonContent } = req.body;
  const user = await User.findById(req.user.id);

  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const scoreResult = calculateScore(answers);

  user.learningJourney.completedDays.push({
    day: user.learningJourney.currentDay,
    completedAt: new Date(),
    lessonContent,
    score: scoreResult.percentage,
    correctAnswers: scoreResult.correctAnswers,
    totalQuestions: scoreResult.totalQuestions,
  });

  user.learningJourney.totalScore += scoreResult.percentage;
  await updateUserStreak(user);
  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Lesson completed successfully!",
    data: {
      score: `${scoreResult.correctAnswers}/${scoreResult.totalQuestions}`,
      percentage: scoreResult.percentage,
      streak: user.learningJourney.streak,
      totalScore: user.learningJourney.totalScore,
    },
  });
});

const calculateScore = (answers) => {
  if (!answers || !Array.isArray(answers))
    return { correctAnswers: 0, totalQuestions: 0, percentage: 0 };
  const totalQuestions = answers.length;
  const correctAnswers = answers.filter((a) => a.isCorrect).length;
  const percentage =
    totalQuestions > 0
      ? Math.round((correctAnswers / totalQuestions) * 100)
      : 0;
  return { correctAnswers, totalQuestions, percentage };
};

const updateUserStreak = async (user) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastCompletion = user.learningJourney.lastLessonDate
    ? new Date(user.learningJourney.lastLessonDate)
    : new Date(0);
  lastCompletion.setHours(0, 0, 0, 0);
  const dayDiff = Math.floor((today - lastCompletion) / (1000 * 60 * 60 * 24));
  if (dayDiff === 1) user.learningJourney.streak += 1;
  else if (dayDiff > 1) user.learningJourney.streak = 1;
};

const getNextLessonTime = (now = new Date()) => {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const timeUntilNextLesson = tomorrow.getTime() - now.getTime();
  const hours = Math.floor(timeUntilNextLesson / (1000 * 60 * 60));
  const minutes = Math.floor(
    (timeUntilNextLesson % (1000 * 60 * 60)) / (1000 * 60)
  );
  return { hours, minutes, nextAvailable: tomorrow.toISOString() };
};
