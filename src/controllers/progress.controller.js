import User from '../models/User.model.js';
import Progress from '../models/Progress.model.js';
import Result from '../models/Result.model.js';
import Course from '../models/Course.model.js';
import Lesson from '../models/Lesson.model.js';
import { AppError, sendSuccess } from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

// ─── GET /progress/overview  (student's all courses) ─────────────────────────
export const getProgressOverview = asyncHandler(async (req, res) => {
  const progresses = await Progress.find({ student: req.user.id })
    .populate({
      path: 'course',
      select: 'title thumbnail level category totalDuration',
      match: { level: req.user.level } // STRICT: Only match courses for student level
    })
    .sort({ lastAccessed: -1 })
    .lean();

  // Filter out any entries where the course didn't match the level (populated as null)
  const filteredProgresses = progresses.filter(p => p.course !== null);

  // Attach best exam score per course
  const results = await Result.find({ student: req.user.id })
    .select('course score passed completedAt')
    .lean();

  const resultsByCourse = results.reduce((acc, r) => {
    const key = r.course.toString();
    if (!acc[key] || r.score > acc[key].score) acc[key] = r;
    return acc;
  }, {});

  const enriched = filteredProgresses.map((p) => ({
    ...p,
    bestExamResult: resultsByCourse[p.course._id.toString()] || null,
  }));

  sendSuccess(res, 200, { progresses: enriched });
});

// ─── GET /progress/course/:courseId ──────────────────────────────────────────
export const getCourseProgress = asyncHandler(async (req, res, next) => {
  const progress = await Progress.findOne({
    student: req.user.id,
    course: req.params.courseId,
  })
    .populate({
      path: 'course',
      select: 'level'
    })
    .populate({
      path: 'completedLessons.lesson',
      select: 'title order level'
    })
    .lean();

  if (!progress) return next(new AppError('You are not enrolled in this course.', 404));

  // Strict Level Check
  if (progress.course?.level !== req.user.level) {
    return next(new AppError('This course data is not available for your academic level.', 403));
  }

  // Filter completed lessons to only those matching the student's level
  progress.completedLessons = (progress.completedLessons || []).filter(
    cl => cl.lesson && cl.lesson.level === req.user.level
  );

  const examResults = await Result.find({
    student: req.user.id,
    course: req.params.courseId,
  })
    .populate('exam', 'title passingScore')
    .sort({ completedAt: -1 })
    .lean();

  sendSuccess(res, 200, { progress, examResults });
});

