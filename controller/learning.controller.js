import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { generateDailyLesson } from "../utils/aiLessonGenerator.js";
import { generatePersonalizedLearningPlan } from "../utils/aiLearningPlanner.js";
import { User } from "../model/user.model.js";
import { Lesson } from "../model/lesson.model.js";
import AppError from "../errors/AppError.js";
import httpStatus from "http-status";
import { marked } from "marked";

const updateUserStreak = (user) => {
  const now = new Date();
  const lastLessonDate = user.learningJourney.completedDays.length
    ? new Date(
        user.learningJourney.completedDays[
          user.learningJourney.completedDays.length - 1
        ].completedAt
      )
    : null;
  if (lastLessonDate) {
    const diffDays = Math.floor((now - lastLessonDate) / (1000 * 60 * 60 * 24));
    user.learningJourney.streak =
      diffDays === 1
        ? user.learningJourney.streak + 1
        : diffDays === 0
        ? user.learningJourney.streak
        : 0;
  } else {
    user.learningJourney.streak = 1;
  }
};

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
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  let learningPlan;
  if (
    !user.learningJourney.currentCourse ||
    !user.learningJourney.currentCourse.title
  ) {
    learningPlan = await generatePersonalizedLearningPlan(user.profile);
    user.learningJourney.currentCourse = {
      title: learningPlan.courseTitle,
      duration: learningPlan.duration,
      focusArea: learningPlan.focusArea,
      learningObjectives: learningPlan.learningObjectives,
      dailyStructure: learningPlan.dailyStructure,
    };
    user.learningJourney.totalDays = learningPlan.duration;
    await user.save();
  } else {
    learningPlan = {
      courseTitle: user.learningJourney.currentCourse.title,
      duration: user.learningJourney.currentCourse.duration,
      focusArea: user.learningJourney.currentCourse.focusArea,
      learningObjectives:
        user.learningJourney.currentCourse.learningObjectives || [],
      dailyStructure: user.learningJourney.currentCourse.dailyStructure || {},
    };
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
      dailyStructure: learningPlan.dailyStructure,
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

  let currentDay = user.learningJourney.currentDay;
  let dailyLesson = user.learningJourney.currentLesson;

  if (
    !dailyLesson ||
    !dailyLesson.day ||
    dailyLesson.day !== currentDay ||
    today > lastAccessDay
  ) {
    if (lastLessonDate && (today - lastAccessDay) / (1000 * 60 * 60 * 24) > 1) {
      user.learningJourney.streak = 0;
    }
    user.learningJourney.lastLessonDate = now;
    dailyLesson = await generateDailyLesson({
      userProfile: user.profile,
      currentDay,
      totalDays: user.learningJourney.totalDays,
      previousDays: user.learningJourney.completedDays,
      language: user.preferences.language,
      learningPace: user.preferences.learningPace,
    });
    dailyLesson.content = marked.parse(dailyLesson.content); // Convert Markdown to HTML
    user.learningJourney.currentLesson = dailyLesson;

    await Lesson.create({
      userId: user._id,
      day: currentDay,
      title: dailyLesson.title,
      content: dailyLesson.content,
      imageUrl: dailyLesson.imageUrl,
      mcqs: dailyLesson.mcqs,
      practicalExercise: dailyLesson.practicalExercise,
      keyTakeaways: dailyLesson.keyTakeaways,
      totalDays: dailyLesson.totalDays,
      duration: dailyLesson.duration,
      language: dailyLesson.language,
      generatedAt: dailyLesson.generatedAt,
    });
    await user.save();
  } else {
    dailyLesson.content = marked.parse(dailyLesson.content); // Ensure HTML on reload
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    data: {
      todaysGoal: `Today's Goal: ${dailyLesson.title}`,
      lesson: dailyLesson,
      progress: {
        currentDay,
        totalDays: user.learningJourney.totalDays,
        completedDays: user.learningJourney.completedDays.length,
      },
    },
  });
});

