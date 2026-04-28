import { model, Schema, type InferSchemaType } from "mongoose";

export const USER_TYPES = ["normal", "superadmin"] as const;
export type UserType = (typeof USER_TYPES)[number];
export const AUTH_TYPES = ["email", "google"] as const;
export type AuthType = (typeof AUTH_TYPES)[number];
export const SUBSCRIPTION_TYPES = ["free", "pro"] as const;
export type SubscriptionType = (typeof SUBSCRIPTION_TYPES)[number];

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
      required: function (this: {
        authMethods?: AuthType[];
        authType?: AuthType;
      }) {
        const resolvedAuthMethods = this.authMethods ?? [
          this.authType ?? "email",
        ];
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
    imageUrl: {
      type: String,
      default: null,
      trim: true,
    },
    subscription: {
      type: String,
      enum: SUBSCRIPTION_TYPES,
      default: "free",
    },
    subscriptionStartDate: {
      type: Date,
      default: null,
    },
    subscriptionEndDate: {
      type: Date,
      default: null,
    },
    isLifetimeSubscription: {
      type: Boolean,
      default: false,
    },
    isSubscriptionActive: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

type SubscriptionStatusSource = Pick<
  InferSchemaType<typeof userSchema>,
  | "subscriptionStartDate"
  | "subscriptionEndDate"
  | "isLifetimeSubscription"
  | "isSubscriptionActive"
>;

const getComputedSubscriptionStatus = (
  user: SubscriptionStatusSource,
  currentDate: Date,
): boolean => {
  if (user.isLifetimeSubscription) {
    return true;
  }

  const hasSubscriptionStartDate = user.subscriptionStartDate instanceof Date;
  const hasSubscriptionEndDate = user.subscriptionEndDate instanceof Date;
  const subscriptionStartDate = hasSubscriptionStartDate
    ? user.subscriptionStartDate
    : null;
  const subscriptionEndDate = hasSubscriptionEndDate
    ? user.subscriptionEndDate
    : null;

  if (hasSubscriptionStartDate && hasSubscriptionEndDate) {
    return (
      currentDate >= subscriptionStartDate! &&
      currentDate <= subscriptionEndDate!
    );
  }

  if (hasSubscriptionStartDate) {
    return currentDate >= subscriptionStartDate!;
  }

  if (hasSubscriptionEndDate) {
    return currentDate <= subscriptionEndDate!;
  }

  return false;
};

const syncSubscriptionStatusOnFetchedDocument = (
  user: SubscriptionStatusSource | null,
): void => {
  if (!user) {
    return;
  }

  user.isSubscriptionActive = getComputedSubscriptionStatus(user, new Date());
};

const ensureSubscriptionFieldsForStatusCheck = function ensureSubscriptionFieldsForStatusCheck(
  this: { select: (projection: Record<string, 1>) => void },
): void {
  this.select({
    isLifetimeSubscription: 1,
    subscriptionStartDate: 1,
    subscriptionEndDate: 1,
    isSubscriptionActive: 1,
  });
};

userSchema.pre("find", ensureSubscriptionFieldsForStatusCheck);
userSchema.pre("findOne", ensureSubscriptionFieldsForStatusCheck);

const syncSubscriptionStatusAfterFetch = (
  result: SubscriptionStatusSource[] | SubscriptionStatusSource | null,
): void => {
  if (Array.isArray(result)) {
    result.forEach((userDocument) =>
      syncSubscriptionStatusOnFetchedDocument(userDocument),
    );
    return;
  }

  syncSubscriptionStatusOnFetchedDocument(result);
};

userSchema.post("find", syncSubscriptionStatusAfterFetch);
userSchema.post("findOne", syncSubscriptionStatusAfterFetch);

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: string };

export const UserModel = model("User", userSchema);
