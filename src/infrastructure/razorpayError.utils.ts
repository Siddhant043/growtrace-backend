type RazorpayApiErrorBody = {
  code?: string;
  description?: string;
  field?: string;
  source?: string;
  step?: string;
  reason?: string;
};

type RazorpayThrownErrorShape = {
  statusCode?: number;
  error?: RazorpayApiErrorBody;
};

const isRazorpayThrownErrorShape = (
  candidate: unknown,
): candidate is RazorpayThrownErrorShape =>
  typeof candidate === "object" &&
  candidate !== null &&
  "statusCode" in candidate;

export const mapRazorpayFailureToApiError = (
  thrownValue: unknown,
  fallbackMessage: string,
): Error & { statusCode: number; code?: string; details?: Record<string, unknown> } => {
  if (!isRazorpayThrownErrorShape(thrownValue)) {
    const genericError = new Error(fallbackMessage) as Error & {
      statusCode: number;
    };
    genericError.statusCode = 500;
    return genericError;
  }

  const razorpayErrorBody = thrownValue.error;
  const message =
    razorpayErrorBody?.description?.trim() ||
    razorpayErrorBody?.reason?.trim() ||
    fallbackMessage;

  const mappedError = new Error(message) as Error & {
    statusCode: number;
    code?: string;
    details?: Record<string, unknown>;
  };
  mappedError.statusCode = thrownValue.statusCode ?? 502;
  if (razorpayErrorBody?.code) {
    mappedError.code = razorpayErrorBody.code;
  }
  mappedError.details = {
    razorpay: razorpayErrorBody ?? null,
  };

  return mappedError;
};
