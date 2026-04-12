import 'dotenv/config';
import app from './src/app.js';
import connectDB from './src/config/database.js';
import User from './src/models/User.model.js';

// IMPORTANT: Railway provides PORT dynamically
const PORT = process.env.PORT || 5000;

// Connect to MongoDB then start server
connectDB().then(() => {
  // cleanup invalid students
  User.deleteMany({
    role: 'student',
    $or: [
      { level: null },
      { level: { $exists: false } },
      { level: '' }
    ],
  })
    .then((r) => {
      if (r?.deletedCount) {
        console.log(`🧹 Removed ${r.deletedCount} invalid student(s) with no academic year.`);
      }
    })
    .catch((err) =>
      console.error('Failed to cleanup invalid students:', err?.message || err)
    );

  // START SERVER (IMPORTANT FOR RAILWAY)
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV || "production"} mode on port ${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      console.log('Process terminated.');
      process.exit(0);
    });
  });

  process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION:', err.name, err.message);
    server.close(() => process.exit(1));
  });

  process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err.name, err.message);
    process.exit(1);
  });
});