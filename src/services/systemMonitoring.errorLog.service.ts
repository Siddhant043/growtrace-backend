import {
  ErrorLogModel,
  type ErrorLogSeverity,
  type ErrorLogSource,
} from "../api/models/errorLog.model.js";
import { redactSensitiveValue } from "../utils/logRedaction.utils.js";

type CaptureSystemErrorParameters = {
  source: ErrorLogSource;
  service: string;
  severity: ErrorLogSeverity;
  message: string;
  stack?: string | null;
  metadata?: Record<string, unknown>;
};

export const captureSystemError = async (
  parameters: CaptureSystemErrorParameters,
): Promise<void> => {
  await ErrorLogModel.create({
    source: parameters.source,
    service: parameters.service,
    severity: parameters.severity,
    message: parameters.message.slice(0, 5000),
    stack: parameters.stack ?? null,
    metadata: redactSensitiveValue(parameters.metadata ?? {}),
  });
};
