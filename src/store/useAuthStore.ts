import { create } from "zustand";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  // Clerk's signOut() is only reachable via a hook, so ClerkAuthBridge registers the real
  // implementation here once mounted; everything else in the app just calls signOut().
  registerSignOut: (fn: () => Promise<void>) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  registerSignOut: (fn) => set({ signOut: fn }),
  signOut: async () => {},
}));
