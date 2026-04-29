import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

import {
  getBehaviorEventsQueue,
  getMetricsAggregationQueue,
} from "./queue";

export const BULL_BOARD_BASE_PATH = "/admin/queues";

export const createBullBoardServerAdapter = (): ExpressAdapter => {
  const expressAdapter = new ExpressAdapter();
  expressAdapter.setBasePath(BULL_BOARD_BASE_PATH);

  createBullBoard({
    queues: [
      new BullMQAdapter(getBehaviorEventsQueue()),
      new BullMQAdapter(getMetricsAggregationQueue()),
    ],
    serverAdapter: expressAdapter,
  });

  return expressAdapter;
};
