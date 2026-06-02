import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export type SsoCallbackExchangeStatus = 'active' | 'used' | 'expired';

export interface SsoCallbackExchangeDocument {
  _id: Types.ObjectId;
  code_hash: string;
  organisation_id: Types.ObjectId;
  user_id: Types.ObjectId;
  status: SsoCallbackExchangeStatus;
  expires_at: Date;
  used_at?: Date | null;
  return_to?: string | null;
  token_context: {
    auth_flow: 'oidc_authorization_code_pkce';
    mfa_required: boolean;
    mfa_verified: boolean;
    mfa_provider?: string | null;
    mfa_enforcement_mode?: string | null;
    amr: string[];
    acr?: string | null;
  };
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type SsoCallbackExchangeHydratedDocument = HydratedDocument<SsoCallbackExchangeDocument>;

const ssoCallbackExchangeSchema = new Schema<SsoCallbackExchangeDocument>(
  {
    code_hash: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    organisation_id: {
      type: Schema.Types.ObjectId,
      ref: 'Organisation',
      required: true,
      index: true
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['active', 'used', 'expired'],
      default: 'active',
      required: true,
      index: true
    },
    expires_at: {
      type: Date,
      required: true
    },
    used_at: { type: Date, default: null },
    return_to: { type: String, default: null, maxlength: 1000 },
    token_context: {
      auth_flow: {
        type: String,
        enum: ['oidc_authorization_code_pkce'],
        default: 'oidc_authorization_code_pkce',
        required: true
      },
      mfa_required: { type: Boolean, default: false, required: true },
      mfa_verified: { type: Boolean, default: false, required: true },
      mfa_provider: { type: String, default: null },
      mfa_enforcement_mode: { type: String, default: null },
      amr: [{ type: String, trim: true }],
      acr: { type: String, default: null }
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

ssoCallbackExchangeSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
ssoCallbackExchangeSchema.index({ organisation_id: 1, user_id: 1, status: 1 });

export const SsoCallbackExchangeModel = model<SsoCallbackExchangeDocument>('SsoCallbackExchange', ssoCallbackExchangeSchema);
