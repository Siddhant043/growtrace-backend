import mongoose from "mongoose";

import { env } from "../config/env";

const createMongoConnectionUri = (): string => {
  const trimmedMongoUri = env.MONGO_URI.trim();
  const hasMongoProtocol =
    trimmedMongoUri.startsWith("mongodb://") ||
    trimmedMongoUri.startsWith("mongodb+srv://");
  const mongoUriWithProtocol = hasMongoProtocol
    ? trimmedMongoUri
    : `mongodb://${trimmedMongoUri}`;

  const parsedMongoUri = new URL(mongoUriWithProtocol);
  parsedMongoUri.username = encodeURIComponent(env.MONGO_USER);
  parsedMongoUri.password = encodeURIComponent(env.MONGO_PASSWORD);
  parsedMongoUri.pathname = `/${env.MONGO_DB}`;
  if (!parsedMongoUri.searchParams.has("authSource")) {
    parsedMongoUri.searchParams.set("authSource", "admin");
  }

  return parsedMongoUri.toString();
};

export const connectToDatabase = async (): Promise<typeof mongoose> => {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  return mongoose.connect(createMongoConnectionUri());
};
