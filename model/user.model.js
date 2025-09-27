import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    profile: {
      skillLevel: {
        type: String,
        enum: ["beginner", "practitioner", "proficient", "expert"],
        default: "beginner",
      },
      desiredLevel: {
        type: String,
        enum: ["improve_little", "very_good", "become_excellent"],
        default: "improve_little",
      },
      ageGroup: {
        type: String,
        enum: ["18-30", "31-40", "41-50", "51-60", "61+"],
      },
      mainSkills: [
        {
          type: String,
          enum: [
            "strategic_vision",
            "user_engineering",
            "leadership",
            "technical_mastery",
            "measurement",
          ],
        },
      ],
      goals: [
        {
          type: String,
          enum: [
            "professional_growth",
            "improving_skills",
            "learn_new_skill",
            "change_career",
            "time_management",
          ],
        },
      ],
      growthAreas: [
        {
          type: String,
          enum: [
            "better_expertise",
            "improve_persuasion",
            "more_strategic",
            "reflect",
          ],
        },
      ],
    },
    learningJourney: {
      currentCourse: {
        title: String,
        duration: Number, // AI-generated duration (e.g., 180 days)
        focusArea: String,
      },
      currentDay: {
        type: Number,
        default: 1,
      },
      totalDays: {
        type: Number,
        default: 180, // Default 6-month journey
      },
      lastLessonDate: Date,
      completedDays: [
        {
          day: Number,
          completedAt: Date,
          lessonContent: String,
          score: Number,
          correctAnswers: Number,
          totalQuestions: Number,
        },
      ],
      streak: {
        type: Number,
        default: 0,
      },
      totalScore: {
        type: Number,
        default: 0,
      },
    },
    preferences: {
      dailyReminder: {
        type: Boolean,
        default: true,
      },
      notificationTime: {
        type: String,
        default: "09:00",
      },
      language: {
        type: String,
        enum: ["en", "fr"],
        default: "en",
      },
      learningPace: {
        type: String,
        enum: ["relaxed", "moderate", "intensive"],
        default: "moderate",
      },
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.correctPassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model("User", userSchema);
