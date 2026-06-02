import mongoose from 'mongoose';
import { env } from '../config/env.js';

export async function connectMongo(): Promise<void> {
  mongoose.set('strictQuery', true);

  await mongoose.connect(env.MONGODB_URI, {
    autoIndex: env.NODE_ENV !== 'production'
  });

  console.log('MongoDB connected');
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
