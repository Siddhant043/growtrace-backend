import {
  collectQueueMetricsSnapshot,
} from "../services/systemMonitoring.queueMetrics.service.js";
import { refreshWorkerHealthStatuses } from "../services/systemMonitoring.workerHealth.service.js";

const MONITORING_POLL_INTERVAL_MS = 20_000;

let intervalHandle: NodeJS.Timeout | null = null;

const runMonitoringTick = async (): Promise<void> => {
  await Promise.all([collectQueueMetricsSnapshot(), refreshWorkerHealthStatuses()]);
};

export const startSystemMonitoringWorker = (): NodeJS.Timeout => {
  if (intervalHandle) {
    return intervalHandle;
  }

  void runMonitoringTick();
  intervalHandle = setInterval(() => {
    void runMonitoringTick();
  }, MONITORING_POLL_INTERVAL_MS);

  return intervalHandle;
};

export const stopSystemMonitoringWorker = (): void => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
};
