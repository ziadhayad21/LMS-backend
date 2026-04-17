import fs from 'fs';
import Course from '../models/Course.model.js';
import Material from '../models/Material.model.js';
import Progress from '../models/Progress.model.js';
import { AppError, sendSuccess } from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { resolveSafeUploadPath, assertFileExists, sendInlinePdf } from '../utils/files.js';

const assertTeacherOwns = (course, user) => {
  if (user.role === 'admin') return;
  const uid = user._id || user;
  if (course.teacher.toString() !== uid.toString()) {
    throw new AppError('You are not the teacher of this course.', 403);
  }
};

// ─── GET /courses/:courseId/materials ─────────────────────────────────────────
export const getMaterials = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.courseId);
  if (!course) return next(new AppError('Course not found.', 404));

  // STRICT: Students can only access materials from courses matching their level
  if (req.user?.role === 'student') {
    if (!req.user.level || course.level !== req.user.level) {
      return sendSuccess(res, 200, { materials: [] });
    }
  }

  const filter = { course: req.params.courseId };
  if (req.user?.role !== 'teacher' && req.user?.role !== 'admin') filter.isPublished = true;

  const materials = await Material.find(filter)
    .select('-file.path')
    .sort({ createdAt: -1 })
    .lean();

  sendSuccess(res, 200, { materials });
});

// ─── POST /courses/:courseId/materials ────────────────────────────────────────
export const uploadMaterial = asyncHandler(async (req, res, next) => {
  if (!req.file) return next(new AppError('Please upload a file.', 400));

  const course = await Course.findById(req.params.courseId);
  if (!course) return next(new AppError('Course not found.', 404));
  assertTeacherOwns(course, req.user);

  const material = await Material.create({
    title: req.body.title || req.file.originalname,
    description: req.body.description,
    course: req.params.courseId,
    teacher: req.user.id,
    type: 'pdf',
    file: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
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
    _id: req.params.id,
    course: req.params.courseId,
  });
  if (!material) return next(new AppError('Material not found.', 404));

  // Published gating:
  // - students: only published
  // - teacher/admin: allow access (teacher must own the course)
  if (!material.isPublished && req.user.role === 'student') {
    return next(new AppError('Material not found.', 404));
  }

  if (req.user.role === 'teacher') {
    const course = await Course.findById(req.params.courseId);
    if (!course) return next(new AppError('Course not found.', 404));
    assertTeacherOwns(course, req.user);
  }

  if (req.user.role === 'student') {
    // STRICT: Check the course level matches the student's level
    const course = await Course.findById(req.params.courseId).select('level').lean();
    if (!course || !req.user.level || course.level !== req.user.level) {
      return next(new AppError('This material is not available for your academic level.', 403));
    }

    // Track download in progress
    await Progress.findOneAndUpdate(
      { student: req.user.id, course: req.params.courseId },
      { $addToSet: { downloadedMaterials: { material: material._id } } }
    );
  }

  const absolutePath = resolveSafeUploadPath(material.file.path);
  assertFileExists(absolutePath);

  // The PDF viewer does a HEAD request to validate access.
  // We must not count it as a "download" and must not stream the whole file.
  if (req.method === 'HEAD') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${String(material.file.originalName || 'file.pdf').replace(/"/g, '')}"`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).end();
  }

  await Material.findByIdAndUpdate(material._id, { $inc: { downloadCount: 1 } });
  return sendInlinePdf(res, absolutePath, material.file.originalName);
});

// ─── DELETE /courses/:courseId/materials/:id ─────────────────────────────────
export const deleteMaterial = asyncHandler(async (req, res, next) => {
  const material = await Material.findOne({
    _id: req.params.id,
    course: req.params.courseId,
  });
  if (!material) return next(new AppError('Material not found.', 404));

  const course = await Course.findById(req.params.courseId);
  assertTeacherOwns(course, req.user);

  fs.unlink(material.file.path, (err) => {
    if (err) console.warn('Could not delete file:', err.message);
  });

  await Promise.all([
    material.deleteOne(),
    Course.findByIdAndUpdate(req.params.courseId, { $pull: { materials: material._id } }),
  ]);

  sendSuccess(res, 204, {});
});
