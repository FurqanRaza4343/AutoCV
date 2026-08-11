import { create } from "zustand";
import { api, CandidateDTO, AgentDTO, NotificationDTO, QueueItemDTO, DiagnosticResult, PipelineRunDTO, PipelineResultDTO } from "../api";

export type CandidateStatus = "Applied" | "Screening" | "Interviewing" | "Offered" | "Rejected";
export type QueueStage = "Awaiting Parsing" | "Awaiting Ranking" | "Ready for Outreach" | "Invite Sent" | "Done";

export interface Candidate {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  appliedDate: string;
  matchScore: number | null;
  status: CandidateStatus;
  currentStage: QueueStage;
  summary?: string;
  gender?: string | null;
  shiftPreference?: string | null;
  age?: number | null;
  isRemote?: boolean | null;
  location?: string | null;
  skills?: string | null;
  experienceYears?: number | null;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  isRunning: boolean;
  confidenceThreshold: number;
  channel: string;
  autoScreen: boolean;
}

export interface AppNotification {
  id: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface QueueItem {
  id: string;
  candidateName: string;
  email: string;
  fileName: string | null;
  fileType: string;
  stage: string;
  score: number | null;
}

export interface DashboardConfig {
  candidatesTrend: string;
  highMatchThreshold: number;
  cvProcessedTrend: string;
  processingTimeMs: number;
  skillMatchData: { name: string; weight: number; color: string }[];
  pipelineStatusData: { name: string; color: string }[];
}

interface AppState {
  candidates: Candidate[];
  agents: Agent[];
  config: DashboardConfig;
  notifications: AppNotification[];
  queueItems: QueueItem[];
  loading: boolean;
  diagnosticResult: DiagnosticResult | null;
  pipelineRuns: PipelineRunDTO[];
  pipelineResults: PipelineResultDTO[];

  fetchCandidates: () => Promise<void>;
  fetchAgents: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  fetchQueue: () => Promise<void>;
  fetchDashboardConfig: () => Promise<void>;

