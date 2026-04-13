import 'dotenv/config';
import app from './src/app.js';
import connectDB from './src/config/database.js';
import User from './src/models/User.model.js';

// IMPORTANT: Railway provides PORT dynamically
const PORT = process.env.PORT || 8080;

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

  // SEED ADMIN ACCOUNT
  const seedAdmin = async () => {
    try {
      const adminEmail = (process.env.ADMIN_EMAIL || 'admin@englishpro.com').toLowerCase();
      const adminPassword = (process.env.ADMIN_PASSWORD || 'Admin@123456');
      
      let admin = await User.findOne({ email: adminEmail });
      
      if (!admin) {
        admin = new User({
          name: 'System Admin',
          email: adminEmail,
          password: adminPassword,
          role: 'admin',
          status: 'active',
          isActive: true
        });
        await admin.save();
        console.log(`✅ Admin account created: ${adminEmail}`);
      } else {
        // Force role and status update if they changed, and re-save to ensure password hash if needed
        admin.role = 'admin';
        admin.status = 'active';
        admin.isActive = true;
        // Only update password if provided and different (bcrypt handles comparison if we wanted, but here we just reset it to be sure)
        admin.password = adminPassword;
        await admin.save();
        console.log(`✅ Admin account verified & updated: ${adminEmail}`);
      }
    } catch (err) {
      console.error('❌ Failed to seed admin user:', err.message);
    }
  };

  seedAdmin();

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