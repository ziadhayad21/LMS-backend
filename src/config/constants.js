export const ROLES = Object.freeze({
  STUDENT: 'student',
  TEACHER: 'teacher',
  ADMIN:   'admin',
});

export const COURSE_LEVELS = Object.freeze([
  'أولى إعدادي',
  'تانية إعدادي',
  'تالتة إعدادي',
  'أولى ثانوي',
  'تانية ثانوي',
  'تالتة ثانوي',
  'beginner',
  'intermediate',
  'advanced',
]);



export const COURSE_CATEGORIES = Object.freeze([
  'grammar',
  'speaking',
  'writing',
  'reading',
  'listening',
  'vocabulary',
  'general',
]);

export const FILE_LIMITS = Object.freeze({
  VIDEO_MAX_MB:  500,
  PDF_MAX_MB:    50,
  IMAGE_MAX_MB:  5,
  get VIDEO_MAX_BYTES() { return this.VIDEO_MAX_MB * 1024 * 1024; },
  get PDF_MAX_BYTES()   { return this.PDF_MAX_MB   * 1024 * 1024; },
  get IMAGE_MAX_BYTES() { return this.IMAGE_MAX_MB  * 1024 * 1024; },
});

export const ALLOWED_MIME_TYPES = Object.freeze({
  VIDEO: ['video/mp4', 'video/webm', 'video/quicktime'],
  PDF:   ['application/pdf'],
  IMAGE: ['image/jpeg', 'image/png', 'image/webp'],
});

export const PAGINATION = Object.freeze({
  DEFAULT_PAGE:  1,
  DEFAULT_LIMIT: 12,
  MAX_LIMIT:     100,
});