// ─── GET /progress/students/:studentId  (teacher) ────────────────────────────
export const getStudentProgress = asyncHandler(async (req, res) => {
  const studentInfo = await User.findById(req.params.studentId).select('-password').lean();
  if (!studentInfo) {
    throw new AppError('Student not found.', 404);
  }

  const courseFilter = req.user.role === 'admin' ? {} : { teacher: req.user.id };
  const teacherCourses = await Course.find(courseFilter)
    .populate('lessons', 'title duration order videoFile')
    .populate('exams', 'title passingScore')
    .lean();

  const teacherCourseIds = teacherCourses.map((c) => c._id);

  const progresses = await Progress.find({
    student: req.params.studentId,
    course: { $in: teacherCourseIds },
  }).lean();

  const results = await Result.find({
    student: req.params.studentId,
    course: { $in: teacherCourseIds },
  })
    .populate('exam', 'title passingScore')
    .populate('course', 'title')
    .sort({ completedAt: -1 })
    .lean();

  // ── Build per-video data ──────────────────────────────────────────────────
  const allVideos = [];   // Every lesson for enrolled courses
  const examsTaken = [];
  const missingExams = [];

  teacherCourses.forEach((course) => {
    // We now show all courses that have lessons for the student's level, 
    // even if they haven't enrolled yet. This ensures the 0-video bug is fixed.
    const progress = progresses.find((p) => String(p.course) === String(course._id));
    const completedLessonRefs = progress ? progress.completedLessons || [] : [];
    const courseResults = results.filter(
      (r) => r.course && String(r.course._id) === String(course._id)
    );

    course.lessons.forEach((lesson) => {
      const watchRecord = completedLessonRefs.find(
        (cl) => String(cl.lesson) === String(lesson._id)
      );

      // Visibility Rule: Show in tracking if level matches OR if they've already watched it
      const isLevelMatch = lesson.level === studentInfo.level;
      const hasRecord = !!watchRecord;

      if (!isLevelMatch && !hasRecord) return;

      // Prefer actualWatchedSeconds (skip-aware) over legacy watchTimeSeconds
      const actualWatched = Number(watchRecord?.actualWatchedSeconds ?? watchRecord?.watchTimeSeconds ?? 0);
      const totalDuration = Number(lesson.duration || lesson.videoFile?.duration || 0);

      let watchPercent = 0;
      if (totalDuration > 0) {
        watchPercent = Math.min(100, Math.round((actualWatched / totalDuration) * 100));
      } else if (actualWatched > 0) {
        watchPercent = 1; // Data exists but no duration saved yet
      }

      allVideos.push({
        _id: lesson._id,
        title: lesson.title,
        order: lesson.order,
        courseTitle: course.title,
        courseId: course._id,
        watchPercent,                         // 0-100 skip-aware watch %
        watchedSeconds: Math.round(actualWatched),
        totalDurationSeconds: Math.round(totalDuration),
        completedAt: watchRecord?.completedAt ?? null,
        hasRecord: !!watchRecord,       // Whether the student opened this lesson
      });
    });

    course.exams?.forEach((exam) => {
      const taken = courseResults.find(
        (r) => r.exam && String(r.exam._id) === String(exam._id)
      );
      if (taken) {
        examsTaken.push({
          _id: taken._id,
          examTitle: taken.exam?.title ?? exam.title,
          courseTitle: course.title,
          score: taken.score,
          passed: taken.passed,
          totalQuestions: taken.totalQuestions,
          correctAnswers: taken.correctAnswers,
          completedAt: taken.completedAt,
          attemptNumber: taken.attemptNumber ?? 1,
        });
      } else {
        missingExams.push({
          _id: exam._id,
          title: exam.title,
          courseTitle: course.title,
        });
      }
    });
  });

  // Sort videos by course then order
  allVideos.sort((a, b) => {
    if (a.courseTitle !== b.courseTitle) return a.courseTitle.localeCompare(b.courseTitle);
    return (a.order ?? 0) - (b.order ?? 0);
  });

  // Bucket videos for backward-compat (teacher UI uses these)
  const watched = allVideos.filter((v) => v.hasRecord);
  const notWatched = allVideos.filter((v) => !v.hasRecord);
  const fullyWatched = watched.filter((v) => v.watchPercent >= 90);
  const partiallyWatched = watched.filter((v) => v.watchPercent < 90);

  sendSuccess(res, 200, {
    student: studentInfo,
    videos: {
      all: allVideos,          // New: flat list with watchPercent per video
      fullyWatched,
      partiallyWatched,
      notWatched,
    },
    exams: {
      taken: examsTaken,
      missing: missingExams,
    },
  });
});

