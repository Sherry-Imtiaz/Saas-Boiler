import { Router, type Request } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { AuditLogModel, FileAssetModel, OrganisationModel } from '../../models/index.js';
import { normaliseTheme, parseThemeYaml, themeToYaml } from '../../utils/brandingTheme.js';
import {
  decodeBase64File,
  deleteOrganisationStoredFile,
  formatFileAsset,
  getFileExtension,
  inferFileType,
  sanitiseFileName,
  saveOrganisationFile,
  sha256
} from '../../utils/fileAssets.js';
import { HttpError } from '../../utils/httpError.js';
import { extractImageMetadata } from '../../utils/imageMetadata.js';

export const organisationBrandingRouter = Router();

const optionalUrlSchema = z
  .string()
  .trim()
  .max(1000)
  .nullable()
  .optional()
  .refine(
    (value) => !value || value.startsWith('/api/public/assets/') || value.startsWith('/api/public/branding-assets/') || /^https?:\/\//i.test(value),
    'URL must be http(s) or an internal public asset path.'
  );

const colourSchema = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$|^[a-zA-Z0-9_ -]{2,40}$/, 'Colour must be a hex colour or short colour token.')
  .max(40)
  .nullable()
  .optional();

const updateBrandingSchema = z
  .object({
    logo_url: optionalUrlSchema,
    favicon_url: optionalUrlSchema,
    login_background_url: optionalUrlSchema,
    sidebar_logo_url: optionalUrlSchema,
    email_logo_url: optionalUrlSchema,
    primary_colour: colourSchema,
    secondary_colour: colourSchema,
    login_title: z.string().trim().min(1).max(160).nullable().optional(),
    login_subtitle: z.string().trim().max(240).nullable().optional(),
    support_email: z.string().trim().email().max(320).nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one branding field is required.');

const pxTokenSchema = z.string().trim().regex(/^\d{1,3}px$/, 'Value must be a pixel value such as 12px.').max(8);

const updateThemeSchema = z
  .object({
    mode: z.enum(['light', 'dark', 'system']).optional(),
    primary_colour: colourSchema,
    secondary_colour: colourSchema,
    accent_colour: colourSchema,
    background_colour: colourSchema,
    surface_colour: colourSchema,
    text_colour: colourSchema,
    muted_text_colour: colourSchema,
    border_colour: colourSchema,
    success_colour: colourSchema,
    warning_colour: colourSchema,
    danger_colour: colourSchema,
    info_colour: colourSchema,
    border_radius: pxTokenSchema.optional(),
    font_family: z.string().trim().min(2).max(160).optional()
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one theme field is required.');

const uploadAssetSchema = z.object({
  file_name: z.string().trim().min(1).max(180),
  mime_type: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon']),
  content_base64: z.string().min(16),
  alt_text: z.string().trim().max(160).optional()
});

const themeYamlSchema = z.object({
  yaml: z.string().min(10).max(20000)
});

const assetTypeMap = {
  logo: { urlField: 'logo_url', fileField: 'logo_file_id' },
  favicon: { urlField: 'favicon_url', fileField: 'favicon_file_id' },
  'login-background': { urlField: 'login_background_url', fileField: 'login_background_file_id' },
  'sidebar-logo': { urlField: 'sidebar_logo_url', fileField: 'sidebar_logo_file_id' },
  'email-logo': { urlField: 'email_logo_url', fileField: 'email_logo_file_id' }
} as const;

type AssetType = keyof typeof assetTypeMap;

type OrganisationBrandingRecord = Record<string, unknown> & {
  logo_url?: string | null;
  favicon_url?: string | null;
  login_background_url?: string | null;
  sidebar_logo_url?: string | null;
  email_logo_url?: string | null;
  logo_file_id?: unknown | null;
  favicon_file_id?: unknown | null;
  login_background_file_id?: unknown | null;
  sidebar_logo_file_id?: unknown | null;
  email_logo_file_id?: unknown | null;
};

function assertAuthIds(req: { auth?: { organisation_id: string; sub: string } }) {
  const organisationId = req.auth?.organisation_id;
  const userId = req.auth?.sub;
  if (!organisationId || !mongoose.isValidObjectId(organisationId)) {
    throw new HttpError(401, 'Authenticated organisation context is missing or invalid.');
  }
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw new HttpError(401, 'Authenticated user context is missing or invalid.');
  }
  return {
    organisationObjectId: new mongoose.Types.ObjectId(organisationId),
    userObjectId: new mongoose.Types.ObjectId(userId),
    organisationId,
    userId
  };
}

function publicBrandingAssetUrl(fileId: string) {
  return `/api/public/branding-assets/${fileId}`;
}

function formatBranding(organisation: {
  _id: unknown;
  name: string;
  slug: string;
  status: string;
  branding?: OrganisationBrandingRecord;
  theme?: Record<string, unknown>;
}) {
  const theme = normaliseTheme(organisation.theme as any);
  const branding = organisation.branding ?? {};

  return {
    organisation: {
      id: String(organisation._id),
      name: organisation.name,
      slug: organisation.slug,
      status: organisation.status
    },
    branding: {
      logo_url: branding.logo_url ?? null,
      favicon_url: branding.favicon_url ?? null,
      login_background_url: branding.login_background_url ?? null,
      sidebar_logo_url: branding.sidebar_logo_url ?? null,
      email_logo_url: branding.email_logo_url ?? null,
      logo_file_id: branding.logo_file_id ? String(branding.logo_file_id) : null,
      favicon_file_id: branding.favicon_file_id ? String(branding.favicon_file_id) : null,
      login_background_file_id: branding.login_background_file_id ? String(branding.login_background_file_id) : null,
      sidebar_logo_file_id: branding.sidebar_logo_file_id ? String(branding.sidebar_logo_file_id) : null,
      email_logo_file_id: branding.email_logo_file_id ? String(branding.email_logo_file_id) : null,
      primary_colour: branding.primary_colour ?? theme.primary_colour,
      secondary_colour: branding.secondary_colour ?? theme.secondary_colour,
      login_title: branding.login_title ?? `Welcome to ${organisation.name}`,
      login_subtitle: branding.login_subtitle ?? 'Sign in to continue.',
      support_email: branding.support_email ?? null
    },
    theme
  };
}

async function loadOrganisation(req: { auth?: { organisation_id: string; sub: string } }) {
  const { organisationObjectId } = assertAuthIds(req);
  const organisation = await OrganisationModel.findById(organisationObjectId);
  if (!organisation) {
    throw new HttpError(404, 'Organisation not found.');
  }
  return organisation;
}

async function writeAudit(req: Request, action: string, organisation: { _id: unknown }, details: Record<string, unknown>) {
  await AuditLogModel.create({
    organisation_id: organisation._id,
    actor_user_id: req.auth!.sub,
    action,
    resource_type: 'organisation',
    resource_id: String(organisation._id),
    details,
    ip_address: req.ip,
    user_agent: req.get('user-agent') ?? null
  });
}

organisationBrandingRouter.get('/', requireAuth, requirePermission('organisation.branding.view'), async (req, res, next) => {
  try {
    const organisation = await loadOrganisation(req);

    res.json({
      success: true,
      data: formatBranding(organisation)
    });
  } catch (error) {
    next(error);
  }
});

organisationBrandingRouter.patch('/', requireAuth, requirePermission('organisation.branding.manage'), async (req, res, next) => {
  try {
    const parsed = updateBrandingSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, 'Invalid organisation branding update request.', parsed.error.flatten());
    }

    const organisation = await loadOrganisation(req);
    const before = JSON.parse(JSON.stringify(organisation.branding));

    Object.assign(organisation.branding, parsed.data);
    await organisation.save();

    await writeAudit(req, 'organisation.branding.update', organisation, { before, after: parsed.data });

    res.json({
      success: true,
      message: 'Organisation branding updated successfully.',
      data: formatBranding(organisation)
    });
  } catch (error) {
    next(error);
  }
});

organisationBrandingRouter.get('/theme', requireAuth, requirePermission('organisation.branding.view'), async (req, res, next) => {
  try {
    const organisation = await loadOrganisation(req);
    res.json({
      success: true,
      message: 'Organisation theme returned successfully.',
      data: formatBranding(organisation)
    });
  } catch (error) {
    next(error);
  }
});

organisationBrandingRouter.patch('/theme', requireAuth, requirePermission('organisation.branding.manage'), async (req, res, next) => {
  try {
    const parsed = updateThemeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid organisation theme update request.', parsed.error.flatten());
    }

    const organisation = await loadOrganisation(req);
    const before = normaliseTheme(organisation.theme as any);
    Object.assign(organisation.theme, parsed.data);
    await organisation.save();

    await writeAudit(req, 'organisation.theme.update', organisation, { before, after: parsed.data });

    res.json({
      success: true,
      message: 'Organisation theme updated successfully.',
      data: formatBranding(organisation)
    });
  } catch (error) {
    next(error);
  }
});