  addCandidate: (candidate: Candidate) => Promise<void>;
  removeCandidate: (id: string) => Promise<void>;
  prependCandidates: (candidates: Candidate[]) => void;
  updateCandidateScore: (id: string, matchScore: number, summary: string) => Promise<void>;
  setCandidateStage: (id: string, stage: QueueStage) => Promise<void>;
  setCandidateStatus: (id: string, status: CandidateStatus) => Promise<void>;
  advanceCandidateStage: (id: string) => Promise<void>;
  screenCandidate: (id: string, jobDescription: string) => Promise<void>;
  toggleAgent: (id: string) => Promise<void>;
  updateAgentConfig: (id: string, config: { confidence_threshold?: number; channel?: string; auto_screen?: boolean }) => Promise<void>;
  runDiagnostics: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  fetchPipelineRuns: () => Promise<void>;
  runPipeline: (data: { job_title?: string; job_description: string; candidate_ids?: string[] }) => Promise<{ run: PipelineRunDTO; results: PipelineResultDTO[] }>;
  getPipelineRun: (id: string) => Promise<{ run: PipelineRunDTO; results: PipelineResultDTO[] }>;
  resetUserData: () => void;
}

function toCandidate(dto: CandidateDTO): Candidate {
  return {
    id: dto.id,
    name: dto.name,
    email: dto.email,
    role: dto.role,
    department: dto.department,
    appliedDate: dto.applied_date,
    matchScore: dto.match_score,
    status: dto.status as CandidateStatus,
    currentStage: dto.current_stage as QueueStage,
    summary: dto.summary || undefined,
    gender: dto.gender,
    shiftPreference: dto.shift_preference,
    age: dto.age,
    isRemote: dto.is_remote,
    location: dto.location,
    skills: dto.skills,
    experienceYears: dto.experience_years,
  };
}

function toAgent(dto: AgentDTO): Agent {
  return {
    id: dto.id,
    name: dto.name,
    role: dto.role,
    description: dto.description,
    isRunning: dto.is_running,
    confidenceThreshold: dto.confidence_threshold,
    channel: dto.channel,
    autoScreen: dto.auto_screen,
  };
}

function toNotification(dto: NotificationDTO): AppNotification {
  return {
    id: dto.id,
    message: dto.message,
    type: dto.type,
    isRead: dto.is_read,
    createdAt: dto.created_at,
  };
}

function toQueueItem(dto: QueueItemDTO): QueueItem {
  return {
    id: dto.id,
    candidateName: dto.candidate_name,
    email: dto.email,
    fileName: dto.file_name,
    fileType: dto.file_type,
    stage: dto.stage,
    score: dto.score,
  };
}

const initialConfig: DashboardConfig = {
  candidatesTrend: "+12% vs last month",
  highMatchThreshold: 90,
  cvProcessedTrend: "+12.4%",
  processingTimeMs: 380,
  skillMatchData: [
    { name: "React 19", weight: 0.061, color: "#4f46e5" },
    { name: "TypeScript", weight: 0.057, color: "#6366f1" },
    { name: "Tailwind CSS", weight: 0.064, color: "#3b82f6" },
    { name: "Node.js", weight: 0.048, color: "#06b6d4" },
    { name: "DevOps/AWS", weight: 0.032, color: "#10b981" },
    { name: "Product Design", weight: 0.027, color: "#f59e0b" },
  ],
  pipelineStatusData: [
    { name: "Applied", color: "#6366f1" },
    { name: "Screening", color: "#3b82f6" },
    { name: "Interviewing", color: "#10b981" },
    { name: "Offered/Rejected", color: "#94a3b8" },
  ],
};

export const useAppStore = create<AppState>((set, get) => ({
  candidates: [],
  agents: [],
  config: initialConfig,
  notifications: [],
  queueItems: [],
  loading: false,
  diagnosticResult: null,

  fetchCandidates: async () => {
    try {
      const dtos = await api.candidates.list();
      set({ candidates: dtos.map(toCandidate) });
    } catch (e) {
      console.error("fetchCandidates failed", e);
    }
  },

  fetchAgents: async () => {
    try {
      const dtos = await api.agents.list();
      set({ agents: dtos.map(toAgent) });
    } catch (e) {
      console.error("fetchAgents failed", e);
    }
  },

  fetchNotifications: async () => {
    try {
      const dtos = await api.notifications.list();
      set({ notifications: dtos.map(toNotification) });
    } catch (e) {
      console.error("fetchNotifications failed", e);
    }
  },

  fetchQueue: async () => {
    try {
      const dtos = await api.queue.list();
      set({ queueItems: dtos.map(toQueueItem) });
    } catch (e) {
      console.error("fetchQueue failed", e);
    }
  },

  fetchDashboardConfig: async () => {
    try {
      const cfg = await api.dashboard.config();
      set((state) => ({
        config: {
          ...state.config,
          highMatchThreshold: cfg.highMatchThreshold,
        },
      }));
    } catch (e) {
      console.error("fetchDashboardConfig failed", e);
    }
  },

  addCandidate: async (candidate) => {
    try {
      const dto = await api.candidates.create({
        name: candidate.name,
        email: candidate.email,
        role: candidate.role,
        department: candidate.department,
        applied_date: candidate.appliedDate,
      });
      set((state) => ({ candidates: [toCandidate(dto), ...state.candidates] }));
    } catch (e) {
      console.error("addCandidate failed", e);
      throw e;
    }
  },

  removeCandidate: async (id) => {
    try {
      await api.candidates.delete(id);
      set((state) => ({ candidates: state.candidates.filter((c) => c.id !== id) }));
    } catch (e) {
      console.error("removeCandidate failed", e);
    }
  },

  prependCandidates: (newCandidates) =>
    set((state) => ({ candidates: [...newCandidates, ...state.candidates] })),

  updateCandidateScore: async (id, matchScore, summary) => {
    try {
      await api.candidates.updateStage(id, "Done");
      await api.candidates.updateStatus(id, "Screening");
      set((state) => ({
        candidates: state.candidates.map((c) =>
          c.id === id ? { ...c, matchScore, summary, status: "Screening", currentStage: "Done" as QueueStage } : c,
        ),
      }));
    } catch (e) {
      console.error("updateCandidateScore failed", e);
    }
  },

  setCandidateStage: async (id, stage) => {
    try {
      await api.candidates.updateStage(id, stage);
      set((state) => ({
        candidates: state.candidates.map((c) =>
          c.id === id ? { ...c, currentStage: stage } : c,
        ),
      }));
    } catch (e) {
      console.error("setCandidateStage failed", e);
    }
  },

  setCandidateStatus: async (id, status) => {
    try {
      await api.candidates.updateStatus(id, status);
      set((state) => ({
        candidates: state.candidates.map((c) =>
          c.id === id ? { ...c, status } : c,
        ),
      }));
    } catch (e) {
      console.error("setCandidateStatus failed", e);
      throw e;
    }
  },

  advanceCandidateStage: async (id) => {
    const c = get().candidates.find((c) => c.id === id);
    if (!c) return;
    const next: Record<string, QueueStage> = {
      "Awaiting Parsing": "Awaiting Ranking",
      "Awaiting Ranking": "Ready for Outreach",
      "Ready for Outreach": "Invite Sent",
    };
    const nextStage = next[c.currentStage] ?? c.currentStage;
    try {
      await api.candidates.updateStage(id, nextStage);
      set((state) => ({
        candidates: state.candidates.map((x) =>
          x.id === id ? { ...x, currentStage: nextStage } : x,
        ),
      }));
    } catch (e) {
      console.error("advanceCandidateStage failed", e);
    }
  },

  screenCandidate: async (id, jobDescription) => {
    try {
      const dto = await api.candidates.screen(id, jobDescription);
      set((state) => ({
        candidates: state.candidates.map((c) =>
          c.id === id ? { ...c, matchScore: dto.match_score, summary: dto.summary || undefined, status: dto.status as CandidateStatus, currentStage: dto.current_stage as QueueStage } : c,
        ),
      }));
    } catch (e) {
      console.error("screenCandidate failed", e);
      throw e;
    }
  },

  toggleAgent: async (id) => {
    const agent = get().agents.find((a) => a.id === id);
    if (!agent) return;
    try {
      const dto = await api.agents.toggle(id, !agent.isRunning);
      set((state) => ({
        agents: state.agents.map((a) =>
          a.id === id ? { ...a, isRunning: dto.is_running } : a,
        ),
      }));
    } catch (e) {
      console.error("toggleAgent failed", e);
    }
  },

  updateAgentConfig: async (id, config) => {
    try {
      const dto = await api.agents.updateConfig(id, config);
      set((state) => ({
        agents: state.agents.map((a) =>
          a.id === id ? {
            ...a,
            confidenceThreshold: dto.confidence_threshold,
            channel: dto.channel,
            autoScreen: dto.auto_screen,
          } : a,
        ),
      }));
    } catch (e) {
      console.error("updateAgentConfig failed", e);
    }
  },

  runDiagnostics: async () => {
    try {
      const result = await api.diagnostics.run();
      set({ diagnosticResult: result });
    } catch (e) {
      console.error("runDiagnostics failed", e);
    }
  },

  markNotificationRead: async (id) => {
    try {
      await api.notifications.markRead(id);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n,
        ),
      }));
    } catch (e) {
      console.error("markNotificationRead failed", e);
    }
  },

  pipelineRuns: [],
  pipelineResults: [],

  fetchPipelineRuns: async () => {
    try {
      const runs = await api.pipeline.listRuns();
      set({ pipelineRuns: runs });
    } catch (e) {
      console.error("fetchPipelineRuns failed", e);
    }
  },

  runPipeline: async (data: { job_title?: string; job_description: string; candidate_ids?: string[] }) => {
    try {
      const result = await api.pipeline.run(data);
      set((state) => ({
        pipelineRuns: [result.run, ...state.pipelineRuns],
        pipelineResults: result.results,
      }));
      return result;
    } catch (e) {
      console.error("runPipeline failed", e);
      throw e;
    }
  },

  getPipelineRun: async (id: string) => {
    try {
      const result = await api.pipeline.getRun(id);
      set({ pipelineResults: result.results });
      return result;
    } catch (e) {
      console.error("getPipelineRun failed", e);
      throw e;
    }
  },

  // Every fetch* action only ever appends/replaces on top of whatever's already here -
  // nothing ever clears it. Without this, signing out (or switching to a different
  // account) leaves the previous account's candidates/queue/etc. visible until a fresh
  // fetch happens to succeed, which looks exactly like a data-isolation leak even when
  // the backend is scoping correctly.
  resetUserData: () => {
    set({
      candidates: [],
      agents: [],
      config: initialConfig,
      notifications: [],
      queueItems: [],
      diagnosticResult: null,
      pipelineRuns: [],
      pipelineResults: [],
    });
  },
}));

export interface PipelineRunState {
  pipelineRuns: PipelineRunDTO[];
  pipelineResults: PipelineResultDTO[];
}
