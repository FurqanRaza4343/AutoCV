import React from "react";
import {
  Award,
  Download,
  FileText,
  FileSpreadsheet,
  File as FilePdf,
  Crown,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Star,
} from "lucide-react";
import { PipelineResultDTO, PipelineRunDTO, api } from "../api";

interface ResultsDashboardProps {
  run: PipelineRunDTO | null;
  results: PipelineResultDTO[];
  showToast: (msg: string) => void;
}

function getVerdictColor(verdict: string | null) {
  if (!verdict) return "text-slate-400";
  const v = verdict.toLowerCase();
  // A failed AI call or an unscored lead must never look like a real "Do Not
  // Recommend" rejection - both need a visibly different, neutral treatment.
  if (v.includes("needs rescoring")) return "text-slate-500 bg-slate-100 border-slate-300";
  if (v.includes("low confidence")) return "text-sky-600 bg-sky-50 border-sky-200";
  if (v.includes("strongly recommend")) return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (v.includes("recommend")) return "text-blue-600 bg-blue-50 border-blue-200";
  if (v.includes("consider")) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-rose-600 bg-rose-50 border-rose-200";
}

function getScoreColor(score: number | null) {
  if (!score) return "bg-slate-200";
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-rose-500";
}

function getScoreTextColor(score: number | null) {
  if (!score) return "text-slate-400";
  if (score >= 80) return "text-emerald-700 bg-emerald-50";
  if (score >= 60) return "text-amber-700 bg-amber-50";
  return "text-rose-700 bg-rose-50";
}

