import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { SignIn, SignUp } from "@clerk/clerk-react";
import { X, LogIn, UserPlus } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

interface AuthModalProps {
  onClose: () => void;
}

// Clerk's own theming keys (rootBox/card/footerAction) - hides Clerk's default card
// chrome (border/shadow/its own "don't have an account" link) so it sits flush inside our
// modal panel below instead of looking like a card nested in a card.
const clerkAppearance = {
  elements: {
    rootBox: "w-full",
    card: "shadow-none border-none p-0 w-full bg-transparent",
    footerAction: "hidden",
    header: "hidden",
  },
  variables: {
    colorPrimary: "#0f172a",
    borderRadius: "0.5rem",
  },
} as const;

export default function AuthModal({ onClose }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const user = useAuthStore((s) => s.user);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clerk updates useAuthStore's user (via ClerkAuthBridge) the moment sign-in/sign-up
  // actually succeeds - close automatically instead of requiring a manual step.
  useEffect(() => {
    if (user) onClose();
  }, [user]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-xl border border-slate-200 my-4"
      >
        <button onClick={onClose} className="absolute right-3 top-3 sm:right-4 sm:top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition z-10">
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white">
            {mode === "login" ? <LogIn className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {mode === "login" ? "Sign In" : "Create Account"}
            </h3>
            <p className="text-xs text-slate-400">
              {mode === "login" ? "Welcome back to Agentix HR" : "Start your HR journey"}
            </p>
          </div>
        </div>

        {mode === "login" ? (
          <SignIn
            routing="virtual"
            appearance={clerkAppearance}
            disabled={isSubmitting}
            className="w-full"
          />
        ) : (
          <SignUp
            routing="virtual"
            appearance={clerkAppearance}
            disabled={isSubmitting}
            className="w-full"
          />
        )}

        <div className="mt-4 text-center text-xs text-slate-500">
          {mode === "login" ? (
            <>Don't have an account?{" "}<button onClick={() => setMode("register")} className="font-semibold text-indigo-600 hover:text-indigo-800">Sign up</button></>
          ) : (
            <>Already have an account?{" "}<button onClick={() => setMode("login")} className="font-semibold text-indigo-600 hover:text-indigo-800">Sign in</button></>
          )}
        </div>
      </motion.div>
    </div>
  );
}
