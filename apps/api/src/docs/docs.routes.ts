import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './openapi.js';

export const docsRouter = Router();

docsRouter.get('/openapi.json', (_req, res) => {
  res.json(openApiSpec);
});

docsRouter.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
