import mongoose from "mongoose";

import { connectToDatabase } from "../../infrastructure/db";
import { SessionModel } from "../../api/models/session.model";
import { LinkModel, type LinkPlatform } from "../../api/models/link.model";

type SessionsMissingMetadataAggregateRow = {
  _id: mongoose.Types.ObjectId;
  linkId: mongoose.Types.ObjectId | null;
};

type LinkMetadataForBackfill = {
  platform: LinkPlatform | null;
  campaign: string | null;
};

const BACKFILL_BATCH_SIZE = 500;

const buildSessionsMissingMetadataQuery = () => ({
  linkId: { $ne: null },
  $or: [
    { platform: { $in: [null, undefined] } },
    { campaign: { $in: [null, undefined] } },
  ],
});

const fetchSessionsMissingMetadataBatch = async (): Promise<
  SessionsMissingMetadataAggregateRow[]
> => {
  return SessionModel.find(buildSessionsMissingMetadataQuery(), {
    _id: 1,
    linkId: 1,
  })
    .limit(BACKFILL_BATCH_SIZE)
    .lean<SessionsMissingMetadataAggregateRow[]>();
};

const fetchLinkMetadataMapForLinkIds = async (
  linkObjectIds: mongoose.Types.ObjectId[],
): Promise<Map<string, LinkMetadataForBackfill>> => {
  if (linkObjectIds.length === 0) {
    return new Map();
  }

  const linkDocuments = await LinkModel.find(
    { _id: { $in: linkObjectIds } },
    { _id: 1, platform: 1, campaign: 1 },
  ).lean();

  const metadataByLinkId = new Map<string, LinkMetadataForBackfill>();

  for (const linkDocument of linkDocuments) {
    metadataByLinkId.set(linkDocument._id.toString(), {
      platform: (linkDocument.platform as LinkPlatform | undefined) ?? null,
      campaign: linkDocument.campaign ?? null,
    });
  }

  return metadataByLinkId;
};

const updateSessionsWithLinkMetadata = async (
  sessionsBatch: SessionsMissingMetadataAggregateRow[],
  metadataByLinkId: Map<string, LinkMetadataForBackfill>,
): Promise<number> => {
  const bulkWriteOperations = sessionsBatch
    .map((sessionRow) => {
      if (!sessionRow.linkId) {
        return null;
      }

      const linkMetadata = metadataByLinkId.get(sessionRow.linkId.toString());
      if (!linkMetadata) {
        return null;
      }

      return {
        updateOne: {
          filter: { _id: sessionRow._id },
          update: {
            $set: {
              platform: linkMetadata.platform,
              campaign: linkMetadata.campaign,
            },
          },
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

  const bulkWriteResult = await SessionModel.bulkWrite(bulkWriteOperations, {
    ordered: false,
  });

  return bulkWriteResult.modifiedCount ?? 0;
};

const backfillSessionPlatformCampaign = async (): Promise<void> => {
  console.log("[backfill] Connecting to database...");
  await connectToDatabase();

  const totalSessionsToBackfill = await SessionModel.countDocuments(
    buildSessionsMissingMetadataQuery(),
  );
  console.log(
    `[backfill] Sessions missing platform/campaign metadata: ${totalSessionsToBackfill}`,
  );

  let totalSessionsUpdated = 0;
  let processedBatchCount = 0;

  for (;;) {
    const sessionsBatch = await fetchSessionsMissingMetadataBatch();
    if (sessionsBatch.length === 0) {
      break;
    }

    const linkObjectIdsInBatch = sessionsBatch
      .map((sessionRow) => sessionRow.linkId)
      .filter(
        (linkObjectId): linkObjectId is mongoose.Types.ObjectId =>
          linkObjectId !== null,
      );

    const metadataByLinkId =
      await fetchLinkMetadataMapForLinkIds(linkObjectIdsInBatch);

    const updatedSessionCount = await updateSessionsWithLinkMetadata(
      sessionsBatch,
      metadataByLinkId,
    );

    totalSessionsUpdated += updatedSessionCount;
    processedBatchCount += 1;

    console.log(
      `[backfill] Batch #${processedBatchCount}: scanned=${sessionsBatch.length} updated=${updatedSessionCount} cumulativeUpdated=${totalSessionsUpdated}`,
    );

    if (sessionsBatch.length < BACKFILL_BATCH_SIZE) {
      break;
    }
  }

  console.log(
    `[backfill] Completed. totalSessionsUpdated=${totalSessionsUpdated}`,
  );

  await mongoose.disconnect();
};

backfillSessionPlatformCampaign().catch((backfillError: unknown) => {
  console.error("[backfill] Failed", backfillError);
  process.exit(1);
});
