import axios from "axios";
import { marked } from "marked";

export const generateDailyLesson = async (lessonConfig) => {
  try {
    const {
      userProfile,
      currentDay,
      totalDays,
      previousDays,
      language = "en",
      learningPace = "moderate",
    } = lessonConfig;

    // Analyze previous performance for adaptation
    const gaps = identifyKnowledgeGaps(previousDays);
    const avgQualityRating = previousDays.length
      ? previousDays.reduce(
          (sum, day) => sum + (day.lessonQualityRating || 0),
          0
        ) / previousDays.length
      : 5;
    const avgQuizScore = previousDays.length
      ? previousDays.reduce((sum, day) => sum + (day.correctAnswers || 0), 0) /
        (previousDays.length * 5)
      : 1;
    const skillLevelAdjustment =
      userProfile.skillLevel === "expert"
        ? 0.9
        : userProfile.skillLevel === "proficient"
        ? 0.7
        : userProfile.skillLevel === "practitioner"
        ? 0.5
        : 0.3;

    const systemMessages = {
      en: `You are a daily lesson generator for an AI learning platform. Create engaging, progressive lessons tailored to the user's profile. Include a relevant image URL (e.g., from Unsplash API: https://source.unsplash.com/random/300x200?${
        userProfile.mainSkills[0]?.skill
      }). Return JSON with: title, content (Markdown), imageUrl, mcqs (array of 5 objects with question, options, correctAnswer, explanation), practicalExercise, keyTakeaways. Adapt difficulty based on quiz score (${avgQuizScore.toFixed(
        2
      )}), lesson quality (${avgQualityRating.toFixed(1)}), desired level (${
        userProfile.desiredLevel
      }), and identified gaps (${gaps.join(", ")}).`,
      fr: `Vous êtes un générateur de leçons quotidiennes pour une plateforme d'apprentissage IA. Créez des leçons engageantes et progressives adaptées au profil de l'utilisateur. Incluez une URL d'image pertinente (par ex., via Unsplash API : https://source.unsplash.com/random/300x200?${
        userProfile.mainSkills[0]?.skill
      }). Retournez JSON avec : title, content (Markdown), imageUrl, mcqs (tableau de 5 objets avec question, options, correctAnswer, explanation), practicalExercise, keyTakeaways. Adaptez la difficulté en fonction du score au quiz (${avgQuizScore.toFixed(
        2
      )}), de la qualité de la leçon (${avgQualityRating.toFixed(
        1
      )}), du niveau souhaité (${
        userProfile.desiredLevel
      }), et des lacunes identifiées (${gaps.join(", ")}).`,
    };

    const response = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-small-latest",
        messages: [
          {
            role: "system",
            content: systemMessages[language] || systemMessages.en,
          },
          {
            role: "user",
            content: `Generate day ${currentDay}/${totalDays} lesson for:
            Name: ${userProfile.name || "User"}
            Profession: ${userProfile.profession || "other"}
            Skills: ${
              userProfile.mainSkills?.map((s) => s.skill).join(", ") ||
              "strategic_vision"
            }
            Age Group: ${userProfile.ageGroup || "31-40"}
            Goal: ${userProfile.goals?.[0] || "professional_growth"}
            Growth Areas: ${
              userProfile.growthAreas?.join(", ") || "more_strategic"
            }
            Skill Level: ${userProfile.skillLevel || "beginner"}
            Desired Level: ${userProfile.desiredLevel || "improve_little"}
            Learning Pace: ${learningPace}
            Previous Days Completed: ${previousDays.length}
            Language: ${language}
            Focus on practical content, e.g., strategic foresight principles, adjusted for gaps and performance.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    const lessonData = JSON.parse(response.data.choices[0].message.content);
    return {
      ...lessonData,
      content: lessonData.content, // Keep as Markdown for marked conversion later
      imageUrl:
        lessonData.imageUrl ||
        `https://source.unsplash.com/random/300x200?${
          userProfile.mainSkills[0]?.skill || "learning"
        }`,
      day: currentDay,
      totalDays,
      duration: 7, // Targeting 6-7 minutes
      language,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(
      "AI Lesson Generation Error:",
      error.response?.data || error.message
    );
    return getFallbackLesson(lessonConfig);
  }
};

const identifyKnowledgeGaps = (previousDays) => {
  const gapCount = {};
  previousDays.forEach((day) => {
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

const getFallbackLesson = (config) => ({
  title:
    config.language === "fr"
      ? "Introduction à l'Apprentissage"
      : "Introduction to Learning",
  content:
    config.language === "fr"
      ? "Cette leçon introduit les bases de l'apprentissage personnalisé."
      : "This lesson introduces the basics of personalized learning.",
  imageUrl: `https://source.unsplash.com/random/300x200?learning`,
  mcqs: [
    {
      question:
        config.language === "fr"
          ? "Quel est le but principal ?"
          : "What is the main purpose?",
      options: [
        config.language === "fr" ? "Prédire l'avenir" : "Predict the future",
        config.language === "fr" ? "Apprendre quotidiennement" : "Learn daily",
        config.language === "fr" ? "Analyser le passé" : "Analyze the past",
      ],
      correctAnswer:
        config.language === "fr" ? "Apprendre quotidiennement" : "Learn daily",
      explanation:
        config.language === "fr"
          ? "L'objectif est d'apprendre une leçon par jour."
          : "The goal is to learn one lesson per day.",
    },
  ],
  practicalExercise:
    config.language === "fr"
      ? "Notez une compétence que vous voulez améliorer."
      : "Note a skill you want to improve.",
  keyTakeaways: [
    config.language === "fr" ? "Apprentissage quotidien" : "Daily learning",
  ],
});
