import FollowUp from '../models/FollowUp.model.js';
import Progress from '../models/Progress.model.js';
import Course from '../models/Course.model.js';
import { AppError, sendSuccess } from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const createFollowUp = asyncHandler(async (req, res) => {
  const { studentId, type, message } = req.body;
  if (!studentId || !type || !message) {
    throw new AppError('studentId, type, and message are required.', 400);
  }

  const teacherCourses = await Course.find({ teacher: req.user.id }).select('_id').lean();
  const teacherCourseIds = teacherCourses.map((c) => c._id);

  const isMyStudent = await Progress.exists({
    student: studentId,
    course:  { $in: teacherCourseIds },
  });
  if (!isMyStudent) throw new AppError('You are not allowed to contact this student.', 403);

  const followUp = await FollowUp.create({
    teacher: req.user.id,
    student: studentId,
    type,
    message,
  });

  sendSuccess(res, 201, { followUp });
});

export const listFollowUpsForStudent = asyncHandler(async (req, res) => {
  const { studentId } = req.params;

  const teacherCourses = await Course.find({ teacher: req.user.id }).select('_id').lean();
  const teacherCourseIds = teacherCourses.map((c) => c._id);

  const isMyStudent = await Progress.exists({
    student: studentId,
    course:  { $in: teacherCourseIds },
  });
  if (!isMyStudent) throw new AppError('You are not allowed to view this student.', 403);

  const followUps = await FollowUp.find({ teacher: req.user.id, student: studentId })
    .sort({ createdAt: -1 })
    .lean();

  sendSuccess(res, 200, { followUps });
});

