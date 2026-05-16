/**
 * One-time ops script: copy razorpayCustomerId from each user's latest subscription
 * onto the user document when user.razorpayCustomerId is missing.
 *
 * Usage (from server/):
 *   npx tsx src/workers/scripts/backfillRazorpayCustomerId.ts
 *
 * Requires MONGO_* env vars (same as the server) to be set.
 */
import mongoose from "mongoose";

import { SubscriptionModel } from "../../api/models/subscription.model.js";
import { UserModel } from "../../api/models/user.model.js";
import { connectToDatabase } from "../../infrastructure/db.js";

const runBackfill = async (): Promise<void> => {
  await connectToDatabase();

  const usersMissingCustomerId = await UserModel.find({
    $or: [
      { razorpayCustomerId: null },
      { razorpayCustomerId: { $exists: false } },
      { razorpayCustomerId: "" },
    ],
  })
    .select({ _id: 1, email: 1 })
    .lean();

  let updatedCount = 0;

  for (const user of usersMissingCustomerId) {
    const latestSubscription = await SubscriptionModel.findOne({
      userId: user._id,
      razorpayCustomerId: { $exists: true, $nin: [null, ""] },
    })
      .sort({ createdAt: -1 })
      .select({ razorpayCustomerId: 1 })
      .lean();

    if (!latestSubscription?.razorpayCustomerId) {
      continue;
    }

    await UserModel.updateOne(
      { _id: user._id },
      { $set: { razorpayCustomerId: latestSubscription.razorpayCustomerId } },
    );
    updatedCount += 1;
    console.log(
      `Updated user ${user._id.toString()} (${user.email}) -> ${latestSubscription.razorpayCustomerId}`,
    );
  }

  console.log(
    `Backfill complete. Updated ${updatedCount} of ${usersMissingCustomerId.length} users missing razorpayCustomerId.`,
  );

  await mongoose.disconnect();
};

runBackfill().catch((error: unknown) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
