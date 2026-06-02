import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { TOKEN_AUDIENCES, TOKEN_TYPES, type TokenAudience, type TokenType } from '../utils/tokenTypes.js';

export type TokenRecordStatus = 'active' | 'revoked' | 'expired';

export interface TokenRecordDocument {
  _id: Types.ObjectId;
  organisation_id: Types.ObjectId;
  user_id?: Types.ObjectId | null;
  created_by_user_id?: Types.ObjectId | null;
  token_type: TokenType;
  token_name: string;
  token_hash: string;
  token_prefix?: string | null;
  audience: TokenAudience;
  scopes: string[];
  status: TokenRecordStatus;
  expires_at?: Date | null;
  last_used_at?: Date | null;
  revoked_at?: Date | null;
  revoked_by_user_id?: Types.ObjectId | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type TokenRecordHydratedDocument = HydratedDocument<TokenRecordDocument>;

const tokenRecordSchema = new Schema<TokenRecordDocument>(
  {
    organisation_id: {
      type: Schema.Types.ObjectId,
      ref: 'Organisation',
      required: true,
      index: true
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    created_by_user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    token_type: {
      type: String,
      enum: TOKEN_TYPES,
      required: true,
      index: true
    },
    token_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160
    },
    token_hash: {
      type: String,
      required: true,
      trim: true
    },
    token_prefix: {
      type: String,
      default: null,
      trim: true,
      maxlength: 32
    },
    audience: {
      type: String,
      enum: TOKEN_AUDIENCES,
      required: true,
      index: true
    },
    scopes: [
      {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 160,
        match: /^[a-z0-9_.:\-/*]+$/
      }
    ],
    status: {
      type: String,
      enum: ['active', 'revoked', 'expired'],
      default: 'active',
      required: true,
      index: true
    },
    expires_at: { type: Date, default: null },
    last_used_at: { type: Date, default: null },
    revoked_at: { type: Date, default: null },
    revoked_by_user_id: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

tokenRecordSchema.index({ token_hash: 1 }, { unique: true });
tokenRecordSchema.index({ organisation_id: 1, token_type: 1, status: 1 });
tokenRecordSchema.index({ organisation_id: 1, user_id: 1, token_type: 1 });
tokenRecordSchema.index({ expires_at: 1 });

export const TokenRecordModel = model<TokenRecordDocument>('TokenRecord', tokenRecordSchema);
