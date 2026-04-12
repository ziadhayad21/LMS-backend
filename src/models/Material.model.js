import mongoose from 'mongoose';

const materialSchema = new mongoose.Schema(
  {
    title:       { type: String, required: [true, 'Title is required'], trim: true },
    description: { type: String, maxlength: [500, 'Max 500 characters'] },
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
    file: {
      filename:     { type: String, required: true },
      originalName: { type: String, required: true },
      path:         { type: String, required: true },
      size:         Number,
      mimetype:     String,
    },
    type:          { type: String, enum: ['pdf', 'doc', 'image', 'audio', 'other'], default: 'pdf' },
    downloadCount: { type: Number, default: 0 },
    isPublished:   { type: Boolean, default: true },
  },
  { timestamps: true }
);

materialSchema.index({ course: 1, isPublished: 1 });

const Material = mongoose.model('Material', materialSchema);
export default Material;