const identifyKnowledgeGaps = (previousDays) => {
  const gapCount = {};
  const validDays = Array.isArray(previousDays)
    ? previousDays.filter((day) => day && Array.isArray(day.quizCompletions))
    : [];
  validDays.forEach((day) => {
    day.quizCompletions.forEach((qc) => {
      if (!qc.isCorrect) {
        const questionSkill = qc.question.includes("strategic")
          ? "strategic_vision"
          : qc.question.includes("engineering")
          ? "user_engineering"
          : qc.question.includes("leadership")
          ? "leadership"
          : qc.question.includes("technical")
          ? "technical_mastery"
          : qc.question.includes("measurement")
          ? "measurement"
          : "unknown";
        gapCount[questionSkill] = (gapCount[questionSkill] || 0) + 1;
      }
    });
  });
  return Object.entries(gapCount)
    .filter(([_, count]) => count > 1)
    .map(([skill]) => skill);
};

export const startLesson = catchAsync(async (req, res) => {
  const { lessonQualityRating } = req.body;
  const user = await User.findById(req.user.id);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  if (
    !lessonQualityRating ||
    lessonQualityRating < 1 ||
    lessonQualityRating > 5
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Rating must be between 1 and 5"
    );
  }

  const currentDayEntry = user.learningJourney.completedDays.find(
    (entry) => entry.day === user.learningJourney.currentDay
  );
  if (!currentDayEntry) {
    user.learningJourney.completedDays.push({
      day: user.learningJourney.currentDay,
      completedAt: new Date(),
      lessonContent: user.learningJourney.currentLesson?.content || "",
      score: 0,
      correctAnswers: 0,
      totalQuestions: 5,
      lessonQualityRating,
      quizCompletions: [],
      knowledgeGaps: identifyKnowledgeGaps(
        user.learningJourney.completedDays.length > 0
          ? [
              user.learningJourney.completedDays[
                user.learningJourney.completedDays.length - 1
              ],
            ]
          : []
      ),
    });
  } else {
    currentDayEntry.lessonQualityRating = lessonQualityRating;
    currentDayEntry.knowledgeGaps = identifyKnowledgeGaps([currentDayEntry]);
  }
  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Lesson started with rating recorded",
    data: { lessonQualityRating, knowledgeGaps: currentDayEntry.knowledgeGaps },
  });
});

