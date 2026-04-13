import fs from 'fs';
import Course from '../models/Course.model.js';
import Lesson from '../models/Lesson.model.js';
import Progress from '../models/Progress.model.js';
import User from '../models/User.model.js';
import { AppError, sendSuccess } from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const assertTeacherOwns = (course, user) => {
  if (user.role === 'admin') return;
  const uid = user._id || user;
  if (course.teacher.toString() !== uid.toString()) {
    throw new AppError('You are not the teacher of this course.', 403);
  }
};

const getOrCreateTeacherAcademyCourse = async (teacherId) => {
  let course = await Course.findOne({
    teacher: teacherId,
    title: 'Academic English Academy Lessons',
  });

  if (!course) {
    course = await Course.create({
      title: 'Academic English Academy Lessons',
      description: 'Core academic English lessons for grammar, reading, and exam preparation.',
      level: 'intermediate',
      category: 'general',
      isPublished: true,
      teacher: teacherId,
    });
  }

  return course;
};

// ─── GET /courses/:courseId/lessons ──────────────────────────────────────────
export const getLessons = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.courseId);
  if (!course) return next(new AppError('Course not found.', 404));

  // STRICT: Students cannot access lessons from a course outside their level
  if (req.user?.role === 'student') {
    if (!req.user.level || course.level !== req.user.level) {
      return sendSuccess(res, 200, { lessons: [] });
    }
  }

  const filter = { course: req.params.courseId };

  if (req.user?.role === 'student') {
    filter.isPublished = true;
    filter.level = req.user.level; // exact level match on lesson too
  }

  const lessons = await Lesson.find(filter).sort({ order: 1 }).lean();
  sendSuccess(res, 200, { lessons });
});

// ─── GET /lessons (teacher: own, student: level-matched published) ───────────
export const getAllLessons = asyncHandler(async (req, res) => {
  let query = {};

  if (req.user.role === 'admin') {
    query = {};
  } else if (req.user.role === 'teacher') {
    query = { teacher: req.user.id };
  } else {
    // STRICT: Students see ONLY published lessons at their exact level
    if (!req.user.level) return sendSuccess(res, 200, { lessons: [] });
    query = {
      isPublished: true,
      level: req.user.level, // exact match only
    };
  }

  const lessons = await Lesson.find(query)
    .populate('course', 'title')
    .populate('teacher', 'name')
    .sort({ createdAt: -1 })
    .lean();

  sendSuccess(res, 200, { lessons });
});


// ─── GET /courses/:courseId/lessons/:id ──────────────────────────────────────
export const getLesson = asyncHandler(async (req, res, next) => {
  const lesson = await Lesson.findOne({
    _id: req.params.id,
    course: req.params.courseId,
  }).populate('course', 'title').populate('teacher', 'name');

  if (!lesson) return next(new AppError('Lesson not found.', 404));

  // Strict Level Check for Students
  if (req.user?.role === 'student' && lesson.level !== req.user.level) {
    return next(new AppError('This lesson is not available for your academic level.', 403));
  }

  // Auto-enroll tracking: ensure a Progress doc exists for students once they access a lesson.
  // This makes tracking work even if the student didn't explicitly click "Enroll".
  if (req.user?.role === 'student') {
    const existing = await Progress.findOne({ student: req.user.id, course: req.params.courseId }).select('_id');
    if (!existing) {
      await Promise.all([
        User.findByIdAndUpdate(req.user.id, { $addToSet: { enrolledCourses: req.params.courseId } }),
        Course.findByIdAndUpdate(req.params.courseId, { $inc: { enrollmentCount: 1 } }),
        Progress.create({ student: req.user.id, course: req.params.courseId }),
      ]);
    }
  }

  sendSuccess(res, 200, { lesson });
});

