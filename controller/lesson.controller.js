import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { generateDailyLesson } from "../utils/aiLessonGenerator.js";
import { generatePersonalizedLearningPlan } from "../utils/aiLearningPlanner.js";
import { User } from "../model/user.model.js";
import AppError from "../errors/AppError.js";

export const getTodaysLesson = catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) throw new AppError(404, "User not found");

  const now = new Date();
  const lastLessonDate = user.learningJourney.lastLessonDate
    ? new Date(user.learningJourney.lastLessonDate)
    : new Date();
  const lastAccessDay = new Date(lastLessonDate);
  lastAccessDay.setHours(0, 0, 0, 0);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  let currentDay = user.learningJourney.currentDay;

  if (today > lastAccessDay) {
    currentDay += 1;

    if (currentDay > user.learningJourney.totalDays) {
      return sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Course completed! Start a new learning journey.",
        data: { courseCompleted: true },
      });
    }

    user.learningJourney.currentDay = currentDay;
    user.learningJourney.lastLessonDate = now;
    await user.save();
  }

  const dailyLesson = await generateDailyLesson({
    userProfile: user.profile,
    currentDay,
    totalDays: user.learningJourney.totalDays,
    previousDays: user.learningJourney.completedDays,
    language: user.preferences.language,
    learningPace: user.preferences.learningPace,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    data: {
      lesson: dailyLesson,
      progress: {
        currentDay,
        totalDays: user.learningJourney.totalDays,
        completedDays: user.learningJourney.completedDays.length,
        streak: user.learningJourney.streak,
        totalScore: user.learningJourney.totalScore,
        nextLessonTime: getNextLessonTime(),
      },
    },
  });
});

export const completeLesson = catchAsync(async (req, res) => {
  const { answers, timeSpent, feedback, lessonContent } = req.body;
  const user = await User.findById(req.user.id);
  if (!user) throw new AppError(404, "User not found");

  const currentDay = user.learningJourney.currentDay;
  const scoreResult = calculateScore(answers);

  user.learningJourney.completedDays.push({
    day: currentDay,
    completedAt: new Date(),
    lessonContent,
    score: scoreResult.percentage,
    correctAnswers: scoreResult.correctAnswers,
    totalQuestions: scoreResult.totalQuestions,
    timeSpent: timeSpent || 0,
    feedback: feedback || "",
  });

  user.learningJourney.totalScore += scoreResult.percentage;
  await updateUserStreak(user);
  user.learningJourney.lastLessonDate = new Date();
  await user.save();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Lesson completed successfully!",
    data: {
      score: `${scoreResult.correctAnswers}/${scoreResult.totalQuestions}`,
      percentage: scoreResult.percentage,
      correctAnswers: scoreResult.correctAnswers,
      totalQuestions: scoreResult.totalQuestions,
      streak: user.learningJourney.streak,
      totalScore: user.learningJourney.totalScore,
      nextLessonTime: getNextLessonTime(),
    },
  });
});

export const getLearningProgress = catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new AppError(404, "User not found");

  const progress = {
    currentDay: user.learningJourney.currentDay,
    totalDays: user.learningJourney.totalDays,
    completedDays: user.learningJourney.completedDays.length,
    streak: user.learningJourney.streak,
    totalScore: user.learningJourney.totalScore,
    courseTitle: user.learningJourney.currentCourse?.title,
    focusArea: user.learningJourney.currentCourse?.focusArea,
  };

  sendResponse(res, {
    statusCode: 200,
    success: true,
    data: progress,
  });
});

export const generateNewCourse = catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);
  const { focusArea, duration } = req.body;

  const newLearningPlan = await generatePersonalizedLearningPlan(
    user.profile,
    focusArea,
    duration
  );

  user.learningJourney = {
    currentCourse: {
      title: newLearningPlan.courseTitle,
      duration: newLearningPlan.duration,
      focusArea: newLearningPlan.focusArea,
    },
    currentDay: 1,
    totalDays: newLearningPlan.duration,
    completedDays: [],
    streak: 0,
    totalScore: 0,
  };
  await user.save();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "New learning journey created successfully!",
    data: newLearningPlan,
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
      : 100;

  return { correctAnswers, totalQuestions, percentage };
};

const updateUserStreak = async (user) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastCompletion = user.learningJourney.lastLessonDate
    ? new Date(user.learningJourney.lastLessonDate)
    : new Date();
  lastCompletion.setHours(0, 0, 0, 0);

  const dayDiff = Math.floor((today - lastCompletion) / (1000 * 60 * 60 * 24));

  if (dayDiff === 1) user.learningJourney.streak += 1;
  else if (dayDiff > 1 || user.learningJourney.streak === 0)
    user.learningJourney.streak = 1;
};

const getNextLessonTime = () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const timeUntilNextLesson = tomorrow.getTime() - now.getTime();
  const hours = Math.floor(timeUntilNextLesson / (1000 * 60 * 60));
  const minutes = Math.floor(
    (timeUntilNextLesson % (1000 * 60 * 60)) / (1000 * 60)
  );

  return {
    hours,
    minutes,
    totalMilliseconds: timeUntilNextLesson,
    nextAvailable: tomorrow,
  };
};
