import mongoose from "mongoose";

const lessonSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  day: { type: Number, required: true },
  title: { type: String, required: true },
  content: { type: String },
  mcqs: [
    {
      question: { type: String },
      options: [String],
      correctAnswer: { type: String },
      explanation: { type: String },
    },
  ],
  practicalExercise: { type: Object },
  keyTakeaways: [String],
  totalDays: { type: Number },
  duration: { type: Number },
  language: { type: String },
  generatedAt: { type: Date, default: Date.now },
  completed: { type: Boolean, default: false },
});

export const Lesson = mongoose.model("Lesson", lessonSchema);
