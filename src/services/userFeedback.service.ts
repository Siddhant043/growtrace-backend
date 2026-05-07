import { Types } from "mongoose";

import {
  FeedbackModel,
  type FeedbackCategory,
} from "../api/models/feedback.model.js";
import { UserModel } from "../api/models/user.model.js";
import { sendFeedbackEmail } from "../infrastructure/email.js";

type ServiceApiError = Error & { statusCode: number };

const createServiceApiError = (
  message: string,
  statusCode: number,
): ServiceApiError => {
  const apiError = new Error(message) as ServiceApiError;
  apiError.statusCode = statusCode;
  return apiError;
};

const FEEDBACK_RECIPIENT_EMAIL = "siddhant@growtrace.in";

export type SubmitUserFeedbackParameters = {
  userId: string;
  message: string;
  category: FeedbackCategory;
};

export type SubmitUserFeedbackResult = {
  id: string;
  email: string;
  category: FeedbackCategory;
  submittedAt: Date;
};

export const submitUserFeedback = async (
  parameters: SubmitUserFeedbackParameters,
): Promise<SubmitUserFeedbackResult> => {
  if (!Types.ObjectId.isValid(parameters.userId)) {
    throw createServiceApiError("Invalid user id", 400);
  }

  const user = await UserModel.findOne({
    _id: new Types.ObjectId(parameters.userId),
    isDeleted: false,
  })
    .select("email")
    .lean();

  if (!user) {
    throw createServiceApiError("User not found", 404);
  }

  const createdFeedback = await FeedbackModel.create({
    userId: new Types.ObjectId(parameters.userId),
    email: user.email,
    message: parameters.message,
    category: parameters.category,
    status: "received",
  });

  await sendFeedbackEmail({
    recipientEmail: FEEDBACK_RECIPIENT_EMAIL,
    viewModel: {
      submittedByEmail: user.email,
      message: parameters.message,
      category: parameters.category,
      submittedAtIsoString: createdFeedback.createdAt.toISOString(),
    },
  });

  return {
    id: createdFeedback._id.toString(),
    email: user.email,
    category: createdFeedback.category,
    submittedAt: createdFeedback.createdAt,
  };
};
