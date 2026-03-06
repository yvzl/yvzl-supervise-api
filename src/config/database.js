import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/feedback';

export async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB 连接成功');
  } catch (error) {
    console.error('MongoDB 连接失败:', error.message);
    process.exit(1);
  }
}

export default mongoose.connection;
