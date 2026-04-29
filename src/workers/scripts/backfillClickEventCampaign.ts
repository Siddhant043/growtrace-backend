import mongoose from "mongoose";

import { connectToDatabase } from "../../infrastructure/db";
import { ClickEventModel } from "../../api/models/clickEvent.model";
import { LinkModel } from "../../api/models/link.model";

type ClickEventsMissingCampaignAggregateRow = {
  _id: mongoose.Types.ObjectId;
  linkId: mongoose.Types.ObjectId;
};

const BACKFILL_BATCH_SIZE = 500;

const buildClickEventsMissingCampaignQuery = () => ({
  campaign: null,
});

const fetchClickEventsMissingCampaignBatch = async (): Promise<
  ClickEventsMissingCampaignAggregateRow[]
> => {
  return ClickEventModel.find(buildClickEventsMissingCampaignQuery(), {
    _id: 1,
    linkId: 1,
  })
    .limit(BACKFILL_BATCH_SIZE)
    .lean<ClickEventsMissingCampaignAggregateRow[]>();
};

const fetchCampaignByLinkIdMap = async (
  linkObjectIds: mongoose.Types.ObjectId[],
): Promise<Map<string, string | null>> => {
  if (linkObjectIds.length === 0) {
    return new Map();
  }

  const linkDocuments = await LinkModel.find(
    { _id: { $in: linkObjectIds } },
    { _id: 1, campaign: 1 },
  ).lean();

  const campaignByLinkId = new Map<string, string | null>();

  for (const linkDocument of linkDocuments) {
    campaignByLinkId.set(
      linkDocument._id.toString(),
      linkDocument.campaign ?? null,
    );
  }

  return campaignByLinkId;
};

const updateClickEventsWithCampaign = async (
  clickEventsBatch: ClickEventsMissingCampaignAggregateRow[],
  campaignByLinkId: Map<string, string | null>,
): Promise<number> => {
  const bulkWriteOperations = clickEventsBatch
    .map((clickEventRow) => {
      const resolvedCampaign = campaignByLinkId.get(
        clickEventRow.linkId.toString(),
      );

      if (resolvedCampaign === undefined) {
        return null;
      }

      return {
        updateOne: {
          filter: { _id: clickEventRow._id },
          update: { $set: { campaign: resolvedCampaign } },
        },
      };
    })
    .filter(
      (operation): operation is NonNullable<typeof operation> =>
        operation !== null,
    );

  if (bulkWriteOperations.length === 0) {
    return 0;
  }

  const bulkWriteResult = await ClickEventModel.bulkWrite(bulkWriteOperations, {
    ordered: false,
  });

  return bulkWriteResult.modifiedCount ?? 0;
};

const backfillClickEventCampaign = async (): Promise<void> => {
  console.log("[backfill:click-campaign] Connecting to database...");
  await connectToDatabase();

  const totalClickEventsToBackfill = await ClickEventModel.countDocuments(
    buildClickEventsMissingCampaignQuery(),
  );
  console.log(
    `[backfill:click-campaign] Click events missing campaign: ${totalClickEventsToBackfill}`,
  );

  let totalClickEventsUpdated = 0;
  let processedBatchCount = 0;

  for (;;) {
    const clickEventsBatch = await fetchClickEventsMissingCampaignBatch();
    if (clickEventsBatch.length === 0) {
      break;
    }

    const linkObjectIdsInBatch = Array.from(
      new Set(
        clickEventsBatch.map((clickEventRow) =>
          clickEventRow.linkId.toString(),
        ),
      ),
    ).map((linkIdString) => new mongoose.Types.ObjectId(linkIdString));

    const campaignByLinkId = await fetchCampaignByLinkIdMap(linkObjectIdsInBatch);

    const updatedClickEventCount = await updateClickEventsWithCampaign(
      clickEventsBatch,
      campaignByLinkId,
    );

    totalClickEventsUpdated += updatedClickEventCount;
    processedBatchCount += 1;

    console.log(
      `[backfill:click-campaign] Batch #${processedBatchCount}: scanned=${clickEventsBatch.length} updated=${updatedClickEventCount} cumulativeUpdated=${totalClickEventsUpdated}`,
    );

    if (clickEventsBatch.length < BACKFILL_BATCH_SIZE) {
      break;
    }
  }

  console.log(
    `[backfill:click-campaign] Completed. totalClickEventsUpdated=${totalClickEventsUpdated}`,
  );

  await mongoose.disconnect();
};

backfillClickEventCampaign().catch((backfillError: unknown) => {
  console.error("[backfill:click-campaign] Failed", backfillError);
  process.exit(1);
});
