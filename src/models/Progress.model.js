import mongoose from 'mongoose';

// A watched range: [start, end] seconds that the student actually played
const watchedRangeSchema = new mongoose.Schema(
  {
    start: { type: Number, required: true, min: 0 },
    end:   { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const progressSchema = new mongoose.Schema(
  {
    student: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    course: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Course',
      required: true,
    },
    completedLessons: [
      {
        lesson:           { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
        completedAt:      { type: Date, default: Date.now },
        watchTimeSeconds: { type: Number, default: 0 },

        // ── New: actual watched ranges (skip-aware) ──────────────────────────
        // Each entry = a continuous segment the student actually played.
        // Skipped regions are NOT included.  We merge overlapping ranges on the
        // backend so the array stays compact.
        watchedRanges:    { type: [watchedRangeSchema], default: [] },

        // Derived from watchedRanges: total unique seconds actually watched.
        // Stored for fast reads without re-computing every time.
        actualWatchedSeconds: { type: Number, default: 0 },
      },
    ],
    downloadedMaterials: [
      {
        material:     { type: mongoose.Schema.Types.ObjectId, ref: 'Material' },
        downloadedAt: { type: Date, default: Date.now },
      },
    ],
    completionPercentage: { type: Number, default: 0, min: 0, max: 100 },
    lastAccessed:         { type: Date, default: Date.now },
    isCompleted:          { type: Boolean, default: false },
    completedAt:          { type: Date, default: null },
  },
  { timestamps: true }
);

// One progress document per student per course
progressSchema.index({ student: 1, course: 1 }, { unique: true });

const Progress = mongoose.model('Progress', progressSchema);
export default Progress;
