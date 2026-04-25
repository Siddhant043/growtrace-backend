import { model, Schema, type InferSchemaType } from "mongoose";

export const USER_TYPES = ["normal", "superadmin"] as const;
export type UserType = (typeof USER_TYPES)[number];
export const AUTH_TYPES = ["email", "google"] as const;
export type AuthType = (typeof AUTH_TYPES)[number];

const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: function (this: { authMethods?: AuthType[]; authType?: AuthType }) {
        const resolvedAuthMethods = this.authMethods ?? [this.authType ?? "email"];
        return resolvedAuthMethods.includes("email");
      },
      select: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    userType: {
      type: String,
      enum: USER_TYPES,
      default: "normal",
    },
    authType: {
      type: String,
      enum: AUTH_TYPES,
      default: "email",
    },
    authMethods: {
      type: [String],
      enum: AUTH_TYPES,
      default: ["email"],
    },
    googleSub: {
      type: String,
      sparse: true,
      unique: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: string };

export const UserModel = model("User", userSchema);
