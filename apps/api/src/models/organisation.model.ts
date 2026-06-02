import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export type OrganisationStatus = 'active' | 'inactive' | 'suspended';

export interface OrganisationDomain {
  domain: string;
  verified: boolean;
  is_primary: boolean;
}

export interface OrganisationDocument {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  status: OrganisationStatus;
  plan?: {
    plan_id?: string | null;
    plan_key?: string | null;
    name?: string | null;
    billing_status?: string | null;
    subscription_status?: 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'manual' | null;
    billing_mode?: 'manual' | 'stripe_ready' | 'custom' | null;
    trial_ends_at?: Date | null;
    current_period_ends_at?: Date | null;
    assigned_at?: Date | null;
    assigned_by_user_id?: Types.ObjectId | null;
    limits?: Record<string, number | null>;
    features_from_plan?: boolean;
    notes?: string | null;
  };
  branding: {
    logo_url?: string | null;
    favicon_url?: string | null;
    login_background_url?: string | null;
    sidebar_logo_url?: string | null;
    email_logo_url?: string | null;
    logo_file_id?: Types.ObjectId | null;
    favicon_file_id?: Types.ObjectId | null;
    login_background_file_id?: Types.ObjectId | null;
    sidebar_logo_file_id?: Types.ObjectId | null;
    email_logo_file_id?: Types.ObjectId | null;
    primary_colour?: string | null;
    secondary_colour?: string | null;
    login_title?: string | null;
    login_subtitle?: string | null;
    support_email?: string | null;
  };
  theme: {
    mode?: 'light' | 'dark' | 'system';
    primary_colour?: string | null;
    secondary_colour?: string | null;
    accent_colour?: string | null;
    background_colour?: string | null;
    surface_colour?: string | null;
    text_colour?: string | null;
    muted_text_colour?: string | null;
    border_colour?: string | null;
    success_colour?: string | null;
    warning_colour?: string | null;
    danger_colour?: string | null;
    info_colour?: string | null;
    border_radius?: string | null;
    font_family?: string | null;
  };
  domains: OrganisationDomain[];
  auth_config: {
    login_method: 'native' | 'oidc' | 'saml' | 'mixed';
    sso_enabled: boolean;
    provider?: 'azure_ad' | 'okta' | 'google' | 'keycloak' | 'custom_oidc' | 'custom' | null;
    issuer_url?: string | null;
    discovery_url?: string | null;
    client_id?: string | null;
    client_secret_ref?: string | null;
    allowed_email_domains: string[];
    auto_provision_users: boolean;
    default_role_id?: Types.ObjectId | null;
    enforce_sso: boolean;
    enforce_mfa: boolean;
    sso_config?: {
      enabled?: boolean;
      provider?: 'azure_ad' | 'okta' | 'google' | 'keycloak' | 'custom_oidc' | 'custom' | null;
      protocol?: 'oidc' | 'saml' | null;
      issuer_url?: string | null;
      discovery_url?: string | null;
      authorization_endpoint?: string | null;
      token_endpoint?: string | null;
      userinfo_endpoint?: string | null;
      jwks_uri?: string | null;
      logout_endpoint?: string | null;
      client_id?: string | null;
      client_secret_ref?: string | null;
      scopes?: string[];
      response_type?: string | null;
      pkce_enabled?: boolean;
      require_verified_email?: boolean;
      redirect_uri?: string | null;
      post_logout_redirect_uri?: string | null;
      claim_mapping?: {
        subject?: string | null;
        email?: string | null;
        first_name?: string | null;
        last_name?: string | null;
        display_name?: string | null;
        groups?: string | null;
      };
      group_role_mapping?: Array<{ external_group: string; role_id: Types.ObjectId }>;
    };
  };
  mfa_config: {
    enabled: boolean;
    provider: 'native' | 'keycloak' | 'azure_ad' | 'okta' | 'custom_oidc' | 'none';
    enforcement_mode: 'disabled' | 'app_checked' | 'idp_enforced';
    required_for_roles: string[];
    required_for_permissions: string[];
    claim_mapping: {
      amr_claim?: string | null;
      acr_claim?: string | null;
      mfa_values: string[];
    };
    recovery_policy: {
      allow_admin_reset: boolean;
      require_audit_note: boolean;
    };
  };
  features: Record<string, boolean>;
  compute_allocation?: {
    compute_pool_id?: string | null;
    allocation_type?: 'shared' | 'dedicated' | null;
    max_concurrent_jobs?: number | null;
    max_cpu?: number | null;
    max_memory_mb?: number | null;
    max_storage_gb?: number | null;
    monthly_job_limit?: number | null;
    priority?: 'low' | 'normal' | 'high' | null;
  };
  storage: {
    storage_provider?: string | null;
    storage_prefix?: string | null;
    max_storage_gb?: number | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type OrganisationHydratedDocument = HydratedDocument<OrganisationDocument>;

const organisationSchema = new Schema<OrganisationDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
      required: true
    },
    plan: {
      plan_id: { type: String, default: null },
      plan_key: { type: String, default: null, lowercase: true, trim: true },
      name: { type: String, default: null },
      billing_status: { type: String, default: null },
      subscription_status: { type: String, enum: ['trial', 'active', 'past_due', 'suspended', 'cancelled', 'manual', null], default: 'manual' },
      billing_mode: { type: String, enum: ['manual', 'stripe_ready', 'custom', null], default: 'manual' },
      trial_ends_at: { type: Date, default: null },
      current_period_ends_at: { type: Date, default: null },
      assigned_at: { type: Date, default: null },
      assigned_by_user_id: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      limits: { type: Map, of: Number, default: () => ({}) },
      features_from_plan: { type: Boolean, default: false },
      notes: { type: String, default: null }
    },
    branding: {
      logo_url: { type: String, default: null },
      favicon_url: { type: String, default: null },
      login_background_url: { type: String, default: null },
      sidebar_logo_url: { type: String, default: null },
      email_logo_url: { type: String, default: null },
      logo_file_id: { type: Schema.Types.ObjectId, ref: 'FileAsset', default: null },
      favicon_file_id: { type: Schema.Types.ObjectId, ref: 'FileAsset', default: null },
      login_background_file_id: { type: Schema.Types.ObjectId, ref: 'FileAsset', default: null },
      sidebar_logo_file_id: { type: Schema.Types.ObjectId, ref: 'FileAsset', default: null },
      email_logo_file_id: { type: Schema.Types.ObjectId, ref: 'FileAsset', default: null },
      primary_colour: { type: String, default: '#2563eb' },
      secondary_colour: { type: String, default: '#111827' },
      login_title: { type: String, default: null },
      login_subtitle: { type: String, default: null },
      support_email: { type: String, default: null }
    },
    theme: {
      mode: { type: String, enum: ['light', 'dark', 'system'], default: 'light' },
      primary_colour: { type: String, default: '#2563eb' },
      secondary_colour: { type: String, default: '#111827' },
      accent_colour: { type: String, default: '#10b981' },
      background_colour: { type: String, default: '#f8fafc' },
      surface_colour: { type: String, default: '#ffffff' },
      text_colour: { type: String, default: '#111827' },
      muted_text_colour: { type: String, default: '#6b7280' },
      border_colour: { type: String, default: '#e5e7eb' },
      success_colour: { type: String, default: '#16a34a' },
      warning_colour: { type: String, default: '#f59e0b' },
      danger_colour: { type: String, default: '#dc2626' },
      info_colour: { type: String, default: '#0284c7' },
      border_radius: { type: String, default: '12px' },
      font_family: { type: String, default: 'Inter, system-ui, sans-serif' }
    },
    domains: [
      {
        domain: { type: String, required: true, lowercase: true, trim: true },
        verified: { type: Boolean, default: false },
        is_primary: { type: Boolean, default: false }
      }
    ],
    auth_config: {
      login_method: {
        type: String,
        enum: ['native', 'oidc', 'saml', 'mixed'],
        default: 'native',
        required: true
      },
      sso_enabled: { type: Boolean, default: false },
      provider: {
        type: String,
        enum: ['azure_ad', 'okta', 'google', 'keycloak', 'custom_oidc', 'custom', null],
        default: null
      },
      issuer_url: { type: String, default: null },
      discovery_url: { type: String, default: null },
      client_id: { type: String, default: null },
      client_secret_ref: { type: String, default: null },
      allowed_email_domains: [{ type: String, lowercase: true, trim: true }],
      auto_provision_users: { type: Boolean, default: false },
      default_role_id: { type: Schema.Types.ObjectId, ref: 'Role', default: null },
      enforce_sso: { type: Boolean, default: false },
      enforce_mfa: { type: Boolean, default: false },
      sso_config: {
        enabled: { type: Boolean, default: false },
        provider: { type: String, enum: ['azure_ad', 'okta', 'google', 'keycloak', 'custom_oidc', 'custom', null], default: null },
        protocol: { type: String, enum: ['oidc', 'saml', null], default: 'oidc' },
        issuer_url: { type: String, default: null },
        discovery_url: { type: String, default: null },
        authorization_endpoint: { type: String, default: null },
        token_endpoint: { type: String, default: null },
        userinfo_endpoint: { type: String, default: null },
        jwks_uri: { type: String, default: null },
        logout_endpoint: { type: String, default: null },
        client_id: { type: String, default: null },
        client_secret_ref: { type: String, default: null },
        scopes: [{ type: String, trim: true }],
        response_type: { type: String, default: 'code' },
        pkce_enabled: { type: Boolean, default: true },
        require_verified_email: { type: Boolean, default: true },
        redirect_uri: { type: String, default: null },
        post_logout_redirect_uri: { type: String, default: null },
        claim_mapping: {
          subject: { type: String, default: 'sub' },
          email: { type: String, default: 'email' },
          first_name: { type: String, default: 'given_name' },
          last_name: { type: String, default: 'family_name' },
          display_name: { type: String, default: 'name' },
          groups: { type: String, default: 'groups' }
        },
        group_role_mapping: [
          {
            external_group: { type: String, required: true, trim: true },
            role_id: { type: Schema.Types.ObjectId, ref: 'Role', required: true }
          }
        ]
      }
    },
    mfa_config: {
      enabled: { type: Boolean, default: false },
      provider: {
        type: String,
        enum: ['native', 'keycloak', 'azure_ad', 'okta', 'custom_oidc', 'none'],
        default: 'none'
      },
      enforcement_mode: {
        type: String,
        enum: ['disabled', 'app_checked', 'idp_enforced'],
        default: 'disabled'
      },
      required_for_roles: [{ type: String, trim: true }],
      required_for_permissions: [{ type: String, trim: true }],
      claim_mapping: {
        amr_claim: { type: String, default: 'amr' },
        acr_claim: { type: String, default: 'acr' },
        mfa_values: [{ type: String, trim: true, default: undefined }]
      },
      recovery_policy: {
        allow_admin_reset: { type: Boolean, default: true },
        require_audit_note: { type: Boolean, default: true }
      }
    },
    features: {
      type: Map,
      of: Boolean,
      default: () => ({
        dashboard: true,
        user_management: true,
        role_management: true,
        branding: true,
        auth_configuration: true,
        sso_configuration: true,
        mfa_policy: true,
        personal_access_tokens: true,
        organisation_api_tokens: true,
        file_uploads: false,
        compute_allocation: false,
        compute_jobs: false,
        audit_logs: true,
        advanced_reporting: false,
        external_api_access: false
      })
    },
    compute_allocation: {
      compute_pool_id: { type: String, default: null },
      allocation_type: { type: String, enum: ['shared', 'dedicated', null], default: null },
      max_concurrent_jobs: { type: Number, default: null, min: 0 },
      max_cpu: { type: Number, default: null, min: 0 },
      max_memory_mb: { type: Number, default: null, min: 0 },
      max_storage_gb: { type: Number, default: null, min: 0 },
      monthly_job_limit: { type: Number, default: null, min: 0 },
      priority: { type: String, enum: ['low', 'normal', 'high', null], default: 'normal' }
    },
    storage: {
      storage_provider: { type: String, default: null },
      storage_prefix: { type: String, default: null },
      max_storage_gb: { type: Number, default: null, min: 0 }
    }
  },
  { timestamps: true }
);

organisationSchema.index({ slug: 1 }, { unique: true });
organisationSchema.index({ 'domains.domain': 1 });
organisationSchema.index({ status: 1 });
organisationSchema.index({ 'plan.plan_key': 1, 'plan.subscription_status': 1 });

export const OrganisationModel = model<OrganisationDocument>('Organisation', organisationSchema);