// ─── POST /courses/:courseId/lessons ─────────────────────────────────────────
export const createLesson = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.courseId);
  if (!course) return next(new AppError('Course not found.', 404));
  assertTeacherOwns(course, req.user);

  const lessonData = {
    title: req.body.title,
    description: req.body.description,
    level: req.body.level,
    order: req.body.order,

    isPreview: req.body.isPreview,
    isPublished: req.body.isPublished,
    transcriptText: req.body.transcriptText,
    course: req.params.courseId,
    teacher: req.user.id,
  };

  if (req.files?.video) {
    const video = req.files.video[0];
    lessonData.videoFile = {
      filename: video.filename,
      originalName: video.originalname,
      path: video.path,
      size: video.size,
      mimetype: video.mimetype,
    };
  } else if (req.body.videoUrl) {
    lessonData.videoUrl = req.body.videoUrl;
  } else {
    return next(new AppError('No video file or URL provided.', 400));
  }

  if (req.files?.pdf) {
    const pdf = req.files.pdf[0];
    lessonData.pdfFile = {
      filename: pdf.filename,
      originalName: pdf.originalname,
      path: pdf.path,
      size: pdf.size,
      mimetype: pdf.mimetype,
    };
  }

  const lesson = await Lesson.create(lessonData);

  await Course.findByIdAndUpdate(req.params.courseId, {
    $push: { lessons: lesson._id },
  });

  sendSuccess(res, 201, { lesson });
});

// ─── POST /lessons (teacher only, lesson-first flow) ─────────────────────────
export const createAcademicLesson = asyncHandler(async (req, res, next) => {
  const course = await getOrCreateTeacherAcademyCourse(req.user.id);

  // Multer's req.body fields are always strings.
  const lessonData = {
    title: req.body.title,
    description: req.body.description,
    level: req.body.level,
    order: parseInt(req.body.order, 10) || 0,
    isPreview: req.body.isPreview === 'true' || req.body.isPreview === true,
    isPublished: req.body.isPublished === 'true' || req.body.isPublished === true,
    transcriptText: req.body.transcriptText,
    course: course._id,
    teacher: req.user.id,
  };


  if (req.files?.video) {
    const video = req.files.video[0];
    lessonData.videoFile = {
      filename: video.filename,
      originalName: video.originalname,
      path: video.path,
      size: video.size,
      mimetype: video.mimetype,
    };
  } else if (req.body.videoUrl) {
    lessonData.videoUrl = req.body.videoUrl;
  } else {
    return next(new AppError('No video file or URL provided.', 400));
  }

  if (req.files?.pdf) {
    const pdf = req.files.pdf[0];
    lessonData.pdfFile = {
      filename: pdf.filename,
      originalName: pdf.originalname,
      path: pdf.path,
      size: pdf.size,
      mimetype: pdf.mimetype,
    };
  }

  const lesson = await Lesson.create(lessonData);
  await Course.findByIdAndUpdate(course._id, { $push: { lessons: lesson._id } });

  sendSuccess(res, 201, { lesson });
});

// ─── PATCH /courses/:courseId/lessons/:id ────────────────────────────────────
export const updateLesson = asyncHandler(async (req, res, next) => {
  const lesson = await Lesson.findOne({ _id: req.params.id, course: req.params.courseId });
  if (!lesson) return next(new AppError('Lesson not found.', 404));

  const course = await Course.findById(req.params.courseId);
  assertTeacherOwns(course, req.user);

  // Update core fields
  const allowedUpdates = ['title', 'description', 'order', 'isPreview', 'isPublished', 'transcriptText'];
  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) lesson[field] = req.body[field];
  });

  if (req.files?.video) {
    const video = req.files.video[0];
    // Delete old video file if it exists
    if (lesson.videoFile?.path) {
      fs.unlink(lesson.videoFile.path, (err) => {
        if (err) console.warn('Could not delete old video:', err.message);
      });
    }
    lesson.videoFile = {
      filename: video.filename,
      originalName: video.originalname,
      path: video.path,
      size: video.size,
      mimetype: video.mimetype,
    };
    lesson.videoUrl = null; // Clear URL if file is uploaded
  } else if (req.body.videoUrl) {
    lesson.videoUrl = req.body.videoUrl;
    lesson.videoFile = undefined;
  }

  if (req.files?.pdf) {
    const pdf = req.files.pdf[0];
    // Delete old PDF if it exists
    if (lesson.pdfFile?.path) {
      fs.unlink(lesson.pdfFile.path, (err) => {
        if (err) console.warn('Could not delete old PDF:', err.message);
      });
    }
    lesson.pdfFile = {
      filename: pdf.filename,
      originalName: pdf.originalname,
      path: pdf.path,
      size: pdf.size,
      mimetype: pdf.mimetype,
    };
  }

  const updated = await lesson.save();

  sendSuccess(res, 200, { lesson: updated });
});

