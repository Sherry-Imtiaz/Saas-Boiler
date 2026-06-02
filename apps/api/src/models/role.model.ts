import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface RoleDocument {
  _id: Types.ObjectId;
  organisation_id: Types.ObjectId;
  name: string;
  description?: string | null;
  is_system_role: boolean;
  permission_keys: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type RoleHydratedDocument = HydratedDocument<RoleDocument>;

const roleSchema = new Schema<RoleDocument>(
  {
    organisation_id: {
      type: Schema.Types.ObjectId,
      ref: 'Organisation',
      required: true,
      index: true
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: null, maxlength: 500 },
    is_system_role: { type: Boolean, default: false },
    permission_keys: [
      {
        type: String,
        required: true,
        lowercase: true,
        trim: true
      }
    ]
  },
  { timestamps: true }
);

roleSchema.index({ organisation_id: 1, name: 1 }, { unique: true });
roleSchema.index({ organisation_id: 1, is_system_role: 1 });
roleSchema.index({ organisation_id: 1, permission_keys: 1 });

export const RoleModel = model<RoleDocument>('Role', roleSchema);
