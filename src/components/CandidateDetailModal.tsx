import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, Mail, MapPin, Briefcase, Clock, Users, Home, Calendar, FileText } from "lucide-react";
import type { Candidate } from "../store/useAppStore";
import { scoreBadgeClass } from "../lib/scoreColor";

interface CandidateDetailModalProps {
  candidate: Candidate | null;
  onClose: () => void;
}

function Field({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">{label}</div>
        <div className="text-xs font-medium text-slate-700 truncate">{value ?? "—"}</div>
      </div>
    </div>
  );
}

// Opened when a candidate row is clicked - shows every field the app has on that
// specific candidate, unlike the compact "View Scorecard" popup (score + summary only).
export default function CandidateDetailModal({ candidate, onClose }: CandidateDetailModalProps) {
  return (
    <AnimatePresence>
      {candidate && (
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
            className="relative w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl border border-slate-200 max-h-[85vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 border border-slate-200 font-bold text-slate-800">
                  {candidate.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 truncate">{candidate.name}</h3>
                  <p className="text-xs text-slate-500 truncate">{candidate.role}{candidate.department ? ` · ${candidate.department}` : ""}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${scoreBadgeClass(candidate.matchScore)}`}>
                {candidate.matchScore !== null ? `${candidate.matchScore}% Match` : "Not scored"}
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                {candidate.status}
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                {candidate.currentStage}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4 p-3 rounded-xl bg-slate-50/70 border border-slate-100">
              <Field icon={Mail} label="Email" value={candidate.email} />
              <Field icon={MapPin} label="Location" value={candidate.location} />
              <Field icon={Briefcase} label="Experience" value={candidate.experienceYears != null ? `${candidate.experienceYears} years` : null} />
              <Field icon={Clock} label="Shift Preference" value={candidate.shiftPreference} />
              <Field icon={Users} label="Gender" value={candidate.gender} />
              <Field icon={Home} label="Remote" value={candidate.isRemote === true ? "Yes" : candidate.isRemote === false ? "No" : null} />
              <Field icon={Calendar} label="Applied" value={candidate.appliedDate} />
              <Field icon={FileText} label="Age" value={candidate.age ?? null} />
            </div>

            {candidate.skills && (
              <div className="mb-4">
                <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Skills</div>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.skills.split(",").map((s) => s.trim()).filter(Boolean).map((skill) => (
                    <span key={skill} className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-medium">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1">AI Summary</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {candidate.summary || "No AI summary available for this candidate yet."}
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
