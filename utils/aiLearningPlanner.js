// utils/aiLearningPlanner.js
import axios from "axios";

export const generatePersonalizedLearningPlan = async (
  userProfile,
  focusArea = null,
  duration = null
) => {
  try {
    const response = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-small",
        messages: [
          {
            role: "system",
            content: `You are an AI learning planner. Create personalized learning journeys based on user profiles. 
            Return JSON with: courseTitle, duration (days), focusArea, learningObjectives, and dailyStructure.`,
          },
          {
            role: "user",
            content: `Create a personalized learning plan for:
            Skill Level: ${userProfile.skillLevel}
            Desired Level: ${userProfile.desiredLevel}
            Goals: ${userProfile.goals?.join(", ")}
            Growth Areas: ${userProfile.growthAreas?.join(", ")}
            Focus Area: ${focusArea || "strategic_foresight"}
            Duration: ${duration || "180"} days
            `,
          },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    // Fallback plan
    return {
      courseTitle: "Strategic Foresight Mastery",
      duration: 180,
      focusArea: "strategic_foresight",
      learningObjectives: [
        "Master prospective terminology",
        "Develop strategic thinking skills",
        "Apply foresight methodologies",
        "Create future scenarios",
      ],
      dailyStructure: "15-minute lessons with practical exercises",
    };
  }
};
