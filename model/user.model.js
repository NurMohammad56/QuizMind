import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    refreshToken: {
      type: String,
    },
    lastLogin: {
      type: Date,
    },
    profile: {
      name: {
        type: String,
        required: [true, "Name is required"],
      },
      profession: {
        type: String,
        enum: ["manager", "engineer", "educator", "consultant", "other"],
        default: "other",
      },
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
        title: { type: String },
        duration: { type: Number, default: 180 },
        focusArea: { type: String },
      },
      currentDay: {
        type: Number,
        default: 1,
      },
      totalDays: {
        type: Number,
        default: 180,
      },
      lastLessonDate: { type: Date },
      completedDays: [
        {
          day: { type: Number },
          completedAt: { type: Date },
          lessonContent: { type: String },
          score: { type: Number },
          correctAnswers: { type: Number },
          totalQuestions: { type: Number },
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

// Password hashing
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Method to check password
userSchema.methods.correctPassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);

export { User };
