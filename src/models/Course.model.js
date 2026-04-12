import mongoose from 'mongoose';
import { COURSE_LEVELS, COURSE_CATEGORIES } from '../config/constants.js';

const courseSchema = new mongoose.Schema(
  {
    title: {
      type:      String,
      required:  [true, 'Course title is required'],
      trim:      true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type:      String,
      required:  [true, 'Course description is required'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    thumbnail: { type: String, default: null },
    level: {
      type:     String,
      enum:     COURSE_LEVELS,
      required: [true, 'Course level is required'],
    },
    category: {
      type:    String,
      enum:    COURSE_CATEGORIES,
      default: 'general',
    },
    language: { type: String, default: 'English' },
    tags: [{ type: String, trim: true, lowercase: true }],
    teacher: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    isPublished:     { type: Boolean, default: false },
    enrollmentCount: { type: Number,  default: 0,  min: 0 },
    totalDuration:   { type: Number,  default: 0 }, // minutes
    lessons:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }],
    materials: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Material' }],
    exams:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'Exam' }],
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
courseSchema.index({ title: 'text', description: 'text', tags: 'text' });
courseSchema.index({ teacher: 1, isPublished: 1 });
courseSchema.index({ category: 1, level: 1 });

// ─── Virtuals ─────────────────────────────────────────────────────────────────
courseSchema.virtual('thumbnailUrl').get(function () {
  return this.thumbnail ? `/uploads/images/${this.thumbnail}` : null;
});

const Course = mongoose.model('Course', courseSchema);
export default Course;
