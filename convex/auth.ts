import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";

/**
 * Auth (PLAN §5): value-first onboarding — anonymous sessions can create and
 * play a scene immediately; claiming (convex/claim.ts) transfers ownership
 * once the visitor signs in for real. Additional providers (OTP/OAuth) plug
 * in here later without touching domain code.
 */

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Anonymous],
});
