// Single source of truth for source-platform color coding. LinkedIn (via Google
// search) is currently the only automated sourcing platform - kept generic so a
// future source doesn't need three separate places updated again.
export function platformDotClass(platform: string): string {
  return platform.toLowerCase().includes("linkedin") ? "bg-blue-500" : "bg-slate-400";
}

export function platformBadgeClass(platform: string): string {
  return platform.toLowerCase().includes("linkedin")
    ? "bg-blue-50 text-blue-700 border border-blue-100"
    : "bg-slate-50 text-slate-600 border border-slate-100";
}
