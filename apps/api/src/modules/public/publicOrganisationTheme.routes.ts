import path from 'node:path';
import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { FileAssetModel, OrganisationModel } from '../../models/index.js';
import { normaliseTheme } from '../../utils/brandingTheme.js';
import { downloadOrganisationFile } from '../../utils/fileAssets.js';
import { HttpError } from '../../utils/httpError.js';

export const publicOrganisationThemeRouter = Router();

const identifierSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(253)
  .regex(/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/, 'Identifier must be an organisation slug or domain.');

const fileNameSchema = z
  .string()
  .trim()
  .min(4)
  .max(220)
  .regex(/^[a-z0-9_-]+-[0-9]+.*\.(png|jpg|jpeg|webp|svg|ico)$/i, 'Invalid branding asset file name.');

function getStorageRoot() {
  return path.resolve(process.cwd(), 'apps', 'api', 'storage', 'organisations');
}

function formatPublicTheme(organisation: {
  _id: unknown;
  name: string;
  slug: string;
  status: string;
  branding?: Record<string, unknown>;
  theme?: Record<string, unknown>;
}) {
  const theme = normaliseTheme(organisation.theme ?? null);
  return {
    organisation: {
      id: String(organisation._id),
      name: organisation.name,
      slug: organisation.slug,
      status: organisation.status
    },
    branding: {
      logo_url: organisation.branding?.logo_url ?? null,
      favicon_url: organisation.branding?.favicon_url ?? null,
      login_background_url: organisation.branding?.login_background_url ?? null,
      sidebar_logo_url: organisation.branding?.sidebar_logo_url ?? null,
      email_logo_url: organisation.branding?.email_logo_url ?? null,
      logo_file_id: organisation.branding?.logo_file_id ? String(organisation.branding.logo_file_id) : null,
      favicon_file_id: organisation.branding?.favicon_file_id ? String(organisation.branding.favicon_file_id) : null,
      login_background_file_id: organisation.branding?.login_background_file_id ? String(organisation.branding.login_background_file_id) : null,
      sidebar_logo_file_id: organisation.branding?.sidebar_logo_file_id ? String(organisation.branding.sidebar_logo_file_id) : null,
      email_logo_file_id: organisation.branding?.email_logo_file_id ? String(organisation.branding.email_logo_file_id) : null,
      login_title: organisation.branding?.login_title ?? `Welcome to ${organisation.name}`,
      login_subtitle: organisation.branding?.login_subtitle ?? 'Sign in to continue.',
      support_email: organisation.branding?.support_email ?? null
    },
    theme
  };
}

publicOrganisationThemeRouter.get('/organisation-theme/:identifier', async (req, res, next) => {
  try {
    const parsed = identifierSchema.safeParse(req.params.identifier);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid organisation theme identifier.', parsed.error.flatten());
    }

    const identifier = parsed.data;
    const organisation = await OrganisationModel.findOne({
      $or: [{ slug: identifier }, { 'domains.domain': identifier }]
    }).lean();

    if (!organisation) {
      throw new HttpError(404, 'Organisation theme configuration not found.');
    }

    res.json({
      success: true,
      message: 'Organisation theme returned successfully.',
      data: {
        ...formatPublicTheme(organisation),
        resolved_by: organisation.slug === identifier ? 'slug' : 'domain'
      }
    });
  } catch (error) {
    next(error);
  }
});

publicOrganisationThemeRouter.get('/branding-assets/:fileId', async (req, res, next) => {
  try {
    const fileId = req.params.fileId;
    if (!mongoose.isValidObjectId(fileId)) {
      throw new HttpError(400, 'Invalid branding FileAsset id.');
    }

    const file = await FileAssetModel.findOne({ _id: fileId, status: 'active', file_type: 'image' });
    if (!file || file.metadata?.branding_asset !== true) {
      throw new HttpError(404, 'Branding asset not found.');
    }

    if (file.mime_type === 'image/svg+xml' || file.file_extension === 'svg') {
      throw new HttpError(415, 'SVG branding assets are not served from public inline asset routes.');
    }

    const downloaded = await downloadOrganisationFile(file.storage_provider, file.storage_key, file.storage_path);
    res.setHeader('Content-Type', downloaded.mime_type || file.mime_type || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(downloaded.content);
  } catch (error) {
    next(error);
  }
});

// Legacy v0.7.1 local branding asset route. Kept so old theme URLs do not break during development upgrades.
publicOrganisationThemeRouter.get('/assets/organisations/:organisationId/branding/:fileName', async (req, res, next) => {
  try {
    const organisationId = req.params.organisationId;
    if (!mongoose.isValidObjectId(organisationId)) {
      throw new HttpError(400, 'Invalid organisation asset id.');
    }

    const parsed = fileNameSchema.safeParse(req.params.fileName);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid branding asset file name.', parsed.error.flatten());
    }

    const filePath = path.join(getStorageRoot(), organisationId, 'branding', parsed.data);
    res.sendFile(filePath, (error) => {
      if (error) {
        next(new HttpError(404, 'Branding asset not found.'));
      }
    });
  } catch (error) {
    next(error);
  }
});
