import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export type UserStatus = 'invited' | 'active' | 'disabled';
export type UserAuthType = 'native' | 'oidc' | 'saml';

export interface UserDocument {
  _id: Types.ObjectId;
  organisation_id: Types.ObjectId;
  email: string;
  email_normalised: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name: string;
  status: UserStatus;
  auth: {
    auth_type: UserAuthType;
    password_hash?: string | null;
    mfa_enabled: boolean;
    mfa_status: 'not_required' | 'not_enrolled' | 'enrolled' | 'managed_by_idp' | 'reset_required';
    mfa_provider?: 'native' | 'keycloak' | 'azure_ad' | 'okta' | 'custom_oidc' | 'none' | null;
    last_mfa_at?: Date | null;
    last_login_at?: Date | null;
    oidc_subject?: string | null;
    oidc_provider?: string | null;
    last_oidc_at?: Date | null;
  };
  role_ids: Types.ObjectId[];
  profile: {
    avatar_url?: string | null;
    phone?: string | null;
    timezone?: string | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type UserHydratedDocument = HydratedDocument<UserDocument>;

const userSchema = new Schema<UserDocument>(
  {
    organisation_id: {
      type: Schema.Types.ObjectId,
      ref: 'Organisation',
      required: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 320
    },
    email_normalised: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 320
    },
    first_name: { type: String, trim: true, default: null, maxlength: 100 },
    last_name: { type: String, trim: true, default: null, maxlength: 100 },
    display_name: { type: String, required: true, trim: true, maxlength: 200 },
    status: {
      type: String,
      enum: ['invited', 'active', 'disabled'],
      default: 'invited',
      required: true
    },
    auth: {
      auth_type: {
        type: String,
        enum: ['native', 'oidc', 'saml'],
        default: 'native',
        required: true
      },
      password_hash: { type: String, default: null },
      mfa_enabled: { type: Boolean, default: false },
      mfa_status: {
        type: String,
        enum: ['not_required', 'not_enrolled', 'enrolled', 'managed_by_idp', 'reset_required'],
        default: 'not_required'
      },
      mfa_provider: {
        type: String,
        enum: ['native', 'keycloak', 'azure_ad', 'okta', 'custom_oidc', 'none', null],
        default: 'none'
      },
      last_mfa_at: { type: Date, default: null },
      last_login_at: { type: Date, default: null },
      oidc_subject: { type: String, trim: true, default: null, maxlength: 500 },
      oidc_provider: { type: String, trim: true, default: null, maxlength: 120 },
      last_oidc_at: { type: Date, default: null }
    },
    role_ids: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Role'
      }
    ],
    profile: {
      avatar_url: { type: String, default: null },
      phone: { type: String, default: null },
      timezone: { type: String, default: 'UTC' }
    }
  },
  { timestamps: true }
);

userSchema.pre('validate', function normaliseEmail(next) {
  if (this.email) {
    this.email = this.email.trim().toLowerCase();
    this.email_normalised = this.email_normalised || this.email;
  }
  if (this.email_normalised) {
    this.email_normalised = this.email_normalised.trim().toLowerCase();
  }
  next();
});

userSchema.index({ email_normalised: 1 }, { unique: true });
userSchema.index({ organisation_id: 1, status: 1 });
userSchema.index({ organisation_id: 1, display_name: 1 });
userSchema.index({ organisation_id: 1, 'auth.oidc_subject': 1 });

export const UserModel = model<UserDocument>('User', userSchema);
