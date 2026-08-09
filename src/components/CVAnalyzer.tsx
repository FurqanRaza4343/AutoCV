import React, { useState, useRef } from "react";
import {
  Upload,
  FileText,
  X,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  User,
  Star,
  TrendingUp,
  Briefcase,
  MapPin,
  Send,
  Cpu,
  ChevronDown,
  ChevronUp,
  Bot,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api, CVAnalysisDTO } from "../api";

interface CVAnalyzerProps {
  onPipelineRun?: (ids: string[]) => void;
  showToast?: (msg: string) => void;
  jobDescription?: string;
}

export default function CVAnalyzer({ onPipelineRun, showToast, jobDescription }: CVAnalyzerProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<CVAnalysisDTO[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles).slice(0, 5);
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      const unique = arr.filter((f) => !existing.has(f.name));
      return [...prev, ...unique].slice(0, 5);
    });
  };

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
    setResults([]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const handleAnalyze = async () => {
    if (files.length === 0) return;
    setAnalyzing(true);
    setResults([]);
    try {
      const data = await api.candidates.batchAnalyze(files, jobDescription);
      setResults(data.candidates);
      if (showToast) showToast(`Analysis complete for ${data.total_processed} CV(s)`);
    } catch (e: any) {
      if (showToast) showToast(`Analysis failed: ${e.message || e}`);
    }
    setAnalyzing(false);
  };

  const handleSendToPipeline = async () => {
    if (results.length === 0) return;
    const ids = results.map((r) => r.id || r.email);
    if (onPipelineRun) {
      onPipelineRun(ids);
    }
  };

  const verdictColor = (v: string) => {
    switch (v) {
      case "Strong Hire": return "text-emerald-600 bg-emerald-50 border-emerald-200";
      case "Hire": return "text-blue-600 bg-blue-50 border-blue-200";
      case "Consider": return "text-amber-600 bg-amber-50 border-amber-200";
      default: return "text-slate-600 bg-slate-50 border-slate-200";
    }
  };

  const scoreColor = (s: number) => {
    if (s >= 80) return "text-emerald-600";
    if (s >= 60) return "text-blue-600";
    if (s >= 40) return "text-amber-600";
    return "text-rose-600";
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 to-blue-50/50">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">CV Analysis Studio</h3>
            <p className="text-xs text-slate-500">
              Upload 1-5 real resume files (.pdf or .docx) to extract data, get a detailed AI assessment, and push to the 4-agent pipeline. Any real CV works - your own, a colleague's, or a sample resume - the AI reads the actual document text.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
            dragOver
              ? "border-indigo-400 bg-indigo-50/50"
              : "border-slate-300 hover:border-indigo-300 bg-slate-50/30"
          } ${files.length >= 5 ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
          <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
          <p className="text-sm font-semibold text-slate-700">
            {files.length >= 5 ? "Max 5 CVs reached" : "Drop CVs here or click to browse"}
          </p>
          <p className="text-xs text-slate-400 mt-1">Supports PDF and DOCX (up to 5 files)</p>
        </div>

        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">{files.length} file(s) selected</span>
                <button
                  onClick={() => { setFiles([]); setResults([]); }}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                >
                  Clear all
                </button>
              </div>
              {files.map((f, i) => (
                <div key={f.name} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
                    <span className="text-xs font-medium text-slate-700 truncate">{f.name}</span>
                    <span className="text-[10px] text-slate-400">({(f.size / 1024).toFixed(0)} KB)</span>
                  </div>
                  <button onClick={() => removeFile(f.name)} className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {files.length > 0 && (
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className={`w-full py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              analyzing
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-500 hover:to-blue-500 shadow-sm hover:shadow-md active:scale-[0.99]"
            }`}
          >
            {analyzing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Analyzing CVs with AI...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Analyze with AI ({files.length} CV{files.length > 1 ? "s" : ""})
              </>
            )}
          </button>
        )}
      </div>

      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="divide-y divide-slate-100 border-t border-slate-200"
          >
            <div className="px-5 py-3 bg-slate-50/50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 text-amber-500" />
                Analysis Results ({results.length})
              </span>
              <button
                onClick={handleSendToPipeline}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 text-white px-3.5 py-1.5 text-xs font-bold hover:bg-indigo-500 transition shadow-sm cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                Run 4-Agent Pipeline
              </button>
            </div>

            {results.map((r, idx) => (
              <div key={idx} className={`${idx !== expandedIdx ? "" : "bg-indigo-50/20"}`}>
                <button
                  onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs shrink-0 border border-indigo-200">
                      {r.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{r.name}</div>
                      <div className="text-xs text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                        <Briefcase className="h-3 w-3 shrink-0" />
                        {r.role || "Professional"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-sm font-bold font-mono ${scoreColor(r.score)}`}>{r.score}%</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${verdictColor(r.overall_verdict)}`}>
                      {r.overall_verdict}
                    </span>
                    {expandedIdx === idx ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </div>
                </button>

                <AnimatePresence>
                  {expandedIdx === idx && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-5 pb-4 space-y-3"
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="bg-white rounded-lg border border-slate-200 p-2.5">
                          <div className="text-[10px] text-slate-500 font-semibold uppercase">Email</div>
                          <div className="text-xs font-medium text-slate-800 truncate mt-0.5">{r.email || "N/A"}</div>
                        </div>
                        <div className="bg-white rounded-lg border border-slate-200 p-2.5">
                          <div className="text-[10px] text-slate-500 font-semibold uppercase">Experience</div>
                          <div className="text-xs font-medium text-slate-800 mt-0.5">{r.experience_years != null ? `${r.experience_years}y` : "N/A"}</div>
                        </div>
                        <div className="bg-white rounded-lg border border-slate-200 p-2.5">
                          <div className="text-[10px] text-slate-500 font-semibold uppercase">Location</div>
                          <div className="text-xs font-medium text-slate-800 truncate mt-0.5">{r.location || "N/A"}</div>
                        </div>
                        <div className="bg-white rounded-lg border border-slate-200 p-2.5">
                          <div className="text-[10px] text-slate-500 font-semibold uppercase">Shift</div>
                          <div className="text-xs font-medium text-slate-800 mt-0.5">{r.shift_preference || "Any"}</div>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg border border-slate-200 p-3">
                        <div className="text-[10px] text-slate-500 font-semibold uppercase mb-1.5 flex items-center gap-1">
                          <User className="h-3 w-3" /> Detailed Assessment
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">{r.detailed_assessment || r.summary}</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-2.5">
                          <div className="text-[10px] text-emerald-700 font-bold uppercase mb-1 flex items-center gap-1">
                            <Star className="h-3 w-3" /> Strengths
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {r.strengths.length > 0 ? r.strengths.map((s, i) => (
                              <span key={i} className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold border border-emerald-200">
                                {s}
                              </span>
                            )) : <span className="text-xs text-slate-400">N/A</span>}
                          </div>
                        </div>
                        <div className="bg-amber-50 rounded-lg border border-amber-200 p-2.5">
                          <div className="text-[10px] text-amber-700 font-bold uppercase mb-1 flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" /> Areas to Improve
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {r.areas_for_improvement.length > 0 ? r.areas_for_improvement.map((a, i) => (
                              <span key={i} className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-semibold border border-amber-200">
                                {a}
                              </span>
                            )) : <span className="text-xs text-slate-400">N/A</span>}
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg border border-slate-200 p-2.5">
                        <div className="text-[10px] text-slate-500 font-semibold uppercase mb-1">Skills</div>
                        <div className="flex flex-wrap gap-1.5">
                          {r.skills ? r.skills.split(",").map((s, i) => (
                            <span key={i} className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-medium border border-slate-200">
                              {s.trim()}
                            </span>
                          )) : <span className="text-xs text-slate-400">N/A</span>}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/30 text-[10px] text-slate-400 flex items-center gap-1.5">
        <Bot className="h-3 w-3" />
        <span>AI analysis powered by Mistral. 4-agent pipeline processes: Parse → Screen → Deep Rank → Finalize</span>
      </div>
    </div>
  );
}
