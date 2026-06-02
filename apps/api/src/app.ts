import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { docsRouter } from './docs/docs.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';

export function createApp() {
  const app = express();

  // Swagger UI is mounted before Helmet so its scripts/styles are not blocked
  // during local development. The OpenAPI spec still marks /api/docs as Internal.
  app.use(env.API_BASE_PATH, docsRouter);

  app.use(
    helmet({
      contentSecurityPolicy: false
    })
  );
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.use(env.API_BASE_PATH, apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
