import mongoose from 'mongoose';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

const connectDB = async (retries = MAX_RETRIES) => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`🍃  MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️   MongoDB disconnected. Attempting reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅  MongoDB reconnected');
    });
  } catch (error) {
    console.error(`❌  MongoDB connection failed: ${error.message}`);

    if (retries > 0) {
      console.log(`Retrying in ${RETRY_DELAY_MS / 1000}s... (${retries} retries left)`);
      await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
      return connectDB(retries - 1);
    }

    console.error('All connection retries exhausted. Exiting.');
    process.exit(1);
  }
};

export default connectDB;
