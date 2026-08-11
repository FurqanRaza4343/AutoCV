const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "" : "https://agentix-hr-api-bdf4c6a4-c75e-4067-87b5-e0d3b29e3c91.fly.dev");

// Clerk's useAuth().getToken() always returns a valid, transparently-refreshed session
// token (or null if signed out) - it can only be called from inside a React component, so
// a single bridge component registers it here once, letting this plain module call it
// fresh before every request instead of hand-rolling a token cache/refresh dance.
let _getToken: (() => Promise<string | null>) | null = null;
export function setTokenGetter(fn: (() => Promise<string | null>) | null) {
  _getToken = fn;
}

// For the few call sites that can't go through request()/uploadWithAuthRetry() (e.g. a
// plain <a>/fetch download link that needs the header set up manually).
export async function getAuthToken(): Promise<string | null> {
  return _getToken ? await _getToken() : null;
}

// The app registers a handler (showing a toast + re-opening the sign-in modal) so a
// missing/expired session surfaces as one clear message everywhere, instead of every
// call site having to special-case a raw "API 401: ..." string itself.
let _onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  _onUnauthorized = handler;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  const token = _getToken ? await _getToken() : null;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (options?.body && typeof options.body === "string") {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API_BASE}${path}`, { headers, ...options });
  if (!res.ok) {
    if (res.status === 401) {
      _onUnauthorized?.();
      throw new Error("Your session has expired - please sign in again.");
    }
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

async function uploadWithAuthRetry<T>(path: string, form: FormData, errorPrefix: string): Promise<T> {
  const token = _getToken ? await _getToken() : null;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", body: form, headers });
  if (!res.ok) {
    if (res.status === 401) {
      _onUnauthorized?.();
      throw new Error("Your session has expired - please sign in again.");
    }
    const text = await res.text();
    throw new Error(`${errorPrefix} API ${res.status}: ${text}`);
  }
  return res.json();
}

export interface CandidateDTO {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  applied_date: string;
  match_score: number | null;
  status: string;
  current_stage: string;
  summary?: string | null;
  cv_file_url?: string | null;
  gender?: string | null;
  shift_preference?: string | null;
  age?: number | null;
  source_platform?: string | null;
  is_remote?: boolean | null;
  location?: string | null;
  skills?: string | null;
  experience_years?: number | null;
  phone?: string | null;
}

export interface AgentDTO {
  id: string;
  name: string;
  role: string;
  description: string;
  is_running: boolean;
  confidence_threshold: number;
  channel: string;
  auto_screen: boolean;
}

export interface NotificationDTO {
  id: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface QueueItemDTO {
  id: string;
  candidate_name: string;
  email: string;
  file_name: string | null;
  file_type: string;
  stage: string;
  score: number | null;
}

export interface DiagnosticResult {
  status: string;
  agents_responsive: number;
  database_connected: boolean;
  api_latency_ms: number;
  message: string;
}

export const api = {
  candidates: {
    list: () => request<CandidateDTO[]>("/api/candidates"),
    create: (data: {
      name: string;
      email: string;
      role: string;
      department: string;
      applied_date: string;
    }) =>
      request<CandidateDTO>("/api/candidates", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/api/candidates/${id}`, { method: "DELETE" }),
    updateStage: (id: string, current_stage: string) =>
      request<CandidateDTO>(`/api/candidates/${id}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ current_stage }),
      }),
    updateStatus: (id: string, status: string) =>
      request<CandidateDTO>(`/api/candidates/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    deleteAll: () =>
      request<{ ok: boolean; deleted: number }>("/api/candidates/bulk", { method: "DELETE" }),
    deleteSelected: (ids: string[]) =>
      request<{ ok: boolean; deleted: number }>("/api/candidates/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enrichAll: () =>
      request<{ ok: boolean; enriched: number; scanned: number }>("/api/candidates/enrich", { method: "POST" }),
    upload: async (file: File, jobDescription: string) => {
      const form = new FormData();
      form.append("file", file);
      form.append("job_description", jobDescription);
      return uploadWithAuthRetry<CandidateDTO>("/api/candidates/upload", form, "Upload");
    },
    screen: (id: string, jobDescription: string) =>
      request<CandidateDTO>(`/api/candidates/${id}/screen`, {
        method: "POST",
        body: JSON.stringify({ title: "JD", text: jobDescription }),
      }),
    batchAnalyze: async (files: File[], jobDescription?: string) => {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      if (jobDescription) form.append("job_description", jobDescription);
      return uploadWithAuthRetry<{ candidates: CVAnalysisDTO[]; total_processed: number }>(
        "/api/candidates/batch-analyze",
        form,
        "Batch analyze"
      );
    },
  },

  agents: {
    list: () => request<AgentDTO[]>("/api/agents"),
    get: (id: string) => request<AgentDTO>(`/api/agents/${id}`),
    toggle: (id: string, is_running: boolean) =>
      request<AgentDTO>(`/api/agents/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_running }),
      }),
    updateConfig: (id: string, config: {
      confidence_threshold?: number;
      channel?: string;
      auto_screen?: boolean;
    }) =>
      request<AgentDTO>(`/api/agents/${id}/config`, {
        method: "PATCH",
        body: JSON.stringify(config),
      }),
  },

  dashboard: {
    config: () =>
      request<{
        totalCandidates: number;
        highMatchCount: number;
        highMatchThreshold: number;
        pipelineStatusData: Record<string, number>;
      }>("/api/dashboard/config"),
  },

  jobs: {
    list: () => request<{ title: string; text: string }[]>("/api/jobs"),
    save: (data: { title: string; text: string }) =>
      request<{ title: string; text: string }>("/api/jobs", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  notifications: {
    list: () => request<NotificationDTO[]>("/api/notifications"),
    markRead: (id: string) =>
      request<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: "PATCH" }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/api/notifications/${id}`, { method: "DELETE" }),
  },

  queue: {
    list: () => request<QueueItemDTO[]>("/api/queue"),
  },

  fetchCandidates: {
    fromBoards: (data: {
      job_title?: string;
      job_description: string;
      filters?: {
        gender?: string;
        shift?: string;
        remote?: boolean;
        age_min?: number;
        age_max?: number;
        location?: string;
        experience_min?: number;
        experience_max?: number;
        platforms?: string[];
      };
      max_results_per_source?: number;
    }) =>
      request<{
        fetch_id: string;
        status: string;
      }>("/api/candidates/fetch-from-boards", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getStatus: (fetchId: string) =>
      request<{
        fetch_id: string;
        status: string;
        progress: number;
        message: string;
        candidates: CandidateDTO[];
        total_fetched: number;
        platform_breakdown: Record<string, number>;
        fetch_time_ms: number;
      }>(`/api/candidates/fetch-status/${fetchId}`),
  },

  diagnostics: {
    run: () => request<DiagnosticResult>("/api/diagnostics"),
  },

  pipeline: {
    run: (data: { job_title?: string; job_description: string; candidate_ids?: string[] }) =>
      request<{
        run: PipelineRunDTO;
        results: PipelineResultDTO[];
      }>("/api/pipeline/run", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listRuns: () => request<PipelineRunDTO[]>("/api/pipeline/runs"),
    getRun: (id: string) =>
      request<{ run: PipelineRunDTO; results: PipelineResultDTO[] }>(`/api/pipeline/runs/${id}`),
    exportTxt: (resultId: string) => `${API_BASE}/api/pipeline/results/${resultId}/export-txt`,
    exportXlsx: (resultId: string) => `${API_BASE}/api/pipeline/results/${resultId}/export-xlsx`,
    exportPdf: (resultId: string) => `${API_BASE}/api/pipeline/results/${resultId}/export-pdf`,
  },

  post: <T = any>(path: string, body?: any) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
};

export interface PipelineRunDTO {
  id: string;
  job_title: string;
  job_description: string;
  status: string;
  progress: number;
  current_agent: string | null;
  total_candidates: number;
  parsed_count: number;
  screened_count: number;
  ranked_count: number;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export interface PipelineResultDTO {
  id: string;
  run_id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string | null;
  role: string | null;
  parsed_skills: string | null;
  parsed_experience: number | null;
  parsed_location: string | null;
  screened_score: number | null;
  screened_summary: string | null;
  ranked_score: number | null;
  ranked_analysis: string | null;
  rank_position: number | null;
  final_verdict: string | null;
  final_notes: string | null;
  is_best_match: boolean;
}

export interface CVAnalysisDTO {
  id?: string;
  name: string;
  email: string;
  role: string;
  score: number;
  summary: string;
  skills: string;
  experience_years: number | null;
  gender: string | null;
  shift_preference: string | null;
  is_remote: boolean | null;
  age: number | null;
  location: string | null;
  strengths: string[];
  areas_for_improvement: string[];
  detailed_assessment: string;
  overall_verdict: string;
}