organisationBrandingRouter.get('/theme-yaml', requireAuth, requirePermission('organisation.branding.view'), async (req, res, next) => {
  try {
    const organisation = await loadOrganisation(req);
    const yaml = themeToYaml({ theme: organisation.theme as any, branding: organisation.branding as unknown as Record<string, unknown> });
    res.type('text/yaml').send(yaml);
  } catch (error) {
    next(error);
  }
});

organisationBrandingRouter.post('/theme-yaml', requireAuth, requirePermission('organisation.branding.manage'), async (req, res, next) => {
  try {
    const parsed = themeYamlSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid theme YAML import request.', parsed.error.flatten());
    }

    let patch;
    try {
      patch = parseThemeYaml(parsed.data.yaml);
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : 'Invalid theme YAML.');
    }

    const organisation = await loadOrganisation(req);
    const before = formatBranding(organisation);
    Object.assign(organisation.theme, patch.theme);
    Object.assign(organisation.branding, patch.assets);
    await organisation.save();

    await writeAudit(req, 'organisation.theme.yaml_import', organisation, { before, patch });

    res.json({
      success: true,
      message: 'Organisation theme YAML imported successfully.',
      data: formatBranding(organisation)
    });
  } catch (error) {
    next(error);
  }
});

organisationBrandingRouter.post('/assets/:assetType', requireAuth, requirePermission('organisation.branding.manage'), async (req, res, next) => {
  try {
    const assetType = req.params.assetType as AssetType;
    const target = assetTypeMap[assetType];
    if (!target) {
      throw new HttpError(400, `Unsupported branding asset type: ${req.params.assetType}`);
    }

    const parsed = uploadAssetSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid branding asset upload request.', parsed.error.flatten());
    }

    const organisation = await loadOrganisation(req);
    const { organisationId, organisationObjectId, userObjectId } = assertAuthIds(req);
    const content = decodeBase64File(parsed.data.content_base64);
    if (content.length === 0 || content.length > 5 * 1024 * 1024) {
      throw new HttpError(400, 'Branding asset must be greater than 0 bytes and no larger than 5MB.');
    }

    const originalFileName = parsed.data.file_name;
    const safeFileName = `${assetType}-${Date.now()}-${sanitiseFileName(originalFileName)}`;
    const extension = getFileExtension(safeFileName);
    const fileType = inferFileType(extension, parsed.data.mime_type);
    if (fileType !== 'image') {
      throw new HttpError(400, 'Branding asset uploads must be image files.');
    }

    const fileId = new mongoose.Types.ObjectId();
    const stored = await saveOrganisationFile({ organisationId, fileId: String(fileId), fileName: safeFileName, mimeType: parsed.data.mime_type, content });
    const image = extractImageMetadata(content, parsed.data.mime_type);

    const file = await FileAssetModel.create({
      _id: fileId,
      organisation_id: organisationObjectId,
      uploaded_by_user_id: userObjectId,
      file_name: safeFileName,
      original_file_name: originalFileName,
      mime_type: parsed.data.mime_type,
      file_extension: extension,
      file_type: 'image',
      size_bytes: content.length,
      checksum_sha256: sha256(content),
      storage_provider: stored.storage_provider,
      storage_key: stored.storage_key,
      storage_path: stored.storage_path,
      visibility: 'organisation',
      status: 'active',
      description: `Branding asset: ${assetType}`,
      tags: ['branding', assetType],
      metadata: {
        branding_asset: true,
        asset_type: assetType,
        alt_text: parsed.data.alt_text ?? null,
        image
      }
    });

    const branding = organisation.branding as OrganisationBrandingRecord;
    const before = {
      url: branding[target.urlField] ?? null,
      file_id: branding[target.fileField] ? String(branding[target.fileField]) : null
    };
    const url = publicBrandingAssetUrl(String(file._id));
    branding[target.urlField] = url;
    branding[target.fileField] = file._id;
    await organisation.save();

    await writeAudit(req, 'organisation.branding.asset_upload', organisation, {
      asset_type: assetType,
      url_field: target.urlField,
      file_field: target.fileField,
      before,
      after: { url, file_id: String(file._id) },
      file: formatFileAsset(file),
      image
    });

    res.status(201).json({
      success: true,
      message: 'Branding asset uploaded and linked as a FileAsset successfully.',
      data: {
        asset_type: assetType,
        field: target.urlField,
        url,
        file: formatFileAsset(file),
        branding: formatBranding(organisation)
      }
    });
  } catch (error) {
    next(error);
  }
});

