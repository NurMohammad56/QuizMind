import axios from "axios";

export const generatePersonalizedLearningPlan = async (
  userProfile,
  focusArea = "strategic_foresight",
  duration = 180
) => {
  try {
    const response = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-small-latest",
        messages: [
          {
            role: "system",
            content: `You are an AI learning planner. Create personalized plans based on user profiles. Return JSON with: courseTitle, duration (days), focusArea, learningObjectives (array), dailyStructure (object with phases, each containing title, days, and tasks array).`,
          },
          {
            role: "user",
            content: `Create a plan for:
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
            Focus Area: ${focusArea}
            Duration: ${duration} days
            Ensure dailyStructure is an object with 5 phases (e.g., phase1, phase2, etc.), each with a title, days, and tasks array.`,
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

    return JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    console.error(
      "AI Learning Plan Error:",
      error.response?.data || error.message
    );
    return {
      courseTitle: "Personalized Learning Journey",
      duration: parseInt(duration, 10),
      focusArea,
      learningObjectives: ["Learn Basics", "Develop Skills", "Apply Knowledge"],
      dailyStructure: {
        phase1: { title: "Foundations", days: 30, tasks: ["Task 1", "Task 2"] },
        phase2: {
          title: "Intermediate",
          days: 60,
          tasks: ["Task 3", "Task 4"],
        },
        phase3: { title: "Advanced", days: 60, tasks: ["Task 5", "Task 6"] },
        phase4: { title: "Application", days: 20, tasks: ["Task 7", "Task 8"] },
        phase5: { title: "Mastery", days: 10, tasks: ["Task 9", "Task 10"] },
      },
    };
  }
};
