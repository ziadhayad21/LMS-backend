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
      // List of emails that should ALWAYS be admins
      const adminEmails = [
        (process.env.ADMIN_EMAIL || 'admin@englishpro.com').toLowerCase(),
        'ziad1@gmail.com'
      ];
      
      const defaultPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';

      for (const email of adminEmails) {
        let admin = await User.findOne({ email });
        
        if (!admin) {
          admin = new User({
            name: email === 'ziad1@gmail.com' ? 'Ziad Admin' : 'System Admin',
            email: email,
            password: defaultPassword,
            role: 'admin',
            status: 'active',
            isActive: true
          });
          await admin.save();
          console.log(`✅ Admin account created: ${email}`);
        } else {
          // Force elevation to admin
          admin.role = 'admin';
          admin.status = 'active';
          admin.isActive = true;
          // We don't change the password for existing ones unless it's the default system admin
          if (email !== 'ziad1@gmail.com') {
             admin.password = defaultPassword;
          }
          await admin.save();
          console.log(`✅ Admin permissions verified for: ${email}`);
        }
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