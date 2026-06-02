import { Router } from 'express';
import mongoose from 'mongoose';
import { env } from '../../config/env.js';

export const healthRouter = Router();

const mongoStateName = (readyState: number) => {
  switch (readyState) {
    case 0:
      return 'disconnected';
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    default:
      return 'unknown';
  }
};

const baseHealthPayload = () => ({
  success: true,
  service: 'saas-boilerplate-api',
  version: '1.0.0',
  environment: env.NODE_ENV,
  timestamp: new Date().toISOString()
});

healthRouter.get('/', (_req, res) => {
  const mongoReadyState = mongoose.connection.readyState;

  res.json({
    ...baseHealthPayload(),
    status: 'ok',
    database: {
      mongo_ready_state: mongoReadyState,
      mongo_state: mongoStateName(mongoReadyState)
    }
  });
});

healthRouter.get('/live', (_req, res) => {
  res.json({
    ...baseHealthPayload(),
    status: 'alive'
  });
});

healthRouter.get('/ready', (_req, res) => {
  const mongoReadyState = mongoose.connection.readyState;
  const ready = mongoReadyState === 1;

  res.status(ready ? 200 : 503).json({
    ...baseHealthPayload(),
    success: ready,
    status: ready ? 'ready' : 'not_ready',
    checks: {
      database: {
        ready,
        mongo_ready_state: mongoReadyState,
        mongo_state: mongoStateName(mongoReadyState)
      }
    }
  });
});
