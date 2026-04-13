import mongoose from 'mongoose';

const lessonSchema = new mongoose.Schema(
  {
    title: {
      type:      String,
      required:  [true, 'Lesson title is required'],
      trim:      true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: { type: String, maxlength: [1000, 'Description cannot exceed 1000 chars'] },
    level: {
      type:     String,
      enum:     [
        'أولى إعدادي',
        'تانية إعدادي',
        'تالتة إعدادي',
        'أولى ثانوي',
        'تانية ثانوي',
        'تالتة ثانوي',
      ],
      required: [true, 'Lesson level is required'],
    },

    course: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Course',
      required: true,
    },
    teacher: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    videoFile: {
      type: {
        filename:     String,
        originalName: String,
        path:         String,
        size:         Number,
        mimetype:     String,
        duration:     Number,
      },
      default: null,
    },
    pdfFile: {
      type: {
        filename:     String,
        originalName: String,
        path:         String,
        size:         Number,
        mimetype:     String,
      },
      default: null,
    },
    videoUrl: { type: String, default: null }, // Cloudinary URL
    order: {
      type:     Number,
      required: true,
      default:  0,
      min:      0,
    },
    isPreview:   { type: Boolean, default: false },
    isPublished: { type: Boolean, default: false },
    transcriptText: { type: String, default: null },
  },
  { timestamps: true }
);

lessonSchema.index({ course: 1, order: 1 });
lessonSchema.index({ course: 1, isPublished: 1 });

const Lesson = mongoose.model('Lesson', lessonSchema);
export default Lesson;