organisationBrandingRouter.delete('/assets/:assetType', requireAuth, requirePermission('organisation.branding.manage'), async (req, res, next) => {
  try {
    const assetType = req.params.assetType as AssetType;
    const target = assetTypeMap[assetType];
    if (!target) {
      throw new HttpError(400, `Unsupported branding asset type: ${req.params.assetType}`);
    }

    const organisation = await loadOrganisation(req);
    const { userObjectId, organisationObjectId } = assertAuthIds(req);
    const branding = organisation.branding as OrganisationBrandingRecord;
    const before = {
      url: branding[target.urlField] ?? null,
      file_id: branding[target.fileField] ? String(branding[target.fileField]) : null
    };

    let archivedFile = null;
    const fileId = branding[target.fileField];
    if (fileId && mongoose.isValidObjectId(String(fileId))) {
      const file = await FileAssetModel.findOne({ _id: fileId, organisation_id: organisationObjectId });
      if (file) {
        await deleteOrganisationStoredFile(file.storage_provider, file.storage_key, file.storage_path);
        file.status = 'archived';
        file.archived_at = new Date();
        file.archived_by_user_id = userObjectId;
        await file.save();
        archivedFile = formatFileAsset(file);
      }
    }

    branding[target.urlField] = null;
    branding[target.fileField] = null;
    await organisation.save();

    await writeAudit(req, 'organisation.branding.asset_delete', organisation, {
      asset_type: assetType,
      url_field: target.urlField,
      file_field: target.fileField,
      before,
      after: null,
      archived_file: archivedFile
    });

    res.json({
      success: true,
      message: 'Branding asset reference cleared successfully.',
      data: { ...formatBranding(organisation), archived_file: archivedFile }
    });
  } catch (error) {
    next(error);
  }
});
