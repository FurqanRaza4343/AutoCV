// Single source of truth for match-score color tiers, used everywhere a score is
// rendered (candidate tables, queue, pipeline results) so the same number always
// gets the same color regardless of which screen it's shown on.
export function scoreBadgeClass(score: number | null | undefined): string {
  if (score === null || score === undefined) return "text-slate-400 bg-slate-50 border-slate-100";
  if (score >= 80) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (score >= 60) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-rose-700 bg-rose-50 border-rose-200";
}

export function scoreBarClass(score: number | null | undefined): string {
  if (!score) return "bg-slate-200";
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-rose-500";
}
