import Course from '../models/Course.model.js';
import User from '../models/User.model.js';
import Progress from '../models/Progress.model.js';
import { AppError, sendSuccess, getPaginationMeta } from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { PAGINATION } from '../config/constants.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const assertTeacherOwns = (course, user) => {
  if (user.role === 'admin') return;
  if (course.teacher.toString() !== user.id.toString()) {
    throw new AppError('You are not the teacher of this course.', 403);
  }
};

// ─── GET /courses ─────────────────────────────────────────────────────────────
export const getCourses = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    parseInt(req.query.limit, 10) || PAGINATION.DEFAULT_LIMIT,
    PAGINATION.MAX_LIMIT
  );
  const skip = (page - 1) * limit;

  // Build filter
  const filter = {};

  if (req.user?.role === 'student') {
    filter.isPublished = true;
    filter.level = req.user.level;
  } else if (req.user?.role === 'teacher') {
    // Teachers see all published or their own drafts
    filter.$or = [
      { isPublished: true },
      { teacher: req.user.id }
    ];
  } else if (req.user?.role === 'admin') {
    // Admins see everything
  } else {
    // Public/unauth
    filter.isPublished = true;
  }

  if (req.query.level) {
    if (filter.$or) {
      // If we have an $or, we need to intersect it
      filter.level = req.query.level;
    } else {
      filter.level = req.query.level;
    }
  }

  if (req.query.category) filter.category = req.query.category;
  if (req.query.search) {
    filter.$text = { $search: req.query.search };
  }

  const [courses, total] = await Promise.all([
    Course.find(filter)
      .select('-lessons -materials -exams')
      .populate('teacher', 'name avatarUrl')
      .sort(req.query.search ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Course.countDocuments(filter),
  ]);

  sendSuccess(res, 200, { courses }, getPaginationMeta(page, limit, total));
});

// ─── GET /courses/:id ─────────────────────────────────────────────────────────
export const getCourse = asyncHandler(async (req, res, next) => {
  const query = { _id: req.params.id };

  // Role-based visibility logic
  if (req.user?.role === 'student') {
    query.isPublished = true;
    query.level = req.user.level;
  } else if (req.user?.role === 'teacher') {
    // Teacher sees it if it's published OR they are the owner
    query.$or = [
      { isPublished: true },
      { teacher: req.user.id }
    ];
  } else if (req.user?.role === 'admin') {
    // Admin bypasses all visibility filters
  } else {
    // Public access
    query.isPublished = true;
  }

  const lessonMatch = {};
  if (req.user?.role === 'student') {
    lessonMatch.isPublished = true;
    lessonMatch.level = req.user.level;
  } else if (!req.user || req.user.role === 'public') {
    lessonMatch.isPublished = true;
  }

  const examMatch = {};
  if (req.user?.role === 'student') {
    examMatch.isPublished = true;
    examMatch.level = req.user.level;
  } else if (!req.user || req.user.role === 'public') {
    examMatch.isPublished = true;
  }

  const course = await Course.findOne(query)
    .populate('teacher', 'name avatarUrl')
    .populate({ path: 'lessons', match: lessonMatch, select: '-videoFile.path' })
    .populate({ path: 'materials', match: { isPublished: true } })
    .populate({ path: 'exams', match: examMatch, select: 'title description timeLimit passingScore maxAttempts' });

  if (!course) return next(new AppError('Course not found or unavailable for your level.', 404));
  sendSuccess(res, 200, { course });
});

// ─── POST /courses ────────────────────────────────────────────────────────────
export const createCourse = asyncHandler(async (req, res) => {
  const courseData = { ...req.body, teacher: req.user.id };

  if (req.file) courseData.thumbnail = req.file.filename;

  const course = await Course.create(courseData);
  sendSuccess(res, 201, { course });
});

// ─── PATCH /courses/:id ───────────────────────────────────────────────────────
export const updateCourse = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id);
  if (!course) return next(new AppError('Course not found.', 404));
  assertTeacherOwns(course, req.user);

  const updates = { ...req.body };
  if (req.file) updates.thumbnail = req.file.filename;

  // Prevent changing teacher field
  delete updates.teacher;

  const updated = await Course.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });

  sendSuccess(res, 200, { course: updated });
});

// ─── DELETE /courses/:id ──────────────────────────────────────────────────────
export const deleteCourse = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id);
  if (!course) return next(new AppError('Course not found.', 404));
  assertTeacherOwns(course, req.user);

  await course.deleteOne();
  sendSuccess(res, 204, {});
});

// ─── POST /courses/:id/enroll ────────────────────────────────────────────────
export const enrollInCourse = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id);
  if (!course || !course.isPublished) return next(new AppError('Course not found.', 404));

  // Strict Level Checking for Enrollment
  if (req.user.role === 'student' && course.level !== req.user.level) {
    return next(new AppError('You cannot enroll in a course that does not match your academic level.', 403));
  }

  const alreadyEnrolled = req.user.enrolledCourses.includes(course._id);
  if (alreadyEnrolled) return next(new AppError('You are already enrolled in this course.', 409));

  await Promise.all([
    User.findByIdAndUpdate(req.user.id, { $addToSet: { enrolledCourses: course._id } }),
    Course.findByIdAndUpdate(course._id, { $inc: { enrollmentCount: 1 } }),
    Progress.create({ student: req.user.id, course: course._id }),
  ]);

  sendSuccess(res, 200, { message: 'Enrolled successfully.' });
});

// ─── GET /courses/:id/students ────────────────────────────────────────────────
export const getCourseStudents = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id);
  if (!course) return next(new AppError('Course not found.', 404));
  assertTeacherOwns(course, req.user);

  const progresses = await Progress.find({ course: course._id })
    .populate('student', 'name email lastLogin createdAt')
    .sort({ 'student.name': 1 })
    .lean();

  sendSuccess(res, 200, { students: progresses });
});

// ─── GET /teacher/dashboard ───────────────────────────────────────────────────
export const getTeacherDashboard = asyncHandler(async (req, res) => {
  const teacherId = req.user.id;
  const filter = req.user.role === 'admin' ? {} : { teacher: teacherId };

  const courses = await Course.find(filter)
    .select('title isPublished enrollmentCount createdAt')
    .lean();

  const totalStudents = courses.reduce((sum, c) => sum + c.enrollmentCount, 0);

  sendSuccess(res, 200, {
    totalCourses: courses.length,
    publishedCourses: courses.filter((c) => c.isPublished).length,
    totalStudents,
    courses,
  });
});
