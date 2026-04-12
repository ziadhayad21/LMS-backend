import Course from '../models/Course.model.js';
import Exam from '../models/Exam.model.js';
import Result from '../models/Result.model.js';
import { AppError, sendSuccess } from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const assertTeacherOwns = (course, userId) => {
  if (course.teacher.toString() !== userId.toString()) {
    throw new AppError('You are not the teacher of this course.', 403);
  }
};

// ─── GET /courses/:courseId/exams ─────────────────────────────────────────────
export const getExams = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.courseId);
  if (!course) return next(new AppError('Course not found.', 404));

  const filter = { course: req.params.courseId };
  if (req.user.role !== 'teacher') filter.isPublished = true;

  // Students: select only safe fields; teachers: include question count
  const select =
    req.user.role === 'teacher'
      ? 'title description timeLimit passingScore maxAttempts isPublished createdAt questions'
      : 'title description timeLimit passingScore maxAttempts';

  const exams = await Exam.find(filter).select(select).lean();

  // Add question count without leaking answers
  const safeExams = exams.map(({ questions, ...e }) => ({
    ...e,
    questionCount: questions?.length ?? 0,
  }));

  sendSuccess(res, 200, { exams: safeExams });
});

// ─── GET /exams (GLOBAL) ──────────────────────────────────────────────────────
export const getGlobalExams = asyncHandler(async (req, res) => {
  let filter = {};

  if (req.user.role === 'teacher') {
    filter.teacher = req.user.id;
  } else if (req.user.role === 'student') {
    // Current behavior: show exams of enrolled courses
    // New behavior: show exams of enrolled courses OR exams matching student level
    filter = {
      $or: [
        { course: { $in: req.user.enrolledCourses } },
        { level: req.user.level }
      ],
      isPublished: true
    };
  }

  // Students: select only safe fields; teachers: include question count
  const select =
    req.user.role === 'teacher'
      ? 'title description course level timeLimit passingScore maxAttempts isPublished createdAt questions'
      : 'title description course level timeLimit passingScore maxAttempts';

  const exams = await Exam.find(filter).select(select).populate('course', 'title').lean();

  const safeExams = exams.map(({ questions, ...e }) => ({
    ...e,
    questionCount: questions?.length ?? 0,
  }));

  sendSuccess(res, 200, { exams: safeExams });
});



// ─── GET /exams/:id (student — no answers) ───────────────────────────────────
export const getExam = asyncHandler(async (req, res, next) => {
  const exam = await Exam.findById(req.params.id).lean();


  if (!exam) return next(new AppError('Exam not found.', 404));

  if (!exam.isPublished && req.user.role !== 'teacher') {
    return next(new AppError('This exam is not available.', 403));
  }

  // Check availability window
  const now = new Date();
  if (exam.availableFrom && now < exam.availableFrom) {
    return next(new AppError('This exam is not available yet.', 403));
  }
  if (exam.availableUntil && now > exam.availableUntil) {
    return next(new AppError('This exam has expired.', 403));
  }

  // Strip correct answers for students
  if (req.user.role === 'student') {
    exam.questions = exam.questions.map((question) => {
      const safeQuestion = { ...question };
      delete safeQuestion.correctOptionIndex;
      return safeQuestion;
    });
  }

  // Attach student's attempt count
  const attemptCount = await Result.countDocuments({
    student: req.user.id,
    exam:    exam._id,
  });

  sendSuccess(res, 200, { exam, attemptCount });
});

// ─── GET /courses/:courseId/exams/:id/full  (teacher — with answers) ──────────
export const getExamFull = asyncHandler(async (req, res, next) => {
  const exam = await Exam.findOne({ _id: req.params.id, course: req.params.courseId });
  if (!exam) return next(new AppError('Exam not found.', 404));

  const course = await Course.findById(req.params.courseId);
  assertTeacherOwns(course, req.user.id);

  sendSuccess(res, 200, { exam });
});

