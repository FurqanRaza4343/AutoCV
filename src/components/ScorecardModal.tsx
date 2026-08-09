import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, Award } from "lucide-react";
import { scoreBadgeClass } from "../lib/scoreColor";

interface ScorecardModalProps {
  open: boolean;
  name: string;
  matchScore: number | null;
  summary: string | null | undefined;
  onClose: () => void;
}

// In-app replacement for the old alert()-based "View Scorecard" popup.
export default function ScorecardModal({ open, name, matchScore, summary, onClose }: ScorecardModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl border border-slate-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <Award className="h-4.5 w-4.5" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Agentix AI Scorecard</span>
                  <h3 className="text-sm font-bold text-slate-900">{name}</h3>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 cursor-pointer"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Matching Score</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${scoreBadgeClass(matchScore)}`}>
                {matchScore !== null ? `${matchScore}%` : "Not scored"}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Resume Summary</span>
              <p className="text-xs text-slate-600 leading-relaxed mt-1">
                {summary || "No AI summary available for this candidate yet."}
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
