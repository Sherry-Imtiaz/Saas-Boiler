import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface PermissionDocument {
  _id: Types.ObjectId;
  key: string;
  module: string;
  action: string;
  description?: string | null;
  is_active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type PermissionHydratedDocument = HydratedDocument<PermissionDocument>;

const permissionSchema = new Schema<PermissionDocument>(
  {
    key: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9_.:-]+$/
    },
    module: { type: String, required: true, lowercase: true, trim: true },
    action: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, default: null, maxlength: 500 },
    is_active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

permissionSchema.index({ key: 1 }, { unique: true });
permissionSchema.index({ module: 1, action: 1 });
permissionSchema.index({ is_active: 1 });

export const PermissionModel = model<PermissionDocument>('Permission', permissionSchema);