export const submitQuiz = catchAsync(async (req, res) => {
  const { quizIndex, selected } = req.body;
  const user = await User.findById(req.user.id);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const currentDayEntry = user.learningJourney.completedDays.find(
    (entry) => entry.day === user.learningJourney.currentDay
  );
  if (!currentDayEntry)
    throw new AppError(httpStatus.BAD_REQUEST, "Lesson not started");

  if (
    currentDayEntry.quizCompletions.some((qc) => qc.quizIndex === quizIndex)
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This quiz has already been submitted"
    );
  }

  const mcq = user.learningJourney.currentLesson.mcqs[quizIndex];
  if (!mcq) throw new AppError(httpStatus.BAD_REQUEST, "Invalid quiz index");

  const validOptions = mcq.options.map(
    (opt, index) => `${String.fromCharCode(65 + index)}. ${opt.trim()}`
  );
  const isValidSelection =
    validOptions.includes(selected.trim()) ||
    mcq.options.includes(selected.trim());
  if (!isValidSelection) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Invalid selection for quiz at index ${quizIndex}. Expected one of: ${validOptions.join(
        ", "
      )}`
    );
  }

  const isCorrect =
    selected.trim() === mcq.correctAnswer.trim() ||
    mcq.options.find(
      (opt, index) =>
        `${String.fromCharCode(65 + index)}. ${opt.trim()}` === selected.trim()
    ) === mcq.correctAnswer.trim();

  currentDayEntry.quizCompletions.push({
    quizIndex,
    selected,
    isCorrect,
    submittedAt: new Date(),
  });
  currentDayEntry.correctAnswers = currentDayEntry.quizCompletions.filter(
    (q) => q.isCorrect
  ).length;
  currentDayEntry.score = Math.round(
    (currentDayEntry.correctAnswers / 5) * 100
  );
  currentDayEntry.knowledgeGaps = identifyKnowledgeGaps([currentDayEntry]);

  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Quiz submitted successfully",
    data: {
      quizIndex,
      selected,
      isCorrect,
      remainingQuizzes: 5 - currentDayEntry.quizCompletions.length,
      knowledgeGaps: currentDayEntry.knowledgeGaps,
    },
  });
});

const getEstimatedLevel = (rating) => {
  if (rating >= 4.5) return "Master's Degree Level";
  if (rating >= 3.5) return "Bachelor's Degree Level";
  if (rating >= 2.5) return "Associate Degree Level";
  return "Beginner Level";
};

export const getDashboard = catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const completedDays = user.learningJourney.completedDays.length;
  const totalScore = user.learningJourney.totalScore || 0;
  const averageScore =
    completedDays > 0 ? Math.round(totalScore / completedDays) : 0;
  const rating = completedDays > 0 ? (averageScore / 20).toFixed(1) : "0.0";
  const estimatedLevel = getEstimatedLevel(rating);
  const trend =
    completedDays > 1
      ? user.learningJourney.completedDays[completedDays - 1].score >
        user.learningJourney.completedDays[completedDays - 2].score
        ? "Trending Up"
        : "Trending Down"
      : "Stable";

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    data: {
      courseName: user.learningJourney.currentCourse?.title || "No Course",
      averageScore,
      rating: `${rating} / 5`,
      estimatedLevel,
      trend,
      lessonsCompleted: completedDays,
      streak: user.learningJourney.streak,
    },
  });
});

const getQuizStatus = (correctAnswers) => {
  switch (correctAnswers) {
    case 0:
      return "Ouch!!";
    case 1:
      return "What Happen?";
    case 2:
      return "Uh huh";
    case 3:
      return "Fair";
    case 4:
      return "Good";
    case 5:
      return "Well done!!";
    default:
      return "Not Attempted";
  }
};

export const completeLesson = catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const currentDayEntry = user.learningJourney.completedDays.find(
    (entry) => entry.day === user.learningJourney.currentDay
  );
  if (!currentDayEntry || currentDayEntry.quizCompletions.length < 5) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "All 5 quizzes must be completed"
    );
  }

  if (
    currentDayEntry.correctAnswers !==
    currentDayEntry.quizCompletions.filter((q) => q.isCorrect).length
  ) {
    currentDayEntry.correctAnswers = currentDayEntry.quizCompletions.filter(
      (q) => q.isCorrect
    ).length;
    currentDayEntry.score = Math.round(
      (currentDayEntry.correctAnswers / 5) * 100
    );
  }

  await Lesson.findOneAndUpdate(
    { userId: user._id, day: user.learningJourney.currentDay },
    { completed: true }
  );

  user.learningJourney.currentDay += 1;
  user.learningJourney.totalScore += currentDayEntry.score;
  await updateUserStreak(user);
  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Lesson completed successfully!",
    data: {
      score: `${currentDayEntry.correctAnswers}/5`,
      percentage: currentDayEntry.score,
      streak: user.learningJourney.streak,
      totalScore: user.learningJourney.totalScore,
      lessonQualityRating: currentDayEntry.lessonQualityRating,
      knowledgeGaps: currentDayEntry.knowledgeGaps,
    },
  });
});

export const getQuizDetails = catchAsync(async (req, res) => {
  const { day, quizIndex } = req.query;
  const user = await User.findById(req.user.id);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const lesson = await Lesson.findOne({ userId: user._id, day: parseInt(day) });
  if (!lesson) throw new AppError(httpStatus.NOT_FOUND, "Lesson not found");

  const completedDay = user.learningJourney.completedDays.find(
    (entry) => entry.day === parseInt(day)
  );
  const correctAnswers = completedDay
    ? completedDay.quizCompletions.filter((qc) => qc.isCorrect).length
    : 0;
  const score = `${correctAnswers}/5`;
  const status = getQuizStatus(correctAnswers);

  if (quizIndex === undefined) {
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      data: lesson.mcqs.map((mcq, index) => {
        const quizCompletion = completedDay?.quizCompletions.find(
          (qc) => qc.quizIndex === index
        );
        return {
          index,
          question: mcq.question,
          options: mcq.options,
          correctAnswer: mcq.correctAnswer,
          explanation: mcq.explanation,
          userAnswer: quizCompletion?.selected,
          isCorrect: quizCompletion?.isCorrect,
          score,
          status,
        };
      }),
    });
  }

  const index = parseInt(quizIndex);
  if (index < 0 || index >= lesson.mcqs.length)
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid quiz index");

  const mcq = lesson.mcqs[index];
  const quizCompletion = completedDay?.quizCompletions.find(
    (qc) => qc.quizIndex === index
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    data: {
      index,
      question: mcq.question,
      options: mcq.options,
      correctAnswer: mcq.correctAnswer,
      explanation: mcq.explanation,
      userAnswer: quizCompletion?.selected,
      isCorrect: quizCompletion?.isCorrect,
      score,
      status,
    },
  });
});
