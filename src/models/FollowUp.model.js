import mongoose from 'mongoose';

const followUpSchema = new mongoose.Schema(
  {
    teacher: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    student: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    type: {
      type:     String,
      enum:     ['note', 'reminder', 'feedback'],
      required: true,
    },
    message: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
  },
  { timestamps: true }
);

followUpSchema.index({ teacher: 1, student: 1, createdAt: -1 });

const FollowUp = mongoose.model('FollowUp', followUpSchema);
export default FollowUp;

