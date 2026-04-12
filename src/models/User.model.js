import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type:      String,
      required:  [true, 'Name is required'],
      trim:      true,
      minlength: [2,  'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type:      String,
      required:  [true, 'Email is required'],
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    password: {
      type:      String,
      required:  [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select:    false, // Never returned in queries by default
    },
    role: {
      type:    String,
      enum:    ['student', 'teacher'], // admin is static (not stored in DB)
      default: 'student',
    },
    status: {
      type:    String,
      enum:    ['pending', 'active'],
      default: 'pending',
    },
    level: {
      type: String,
      default: null,
      required: function () {
        return this.role === 'student';
      },
      validate: {
        validator: function (val) {
          if (this.role !== 'student') return true;
          return typeof val === 'string' && val.trim().length > 0;
        },
        message: 'يرجى اختيار السنة الدراسية',
      },
    },



    avatar: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    lastLogin: { type: Date, default: null },
    passwordChangedAt:  Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
userSchema.index({ role: 1, status: 1, isActive: 1 });

// ─── Virtuals ─────────────────────────────────────────────────────────────────
userSchema.virtual('avatarUrl').get(function () {
  return this.avatar ? `/uploads/images/${this.avatar}` : null;
});

// ─── Hooks ───────────────────────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();
  // Subtract 1s so the JWT iat is always after this timestamp
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// ─── Instance Methods ─────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTs = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTs;
  }
  return false;
};

const User = mongoose.model('User', userSchema);
export default User;
