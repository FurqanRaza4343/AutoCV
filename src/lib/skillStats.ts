// Common tech-stack keywords to scan for in free-text candidate data (e.g. a LinkedIn
// lead's snippet/summary), since that text reads like prose, not a clean comma list.
const TECH_KEYWORDS = [
  "React", "React Native", "Next.js", "Vue", "Angular", "TypeScript", "JavaScript",
  "Node.js", "Express", "Python", "Django", "Flask", "FastAPI", "Java", "Spring",
  "PHP", "Laravel", "Ruby", "Ruby on Rails", "Go", "Rust", "C++", "C#", ".NET",
  "Swift", "Kotlin", "AWS", "Azure", "GCP", "Docker", "Kubernetes", "PostgreSQL",
  "MySQL", "MongoDB", "Redis", "GraphQL", "REST", "Machine Learning", "AI",
  "DevOps", "CI/CD", "Tailwind", "HTML", "CSS", "Salesforce", "Figma",
];

interface SkillSource {
  skills?: string | null;
}

// A CV-parsed skill field is a short comma-separated token list; a lead's sourced
// snippet reads like a sentence (long, punctuated) - branch on which one this is
// rather than comma-splitting prose into meaningless multi-word fragments.
function looksLikeCleanList(text: string): boolean {
  if (!text.includes(",")) return text.length < 30;
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  const avgLen = parts.reduce((s, p) => s + p.length, 0) / (parts.length || 1);
  return avgLen < 25 && !text.includes(". ");
}

export function countSkillFrequency(items: SkillSource[], limit = 6): { name: string; count: number }[] {
  const counts: Record<string, number> = {};
  const bump = (name: string) => { counts[name] = (counts[name] || 0) + 1; };

  for (const item of items) {
    const text = (item.skills || "").trim();
    if (!text) continue;
    if (looksLikeCleanList(text)) {
      text.split(",").map((s) => s.trim()).filter(Boolean).forEach(bump);
    } else {
      for (const kw of TECH_KEYWORDS) {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(`(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`, "i");
        if (re.test(text)) bump(kw);
      }
    }
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

// A vibrant, distinct rotation instead of one flat color repeated across every bar.
export const SKILL_CHART_COLORS = ["#6366f1", "#06b6d4", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6"];
