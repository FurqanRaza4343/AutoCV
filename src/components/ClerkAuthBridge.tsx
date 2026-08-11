import { useEffect } from "react";
import { useAuth, useClerk, useUser } from "@clerk/clerk-react";
import { useAuthStore } from "../store/useAuthStore";
import { setTokenGetter } from "../api";

// Clerk's hooks only work inside a component - this bridge is the single place that
// touches them, syncing the signed-in user into useAuthStore and wiring api/index.ts's
// token getter / sign-out, so the rest of the app never needs to import from @clerk/clerk-react.
export default function ClerkAuthBridge() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const registerSignOut = useAuthStore((s) => s.registerSignOut);

  useEffect(() => {
    setTokenGetter(() => getToken());
    registerSignOut(async () => {
      await signOut();
    });
    return () => setTokenGetter(null);
  }, [getToken, signOut, registerSignOut]);

  useEffect(() => {
    if (!isLoaded) return;
    setUser(
      user
        ? {
            id: user.id,
            email: user.primaryEmailAddress?.emailAddress ?? "",
            name: user.fullName || user.primaryEmailAddress?.emailAddress?.split("@")[0] || "User",
            role: "HR Recruiter",
            avatarUrl: user.imageUrl ?? "",
          }
        : null
    );
    setLoading(false);
  }, [user, isLoaded, setUser, setLoading]);

  return null;
}
