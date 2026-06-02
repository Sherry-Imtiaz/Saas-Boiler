import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectMongo, disconnectMongo } from './database/mongo.js';

async function bootstrap() {
  await connectMongo();

  const app = createApp();
  const server = createServer(app);

  server.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}${env.API_BASE_PATH}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received. Shutting down API...`);
    server.close(async () => {
      await disconnectMongo();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  console.error('API failed to start:', error);
  process.exit(1);
});
