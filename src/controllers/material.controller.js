import fs from 'fs';
import Course from '../models/Course.model.js';
import Material from '../models/Material.model.js';
import Progress from '../models/Progress.model.js';
import { AppError, sendSuccess } from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const assertTeacherOwns = (course, userId) => {
  if (course.teacher.toString() !== userId.toString()) {
    throw new AppError('You are not the teacher of this course.', 403);
  }
};

// ─── GET /courses/:courseId/materials ─────────────────────────────────────────
export const getMaterials = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.courseId);
  if (!course) return next(new AppError('Course not found.', 404));

  const filter = { course: req.params.courseId };
  if (req.user?.role !== 'teacher') filter.isPublished = true;

  const materials = await Material.find(filter)
    .select('-file.path')  // Don't expose server-side file path
    .sort({ createdAt: -1 })
    .lean();

  sendSuccess(res, 200, { materials });
});

// ─── POST /courses/:courseId/materials ────────────────────────────────────────
export const uploadMaterial = asyncHandler(async (req, res, next) => {
  if (!req.file) return next(new AppError('Please upload a file.', 400));

  const course = await Course.findById(req.params.courseId);
  if (!course) return next(new AppError('Course not found.', 404));
  assertTeacherOwns(course, req.user.id);

  const material = await Material.create({
    title:       req.body.title || req.file.originalname,
    description: req.body.description,
    course:      req.params.courseId,
    teacher:     req.user.id,
    type:        'pdf',
    file: {
      filename:     req.file.filename,
      originalName: req.file.originalname,
      path:         req.file.path,
      size:         req.file.size,
      mimetype:     req.file.mimetype,
    },
  });

  await Course.findByIdAndUpdate(req.params.courseId, {
    $push: { materials: material._id },
  });

  sendSuccess(res, 201, { material });
});

// ─── GET /courses/:courseId/materials/:id  (download) ────────────────────────
export const downloadMaterial = asyncHandler(async (req, res, next) => {
  const material = await Material.findOne({
    _id:    req.params.id,
    course: req.params.courseId,
  });
  if (!material || !material.isPublished) return next(new AppError('Material not found.', 404));

  // Confirm student is enrolled
  if (req.user.role === 'student') {
    const enrolled = req.user.enrolledCourses?.some(
      (c) => c.toString() === req.params.courseId
    );
    if (!enrolled) return next(new AppError('You must be enrolled to download materials.', 403));

    // Track download in progress
    await Progress.findOneAndUpdate(
      { student: req.user.id, course: req.params.courseId },
      { $addToSet: { downloadedMaterials: { material: material._id } } }
    );
  }

  await Material.findByIdAndUpdate(material._id, { $inc: { downloadCount: 1 } });

  res.download(material.file.path, material.file.originalName);
});

// ─── DELETE /courses/:courseId/materials/:id ─────────────────────────────────
export const deleteMaterial = asyncHandler(async (req, res, next) => {
  const material = await Material.findOne({
    _id:    req.params.id,
    course: req.params.courseId,
  });
  if (!material) return next(new AppError('Material not found.', 404));

  const course = await Course.findById(req.params.courseId);
  assertTeacherOwns(course, req.user.id);

  fs.unlink(material.file.path, (err) => {
    if (err) console.warn('Could not delete file:', err.message);
  });

  await Promise.all([
    material.deleteOne(),
    Course.findByIdAndUpdate(req.params.courseId, { $pull: { materials: material._id } }),
  ]);

  sendSuccess(res, 204, {});
});
