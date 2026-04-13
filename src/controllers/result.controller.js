import Result from '../models/Result.model.js';
import Course from '../models/Course.model.js';
import { AppError, sendSuccess } from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

// ─── GET /results/my ──────────────────────────────────────────────────────────
export const getMyResults = asyncHandler(async (req, res) => {
  const results = await Result.find({ student: req.user.id })
    .populate('exam', 'title passingScore')
    .populate('course', 'title')
    .sort({ completedAt: -1 })
    .lean();

  sendSuccess(res, 200, { results });
});

// ─── GET /results/course/:courseId  (teacher) ─────────────────────────────────
export const getCourseResults = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.courseId);
  if (!course) return next(new AppError('Course not found.', 404));

  if (course.teacher.toString() !== req.user.id.toString()) {
    return next(new AppError('Access denied.', 403));
  }

  const results = await Result.find({ course: req.params.courseId })
    .populate('student', 'name email')
    .populate('exam', 'title passingScore')
    .sort({ completedAt: -1 })
    .lean();

  sendSuccess(res, 200, { results });
});

// ─── GET /results/:id ─────────────────────────────────────────────────────────
// ─── GET /results/leaderboard ────────────────────────────────────────────────
export const getLeaderboard = asyncHandler(async (req, res) => {
  // Aggregate results to find top students
  // Criteria: Combination of high scores and total exams taken
  const leaderboard = await Result.aggregate([
    {
      $group: {
        _id: '$student',
        avgScore: { $avg: '$score' },
        totalExams: { $sum: 1 },
        totalPoints: { $sum: '$earnedPoints' },
        lastActivity: { $max: '$completedAt' }
      }
    },
    { $sort: { avgScore: -1, totalPoints: -1 } },
    { $limit: 20 },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'studentInfo'
      }
    },
    { $unwind: '$studentInfo' },
    {
      $match: {
        'studentInfo.level': req.user.level // Only show students from same level
      }
    },
    {
      $project: {
        _id: 1,
        avgScore: { $round: ['$avgScore', 1] },
        totalExams: 1,
        totalPoints: 1,
        name: '$studentInfo.name',
        avatar: '$studentInfo.avatar',
        level: '$studentInfo.level'
      }
    }
  ]);

  sendSuccess(res, 200, { leaderboard });
});

export const getResult = asyncHandler(async (req, res, next) => {
  const result = await Result.findById(req.params.id)
    .populate('exam', 'title questions passingScore showCorrectAnswers')
    .populate('course', 'title')
    .populate('student', 'name email')
    .lean();

  if (!result) return next(new AppError('Result not found.', 404));

  // Only the student or the course teacher can view this
  const isOwner = result.student._id.toString() === req.user.id.toString();
  const course = await Course.findById(result.course._id);
  const isTeacher = course?.teacher.toString() === req.user.id.toString();

  if (!isOwner && !isTeacher) {
    return next(new AppError('Access denied.', 403));
  }

  sendSuccess(res, 200, { result });
});
