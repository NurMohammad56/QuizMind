import axios from "axios";

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

    const systemMessages = {
      en: `You are a daily lesson generator for an AI learning platform. Create engaging, progressive lessons tailored to the user's profile. Return JSON with: title, content (detailed explanation), mcqs (array of 3-5 objects with question, options, correctAnswer, explanation), practicalExercise, keyTakeaways.`,
      fr: `Vous êtes un générateur de leçons quotidiennes pour une plateforme d'apprentissage IA. Créez des leçons engageantes et progressives adaptées au profil de l'utilisateur. Retournez JSON avec: title, content (explication détaillée), mcqs (tableau de 3-5 objets avec question, options, correctAnswer, explanation), practicalExercise, keyTakeaways.`,
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
            Skills: ${userProfile.mainSkills?.join(", ") || "strategic_vision"}
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
            Focus on practical, engaging content, e.g., introducing strategic foresight with principles.`,
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
      day: currentDay,
      totalDays,
      duration: 15,
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

const getFallbackLesson = (config) => ({
  title:
    config.language === "fr"
      ? "Introduction à l'Apprentissage"
      : "Introduction to Learning",
  content:
    config.language === "fr"
      ? "Cette leçon introduit les bases de l'apprentissage personnalisé."
      : "This lesson introduces the basics of personalized learning.",
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
