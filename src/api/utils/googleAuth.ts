import { OAuth2Client } from "google-auth-library";

import { env } from "../../config/env";

export type VerifiedGoogleIdentity = {
  email: string;
  fullName: string;
  googleSub: string;
  emailVerified: boolean;
  imageUrl: string | null;
};

const googleOAuthClient = new OAuth2Client();

export const verifyGoogleIdToken = async (
  idToken: string,
): Promise<VerifiedGoogleIdentity> => {
  if (!env.GOOGLE_OAUTH_CLIENT_ID) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID is not configured on the server");
  }

  const ticket = await googleOAuthClient.verifyIdToken({
    idToken,
    audience: env.GOOGLE_OAUTH_CLIENT_ID,
  });

  const tokenPayload = ticket.getPayload();

  if (!tokenPayload?.email) {
    throw new Error("Google token does not contain an email address");
  }

  if (!tokenPayload.sub) {
    throw new Error("Google token does not contain subject identifier");
  }

  return {
    email: tokenPayload.email.toLowerCase(),
    fullName: tokenPayload.name?.trim().length ? tokenPayload.name : tokenPayload.email,
    googleSub: tokenPayload.sub,
    emailVerified: tokenPayload.email_verified === true,
    imageUrl: tokenPayload.picture?.trim().length ? tokenPayload.picture : null,
  };
};
