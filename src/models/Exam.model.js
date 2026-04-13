import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['multiple-choice', 'essay'],
    default: 'multiple-choice',
  },
  questionText: {
    type:     String,
    required: [true, 'Question text is required'],
    trim:     true,
  },
  questionImage: { type: String, default: null }, // Optional image for the question
  options: {
    type: [String],
    validate: {
      validator: function(v) {
        if (this.type === 'essay') return true;
        return Array.isArray(v) && v.length >= 2 && v.length <= 6;
      },
      message:   'Multiple choice questions must have between 2 and 6 options',
    },
  },
  correctOptionIndex: {
    type:     Number,
    required: function() { return this.type === 'multiple-choice'; },
    min:      0,
  },
  explanation: { type: String, default: null }, // Shown after completion
  points:      { type: Number, default: 1, min: 1, max: 10 },
});

const examSchema = new mongoose.Schema(
  {
    title:       { type: String, required: [true, 'Exam title is required'], trim: true },
    description: { type: String, maxlength: [1000, 'Max 1000 characters'] },
    course: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Course',
      required: false, // Made optional as requested
    },
    level: {
      type: String,
      enum: [
        'أولى إعدادي',
        'تانية إعدادي',
        'تالتة إعدادي',
        'أولى ثانوي',
        'تانية ثانوي',
        'تالتة ثانوي',
        null
      ],
      default: null,
    },
    teacher: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    questions: {
      type: [questionSchema],
      validate: {
        validator: (v) => v.length >= 1,
        message:   'An exam must have at least one question',
      },
    },

    timeLimit:      { type: Number, default: null, min: 1 }, // minutes
    passingScore:   { type: Number, default: 60, min: 0, max: 100 }, // percentage
    // Default to one attempt; teachers/admins can configure (including -1 = unlimited) when creating/updating.
    maxAttempts:    { type: Number, default: 1 }, // -1 = unlimited
    shuffleQuestions: { type: Boolean, default: false },
    shuffleOptions:   { type: Boolean, default: false },
    showCorrectAnswers: { type: Boolean, default: true },
    isPublished:   { type: Boolean, default: false },
    availableFrom: { type: Date,    default: null },
    availableUntil:{ type: Date,    default: null },
  },
  {
    timestamps: true,
    toJSON: {
      // Strip correct answers when serializing for student consumption.
      // Teachers should use the /full endpoint which bypasses this.
      transform(_doc, ret, options) {
        if (options.hideAnswers && ret.questions) {
          ret.questions = ret.questions.map((question) => {
            const safeQuestion = { ...question };
            delete safeQuestion.correctOptionIndex;
            return safeQuestion;
          });
        }
        return ret;
      },
    },
  }
);

examSchema.index({ course: 1, isPublished: 1 });

const Exam = mongoose.model('Exam', examSchema);
export default Exam;