// ─── POST /courses/:courseId/exams or POST /exams ─────────────────────────────
export const createExam = asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;
  let course = null;

  if (courseId) {
    course = await Course.findById(courseId);
    if (!course) return next(new AppError('Course not found.', 404));
    assertTeacherOwns(course, req.user.id);
  }

  const examData = {
    ...req.body,
    course:  courseId || null,
    teacher: req.user.id,
  };

  const exam = await Exam.create(examData);

  if (courseId) {
    await Course.findByIdAndUpdate(courseId, { $push: { exams: exam._id } });
  }

  sendSuccess(res, 201, { exam });
});


// ─── PATCH /courses/:courseId/exams/:id ───────────────────────────────────────
export const updateExam = asyncHandler(async (req, res, next) => {
  const exam = await Exam.findOne({ _id: req.params.id, course: req.params.courseId });
  if (!exam) return next(new AppError('Exam not found.', 404));

  const course = await Course.findById(req.params.courseId);
  assertTeacherOwns(course, req.user.id);

  const updates = { ...req.body };
  delete updates.teacher;
  delete updates.course;

  const updated = await Exam.findByIdAndUpdate(req.params.id, updates, {
    new: true, runValidators: true,
  });

  sendSuccess(res, 200, { exam: updated });
});

// ─── DELETE /courses/:courseId/exams/:id ──────────────────────────────────────
export const deleteExam = asyncHandler(async (req, res, next) => {
  const exam = await Exam.findOne({ _id: req.params.id, course: req.params.courseId });
  if (!exam) return next(new AppError('Exam not found.', 404));

  const course = await Course.findById(req.params.courseId);
  assertTeacherOwns(course, req.user.id);

  await Promise.all([
    exam.deleteOne(),
    Course.findByIdAndUpdate(req.params.courseId, { $pull: { exams: exam._id } }),
  ]);

  sendSuccess(res, 204, {});
});

// ─── POST /courses/:courseId/exams/:examId/submit or POST /exams/:examId/submit ──────────
export const submitExam = asyncHandler(async (req, res, next) => {
  const { answers, timeTakenSeconds = 0 } = req.body;

  const exam = await Exam.findOne({
    _id:         req.params.examId,
    isPublished: true,
  }).lean();

  if (!exam) return next(new AppError('Exam not found or not available.', 404));

  // Grading
  let totalPoints  = 0;
  let earnedPoints = 0;
  let correctCount = 0;

  const gradedAnswers = exam.questions.map((question) => {
    const studentAnswer = answers.find(
      (a) => a.questionId.toString() === question._id.toString()
    );

    totalPoints += question.points || 0;

    if (question.type === 'essay') {
      return {
        questionId:   question._id,
        essayAnswer:  studentAnswer?.essayAnswer || '',
        isCorrect:    false, // Essays not auto-graded
        pointsEarned: 0,
      };
    }

    const selected  = studentAnswer?.selectedOptionIndex ?? -1;
    const isCorrect = selected === question.correctOptionIndex;

    if (isCorrect) {
      earnedPoints += question.points || 0;
      correctCount++;
    }

    return {
      questionId:          question._id,
      selectedOptionIndex: selected,
      isCorrect,
      pointsEarned:        isCorrect ? (question.points || 0) : 0,
    };
  });


  const score  = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const passed = score >= exam.passingScore;

  const prevAttempts = await Result.countDocuments({
    student: req.user.id,
    exam:    exam._id,
  });

  const result = await Result.create({
    student:          req.user.id,
    exam:             exam._id,
    course:           exam.course,
    answers:          gradedAnswers,
    score,
    totalPoints,
    earnedPoints,
    totalQuestions:   exam.questions.length,
    correctAnswers:   correctCount,
    passed,
    timeTakenSeconds,
    attemptNumber:    prevAttempts + 1,
  });

  sendSuccess(res, 201, {
    result: {
      _id:            result._id,
      score,
      passed,
      correctAnswers: correctCount,
      totalQuestions: exam.questions.length,
      earnedPoints,
      totalPoints,
      attemptNumber:  prevAttempts + 1,
      passingScore:   exam.passingScore,
    },
  });
});