// ─── GET /progress/tracking  (teacher) ─────────────────────────────────────────
export const getTrackingOverview = asyncHandler(async (req, res) => {
  const courseFilter = req.user.role === 'admin' ? {} : { teacher: req.user.id };
  const teacherCourses = await Course.find(courseFilter)
    .select('_id lessons level title')
    .lean();
  const teacherCourseIds = teacherCourses.map((c) => c._id);

  // Levels the teacher actually teaches (used to scope visible students)
  const lessonFilter = req.user.role === 'admin' ? {} : { teacher: req.user.id };
  const teacherLessonLevels = await Lesson.distinct('level', lessonFilter);
  const allowedLevels = Array.from(
    new Set([
      ...teacherCourses.map((c) => c.level).filter(Boolean),
      ...teacherLessonLevels.map((l) => l).filter(Boolean),
    ])
  );

  // 1. Find all students matching the teacher's levels
  let studentQuery = {
    role: 'student',
    status: 'active',
  };

  // 2. Also find students who have active progress in any of this teacher's courses
  const studentsWithProgress = await Progress.find({ course: { $in: teacherCourseIds } })
    .distinct('student')
    .lean();

  const students = await User.find({
    $or: [
      {
        ...studentQuery,
        ...(allowedLevels.length ? { level: { $in: allowedLevels } } : {})
      },
      {
        _id: { $in: studentsWithProgress },
        status: 'active'
      }
    ]
  })
    .select('name level email lastLogin avatar')
    .lean();

  const studentIds = students.map((s) => s._id);

  // Only track progress for courses owned by this teacher (privacy + correctness)
  const progresses = await Progress.find({
    course: { $in: teacherCourseIds },
    ...(studentIds.length ? { student: { $in: studentIds } } : {}),
  })
    .populate('course', 'lessons level title')
    .populate('completedLessons.lesson', 'level') // Populate lesson level to filter correctly
    .lean();

  const results = await Result.find({
    course: { $in: teacherCourseIds },
    ...(studentIds.length ? { student: { $in: studentIds } } : {}),
  })
    .select('student score passed completedAt')
    .sort({ completedAt: -1 })
    .lean();

  const resultsByStudent = results.reduce((acc, r) => {
    const key = String(r.student);
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const lessonsByLevel = await Lesson.aggregate([
    { $match: { ...(req.user.role === 'admin' ? {} : { teacher: req.user._id }), isPublished: true } },
    { $group: { _id: '$level', count: { $sum: 1 } } },
  ]);
  const lessonCountByLevel = lessonsByLevel.reduce((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});

  const tracking = students.map((student) => {
    const studentProgresses = progresses.filter((p) => String(p.student) === String(student._id));

    let totalCompleted = 0;
    let totalLessons = lessonCountByLevel[student.level] || 0;
    let lastAccessed = null;
    let totalWatchTimeSeconds = 0;

    studentProgresses.forEach((p) => {
      // Count lessons if they match level OR if they were actually watched (has watchTime)
      const validProgressLessons = (p.completedLessons || []).filter(
        (cl) => (cl.lesson && cl.lesson.level === student.level) || (cl.actualWatchedSeconds > 0)
      );

      totalCompleted += validProgressLessons.length;
      totalWatchTimeSeconds += validProgressLessons.reduce((acc, cl) => acc + (cl.actualWatchedSeconds || cl.watchTimeSeconds || 0), 0);

      if (!lastAccessed || new Date(p.lastAccessed) > new Date(lastAccessed)) lastAccessed = p.lastAccessed;
    });

    const completionRate = totalLessons > 0 ? Math.min(100, (totalCompleted / totalLessons) * 100) : 0;
    let status = 'pending';
    if (completionRate > 0 && completionRate < 100) status = 'in progress';
    if (completionRate === 100 && totalLessons > 0) status = 'completed';
    const needsAttention = totalLessons > 0 && Math.round(completionRate) < 30;

    const studentResults = resultsByStudent[String(student._id)] || [];
    const examsTaken = studentResults.length;
    const avgExamScore = examsTaken
      ? Math.round(studentResults.reduce((acc, r) => acc + (r.score || 0), 0) / examsTaken)
      : 0;
    const lastExam = studentResults[0]
      ? {
        score: studentResults[0].score,
        passed: studentResults[0].passed,
        completedAt: studentResults[0].completedAt,
      }
      : null;

    return {
      _id: student._id,
      name: student.name,
      email: student.email,
      level: student.level,
      lastLogin: student.lastLogin,
      lastAccessed,
      completedLessons: totalCompleted,
      videosWatched: totalCompleted,
      totalWatchTimeSeconds,
      examsTaken,
      avgExamScore,
      lastExam,
      totalLessons: totalLessons,
      completionRate: Math.round(completionRate),
      status, // 'pending' | 'in progress' | 'completed'
      needsAttention,
    };
  });

  sendSuccess(res, 200, { tracking });
});
