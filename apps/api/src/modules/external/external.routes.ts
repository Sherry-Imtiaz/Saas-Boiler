import { Router } from 'express';
import { requireOrganisationApiToken, requireTokenScope } from '../../middleware/auth.js';
import { HttpError } from '../../utils/httpError.js';

export const externalRouter = Router();

externalRouter.get(
  '/token-context',
  requireOrganisationApiToken,
  requireTokenScope('external:organisation.read'),
  async (req, res, next) => {
    try {
      const auth = req.auth;
      if (!auth) {
        throw new HttpError(401, 'Organisation API token context is missing.');
      }

      res.json({
        success: true,
        data: {
          current_token: auth.token_context,
          organisation_context: {
            organisation_id: auth.organisation_id
          },
          notes: [
            'This endpoint exists to validate organisation_api_token authentication in v0.6.3.',
            'Future external APIs will use the same OrganisationApiTokenAuth guard and explicit external:* scopes.'
          ]
        }
      });
    } catch (error) {
      next(error);
    }
  }
);
