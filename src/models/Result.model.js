import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema({
  questionId:          { type: mongoose.Schema.Types.ObjectId, required: true },
  selectedOptionIndex: { type: Number }, // For Multiple Choice
  essayAnswer:         { type: String }, // For Essays
  isCorrect:           { type: Boolean }, 
  pointsEarned:        { type: Number, default: 0 },
  timeSpentSeconds:    Number,
});


const resultSchema = new mongoose.Schema(
  {
    student: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    exam: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Exam',
      required: true,
    },
    course: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Course',
      required: true,
    },
    answers:         [answerSchema],
    score:           { type: Number, required: true, min: 0, max: 100 }, // percentage
    totalPoints:     { type: Number, required: true },
    earnedPoints:    { type: Number, required: true },
    totalQuestions:  { type: Number, required: true },
    correctAnswers:  { type: Number, required: true },
    passed:          { type: Boolean, required: true },
    timeTakenSeconds:{ type: Number, default: 0 },
    attemptNumber:   { type: Number, default: 1 },
    completedAt:     { type: Date,   default: Date.now },
  },
  { timestamps: true }
);

resultSchema.index({ student: 1, exam: 1 });
resultSchema.index({ student: 1, course: 1 });
resultSchema.index({ exam: 1 });

const Result = mongoose.model('Result', resultSchema);
export default Result;
