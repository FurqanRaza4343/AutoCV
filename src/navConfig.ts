export interface NavItem {
  id: string;
  label: string;
  /** Full page-title text; falls back to `label` when omitted. */
  title?: string;
  eyebrow?: string;
  subtitle?: string;
}

// Single source of truth for in-app navigation order, shared by the top navbar and the
// sidebar so the two surfaces can never drift out of sync with each other.
// Flow: land on Dashboard -> run/monitor the AI Pipeline -> review the Candidates it
// produced -> manage Agents -> view Analytics.
export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", subtitle: "Job intake, CV uploads and the staging queue" },
  { id: "pipeline", label: "AI Pipeline", subtitle: "Run and monitor AI screening, ranking and final verdicts" },
  { id: "candidates", label: "Candidates", subtitle: "Review and manage candidates produced by the pipeline" },
  {
    id: "agents",
    label: "AI Agents",
    title: "AI Agents Management",
    eyebrow: "Agent Control",
    subtitle: "Agent orchestration & advanced analytics",
  },
  { id: "analytics", label: "Analytics", subtitle: "Hiring funnel performance and trends" },
];
