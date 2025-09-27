// utils/aiLessonGenerator.js
import axios from "axios";

export const generateDailyLesson = async (lessonConfig) => {
  try {
    const {
      userProfile,
      currentDay,
      totalDays,
      previousDays,
      language = "en",
      learningPace,
    } = lessonConfig;

    const systemMessages = {
      en: `You are a daily lesson generator for strategic foresight training. 
      Create engaging daily lessons that build on previous knowledge.
      Return JSON with: title, content, mcqs (array with questions, options, correctAnswer, explanation), 
      practicalExercise, and keyTakeaways.`,
      fr: `Vous êtes un générateur de leçons quotidiennes pour la formation en prospective stratégique.
      Créez des leçons quotidiennes engageantes qui s'appuient sur les connaissances précédentes.
      Retournez JSON avec: title, content, mcqs (tableau avec questions, options, correctAnswer, explanation),
      practicalExercise, et keyTakeaways.`,
    };

    const response = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-small",
        messages: [
          {
            role: "system",
            content: systemMessages[language] || systemMessages.en,
          },
          {
            role: "user",
            content: `Generate day ${currentDay}/${totalDays} lesson for:
            User Level: ${userProfile.skillLevel}
            Learning Pace: ${learningPace}
            Previous Days Completed: ${previousDays.length}
            Language: ${language}
            
            Focus on practical, engaging content that builds on previous learning.
            Include 3-5 MCQs with explanations.
            `,
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

    // Add metadata
    return {
      ...lessonData,
      day: currentDay,
      totalDays: totalDays,
      duration: 15, // 15-minute lessons
      language: language,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("AI Lesson Generation Error:", error);

    // Fallback lesson content
    return getFallbackLesson(lessonConfig);
  }
};

const getFallbackLesson = (config) => ({
  title:
    config.language === "fr"
      ? "Introduction à la Prospective Stratégique"
      : "Introduction to Strategic Foresight",
  content:
    config.language === "fr"
      ? "La prospective stratégique est une discipline qui vise à explorer les futurs possibles pour éclairer les actions présentes."
      : "Strategic foresight is a discipline that aims to explore possible futures to inform present-day actions.",
  mcqs: [
    {
      question:
        config.language === "fr"
          ? "Quel est l'objectif principal de la prospective stratégique ?"
          : "What is the main goal of strategic foresight?",
      options: [
        config.language === "fr"
          ? "Prédire l'avenir avec précision"
          : "Predict the future accurately",
        config.language === "fr"
          ? "Explorer les futurs possibles"
          : "Explore possible futures",
        config.language === "fr"
          ? "Analyser seulement le passé"
          : "Only analyze the past",
        config.language === "fr"
          ? "Créer des statistiques"
          : "Create statistics",
      ],
      correctAnswer:
        config.language === "fr"
          ? "Explorer les futurs possibles"
          : "Explore possible futures",
      explanation:
        config.language === "fr"
          ? "La prospective explore plusieurs futurs possibles plutôt que de tenter de prédire un seul avenir."
          : "Foresight explores multiple possible futures rather than trying to predict one single future.",
    },
  ],
  practicalExercise:
    config.language === "fr"
      ? "Identifiez une tendance émergente dans votre industrie et imaginez trois scénarios possibles."
      : "Identify one emerging trend in your industry and imagine three possible scenarios.",
  keyTakeaways: [
    config.language === "fr"
      ? "Exploration de multiples futurs"
      : "Exploring multiple futures",
    config.language === "fr"
      ? "Prise de décision éclairée"
      : "Informed decision-making",
  ],
});