export default function ResultsDashboard({ run, results, showToast }: ResultsDashboardProps) {
  if (!run && results.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 shadow-sm flex flex-col items-center justify-center text-center">
        <Award className="h-12 w-12 text-slate-300 mb-3" />
        <h3 className="text-base font-bold text-slate-700">No Results Yet</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-md">
          Run the 4-agent AI pipeline to see candidate rankings, charts, and export reports.
        </p>
      </div>
    );
  }

  const bestMatch = results.find((r) => r.is_best_match) || results[0];
  const sorted = [...results].sort((a, b) => (a.rank_position || 999) - (b.rank_position || 999));
  // Only average over candidates that were genuinely scored - a batch of failed AI
  // calls (score = null) must not drag the average down to look like real low scores.
  const scoredResults = results.filter((r) => r.ranked_score != null || r.screened_score != null);
  const avgScore = scoredResults.length > 0
    ? Math.round(scoredResults.reduce((s, r) => s + (r.ranked_score ?? r.screened_score ?? 0), 0) / scoredResults.length)
    : 0;
  const topScore = bestMatch?.ranked_score || bestMatch?.screened_score || 0;
  const highMatchCount = results.filter((r) => (r.ranked_score || r.screened_score || 0) >= 80).length;
  const recommendCount = results.filter((r) => r.final_verdict && (r.final_verdict.toLowerCase().includes("recommend") || r.final_verdict.toLowerCase().includes("strongly"))).length;

  const handleExport = (resultId: string, format: "txt" | "xlsx" | "pdf") => {
    const urls = {
      txt: api.pipeline.exportTxt(resultId),
      xlsx: api.pipeline.exportXlsx(resultId),
      pdf: api.pipeline.exportPdf(resultId),
    };
    const token = localStorage.getItem("auth_token");
    fetch(urls[format], {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error("Export failed");
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `candidate_${resultId.slice(0, 8)}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`Exported as .${format}`);
      })
      .catch((e) => showToast(`Export error: ${e.message}`));
  };

  return (
    <div className="space-y-6">
      {run && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Pipeline Run</span>
              <h3 className="text-sm font-bold text-slate-900 mt-0.5">{run.job_title || "Pipeline Run"}</h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="font-mono">{run.total_candidates} candidates</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                run.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                run.status === "failed" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
              }`}>
                {run.status}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <TrendingUp className="h-3.5 w-3.5" />
            Avg Score
          </div>
          <div className="text-2xl font-bold text-slate-900">{avgScore}%</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <Star className="h-3.5 w-3.5 text-amber-500" />
            Top Score
          </div>
          <div className="text-2xl font-bold text-slate-900">{topScore}%</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            High Match
          </div>
          <div className="text-2xl font-bold text-slate-900">{highMatchCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <Award className="h-3.5 w-3.5 text-indigo-500" />
            Recommended
          </div>
          <div className="text-2xl font-bold text-slate-900">{recommendCount}</div>
        </div>
      </div>

      {bestMatch && (
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 shadow-lg text-white">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="h-5 w-5 text-amber-300" />
            <span className="text-xs font-semibold uppercase tracking-widest text-indigo-200">Best Match Candidate</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">{bestMatch.candidate_name}</h2>
              <p className="text-indigo-200 text-sm mt-0.5">{bestMatch.role} · {bestMatch.parsed_location || "Location N/A"}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold">{bestMatch.ranked_score || bestMatch.screened_score || "—"}</div>
                <div className="text-[10px] text-indigo-200 uppercase tracking-wider">Score</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">#{bestMatch.rank_position || "—"}</div>
                <div className="text-[10px] text-indigo-200 uppercase tracking-wider">Rank</div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {bestMatch.parsed_skills?.split(",").slice(0, 6).map((skill) => (
              <span key={skill.trim()} className="px-2.5 py-1 rounded-full bg-white/15 text-xs font-medium text-white/90 border border-white/20">
                {skill.trim()}
              </span>
            ))}
          </div>
          {bestMatch.final_notes && (
            <p className="mt-3 text-sm text-indigo-100 leading-relaxed">{bestMatch.final_notes}</p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => handleExport(bestMatch.id, "txt")}
              className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5" /> .txt
            </button>
            <button
              onClick={() => handleExport(bestMatch.id, "xlsx")}
              className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> .xlsx
            </button>
            <button
              onClick={() => handleExport(bestMatch.id, "pdf")}
              className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <FilePdf className="h-3.5 w-3.5" /> .pdf
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Full Rankings</h4>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <Download className="h-3 w-3" />
            Export all:
            {sorted.length > 0 && (
              <>
                <button onClick={() => handleExport(sorted[0].id, "txt")} className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer">.txt</button>
                <button onClick={() => handleExport(sorted[0].id, "xlsx")} className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer">.xlsx</button>
                <button onClick={() => handleExport(sorted[0].id, "pdf")} className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer">.pdf</button>
              </>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/30">
                <th className="text-center px-3 py-2.5 font-semibold text-slate-500 w-12">#</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Name</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Role</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Skills</th>
                <th className="text-center px-3 py-2.5 font-semibold text-slate-500">Scored</th>
                <th className="text-center px-3 py-2.5 font-semibold text-slate-500">Ranked</th>
                <th className="text-center px-3 py-2.5 font-semibold text-slate-500">Verdict</th>
                <th className="text-center px-3 py-2.5 font-semibold text-slate-500">Export</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((r, i) => (
                <tr key={r.id} className={`hover:bg-slate-50/50 transition ${r.is_best_match ? "bg-indigo-50/30" : ""}`}>
                  <td className="text-center px-3 py-3">
                    <div className={`flex items-center justify-center h-6 w-6 rounded-full mx-auto text-[10px] font-bold ${
                      r.is_best_match ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-slate-100 text-slate-500"
                    }`}>
                      {r.is_best_match ? <Crown className="h-3 w-3 text-amber-500" /> : r.rank_position || i + 1}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-slate-800">{r.candidate_name}</div>
                    <div className="text-[10px] text-slate-500">{r.candidate_email}</div>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{r.role || "—"}</td>
                  <td className="px-3 py-3 max-w-[200px]">
                    <div className="flex flex-wrap gap-1">
                      {(r.parsed_skills || "").split(",").slice(0, 3).map((s) => (
                        <span key={s.trim()} className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] text-slate-600">{s.trim()}</span>
                      ))}
                    </div>
                  </td>
                  <td className="text-center px-3 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${getScoreTextColor(r.screened_score)}`}>
                      {r.screened_score || "—"}
                    </span>
                  </td>
                  <td className="text-center px-3 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${getScoreTextColor(r.ranked_score)}`}>
                      {r.ranked_score || "—"}
                    </span>
                  </td>
                  <td className="text-center px-3 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${getVerdictColor(r.final_verdict)}`}>
                      {r.final_verdict || "—"}
                    </span>
                  </td>
                  <td className="text-center px-3 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleExport(r.id, "txt")} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer" title="Export TXT">
                        <FileText className="h-3 w-3" />
                      </button>
                      <button onClick={() => handleExport(r.id, "xlsx")} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 cursor-pointer" title="Export XLSX">
                        <FileSpreadsheet className="h-3 w-3" />
                      </button>
                      <button onClick={() => handleExport(r.id, "pdf")} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-rose-600 cursor-pointer" title="Export PDF">
                        <FilePdf className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">Score Distribution</h4>
          <div className="space-y-2">
            {sorted.map((r) => {
              const score = r.ranked_score || r.screened_score || 0;
              return (
                <div key={r.id} className="flex items-center gap-3">
                  <span className="text-[10px] font-medium text-slate-600 w-28 truncate">{r.candidate_name}</span>
                  <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getScoreColor(score)}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-600 w-8 text-right">{score}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