// ─── DELETE /courses/:courseId/lessons/:id ────────────────────────────────────
export const deleteLesson = asyncHandler(async (req, res, next) => {
  const lesson = await Lesson.findOne({ _id: req.params.id, course: req.params.courseId });
  if (!lesson) return next(new AppError('Lesson not found.', 404));

  const course = await Course.findById(req.params.courseId);
  assertTeacherOwns(course, req.user);

  if (lesson.videoFile?.path) {
    fs.unlink(lesson.videoFile.path, (err) => {
      if (err) console.warn('Could not delete video file:', err.message);
    });
  }

  await Promise.all([
    lesson.deleteOne(),
    Course.findByIdAndUpdate(req.params.courseId, { $pull: { lessons: lesson._id } }),
  ]);

  sendSuccess(res, 204, {});
});

// ─── Helper: merge overlapping/adjacent ranges and compute unique seconds ──────
function mergeRanges(ranges) {
  if (!ranges || ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      merged.push({ ...sorted[i] });
    }
  }
  return merged;
}

function totalFromRanges(ranges) {
  return ranges.reduce((sum, r) => sum + Math.max(0, r.end - r.start), 0);
}

// ─── POST /courses/:courseId/lessons/:id/complete ─────────────────────────────
export const completeLesson = asyncHandler(async (req, res, next) => {
  const {
    watchTimeSeconds = 0,
    totalDurationSeconds = 0,
    // New: array of {start, end} segments the student ACTUALLY played
    // (skipped portions are absent from this list)
    watchedRanges: incomingRanges = [],
  } = req.body;

  const lesson = await Lesson.findOne({
    _id: req.params.id,
    course: req.params.courseId,
    isPublished: true,
  });
  if (!lesson) return next(new AppError('Lesson not found.', 404));

  // Strict Level Check
  if (req.user.role === 'student' && lesson.level !== req.user.level) {
    return next(new AppError('You cannot complete a lesson that does not match your academic level.', 403));
  }

  // Persist video duration if the backend doesn't have it yet
  if (
    totalDurationSeconds > 0 &&
    !(lesson.duration > 0) &&
    !(lesson.videoFile?.duration > 0)
  ) {
    lesson.duration = totalDurationSeconds;
    await lesson.save();
  }

  const progress = await Progress.findOne({
    student: req.user.id,
    course: req.params.courseId,
  });
  if (!progress) return next(new AppError('You are not enrolled in this course.', 403));

  const lessonIndex = progress.completedLessons.findIndex(
    (cl) => cl.lesson.toString() === lesson._id.toString()
  );

  if (lessonIndex === -1) {
    // ── First time this lesson is touched ──────────────────────────────────
    const merged = mergeRanges(incomingRanges);
    const actualWatched = totalFromRanges(merged);
    progress.completedLessons.push({
      lesson: lesson._id,
      watchTimeSeconds: Math.max(watchTimeSeconds, actualWatched),
      watchedRanges: merged,
      actualWatchedSeconds: actualWatched,
    });
  } else {
    // ── Merge incoming ranges with previously stored ones ──────────────────
    const existing = progress.completedLessons[lessonIndex];
    const combined = mergeRanges([...(existing.watchedRanges || []), ...incomingRanges]);
    const actualWatched = totalFromRanges(combined);

    existing.watchedRanges = combined;
    existing.actualWatchedSeconds = actualWatched;
    // Keep the legacy watchTimeSeconds as the larger of the two values so
    // old code paths (which only look at watchTimeSeconds) still work.
    existing.watchTimeSeconds = Math.max(existing.watchTimeSeconds, watchTimeSeconds, actualWatched);
    existing.completedAt = new Date();
  }

  progress.lastAccessed = new Date();

  // Recalculate overall course completion percentage (STRICTLY for student's level)
  const levelLessons = await Lesson.find({
    course: req.params.courseId,
    level: req.user.level,
    isPublished: true
  }).select('_id');

  const totalLevelLessons = levelLessons.length;

  if (totalLevelLessons > 0) {
    // Count how many of THESE specific lessons the student has in their completedLessons
    const levelLessonIds = levelLessons.map(l => String(l._id));
    const completedLevelCount = progress.completedLessons.filter(cl =>
      levelLessonIds.includes(String(cl.lesson))
    ).length;

    progress.completionPercentage = Math.round(
      (completedLevelCount / totalLevelLessons) * 100
    );
  }

  if (progress.completionPercentage >= 100) {
    progress.isCompleted = true;
    progress.completedAt = new Date();
  }

  await progress.save();

  sendSuccess(res, 200, {
    completionPercentage: progress.completionPercentage,
    isCompleted: progress.isCompleted,
  });
});
