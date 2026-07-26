import React, { useState, useMemo, useEffect } from "react";
import { useAppStore, CandidateStatus, QueueStage } from "./store/useAppStore";
import { useAuthStore } from "./store/useAuthStore";
import { api } from "./api";
import { 
  Bot, Sparkles, Search, Plus, Filter, CheckCircle2, 
  FileText, Sliders, Eye, RefreshCw, 
  AlertCircle, UserCheck, Trash2, Check, X, Activity
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Navbar from "./components/Navbar";
import AuthModal from "./components/AuthModal";
import AgentAnalytics from "./components/AgentAnalytics";
import BulkUploadZone from "./components/BulkUploadZone";
import AgentQueue from "./components/AgentQueue";
import LandingPage from "./components/LandingPage";
import FetchFilters, { FiltersState } from "./components/FetchFilters";
import PipelineRunner from "./components/PipelineRunner";
import ResultsDashboard from "./components/ResultsDashboard";
import CVAnalyzer from "./components/CVAnalyzer";
import { CandidateDTO } from "./api";

// Define TypeScript interfaces for our application state
interface AIAgent {
  id: string;
  name: string;
  tag: string;
  description: string;
  status: "Active" | "Paused" | "Idle";
  efficiency: string;
  tasksCompleted: number;
  config: {
    confidenceThreshold: number;
    channel: string;
    autoScreen: boolean;
  };
}

// Pluralization helper: plural(3, "agent") → "3 agents", plural(1, "agent") → "1 agent"
// Optional custom plural form: plural(2, "CV", "CVs") → "2 CVs"
const plural = (count: number, singular: string, pluralForm?: string): string => {
  const word = count === 1 ? singular : (pluralForm ?? `${singular}s`);
  return `${count} ${word}`;
};

interface SidebarItemProps {
  tab: string;
  label: string;
  currentTab: string;
  onNavigate: (tab: string) => void;
  badge?: string;
  badgeClass?: string;
}

function SidebarItem({ tab, label, currentTab, onNavigate, badge, badgeClass }: SidebarItemProps) {
  const isActive = currentTab === tab;
  return (
    <button
      onClick={() => onNavigate(tab)}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition text-left cursor-pointer ${
        isActive
          ? "bg-slate-100 text-slate-900 font-semibold"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      <span>{label}</span>
      {badge && (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeClass || "bg-slate-100 text-slate-600"}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

export default function App() {
  // Current Navigation Tab
  const [currentTab, setCurrentTab] = useState("landing");

  // Authentication State
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const signOutAction = useAuthStore((s) => s.signOut);
  const setUser = useAuthStore((s) => s.setUser);

  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    hydrateAuth();
  }, []);

  // Notifications State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Quick Action notification triggers
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const config = useAppStore((s) => s.config);
  const candidates = useAppStore((s) => s.candidates);
  const agents = useAppStore((s) => s.agents);
  const addCandidate = useAppStore((s) => s.addCandidate);
  const removeCandidate = useAppStore((s) => s.removeCandidate);
  const prependCandidates = useAppStore((s) => s.prependCandidates);
  const updateCandidateScore = useAppStore((s) => s.updateCandidateScore);
  const setCandidateStage = useAppStore((s) => s.setCandidateStage);
  const advanceCandidateStage = useAppStore((s) => s.advanceCandidateStage);
  const screenCandidate = useAppStore((s) => s.screenCandidate);
  const updateAgentConfig = useAppStore((s) => s.updateAgentConfig);
  const runDiagnosticsAction = useAppStore((s) => s.runDiagnostics);
  const fetchNotifications = useAppStore((s) => s.fetchNotifications);
  const fetchQueue = useAppStore((s) => s.fetchQueue);
  const notifications = useAppStore((s) => s.notifications);
  const queueItems = useAppStore((s) => s.queueItems);
  const diagnosticResult = useAppStore((s) => s.diagnosticResult);
  const markNotificationRead = useAppStore((s) => s.markNotificationRead);
  const toggleAgent = useAppStore((s) => s.toggleAgent);

  const pipelineRuns = useAppStore((s) => s.pipelineRuns);
  const pipelineResults = useAppStore((s) => s.pipelineResults);
  const runPipelineAction = useAppStore((s) => s.runPipeline);
  const fetchPipelineRuns = useAppStore((s) => s.fetchPipelineRuns);
  const getPipelineRun = useAppStore((s) => s.getPipelineRun);
  const [selectedPipelineRunId, setSelectedPipelineRunId] = useState<string | null>(null);

  const scored = candidates.filter(c => c.matchScore !== null);
  const avgMatch = scored.length ? Math.round(scored.reduce((a, c) => a + (c.matchScore ?? 0), 0) / scored.length) : 0;
  const avgMatchScoreLabel = `${avgMatch}% Match`;

  // 1. Load initial data from backend on mount
  useEffect(() => {
    useAppStore.getState().fetchCandidates();
    useAppStore.getState().fetchAgents();
    fetchNotifications();
    fetchQueue();
  }, []);

  useEffect(() => {
    if (currentTab !== "landing") {
      fetchQueue();
    }
  }, [candidates.length]);

  useEffect(() => {
    if (currentTab === "pipeline") {
      fetchPipelineRuns();
    }
  }, [currentTab]);

  // 2. Candidates & Agents live in useAppStore

  // Mobile sidebar toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Search & Filter state for candidates tab
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals & Drawers States
  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);
  const [selectedAgentForConfig, setSelectedAgentForConfig] = useState<AIAgent | null>(null);
  const [diagnosticRunning, setDiagnosticRunning] = useState(false);

  // JD & CV Upload Workspace States
  const [jobDescription, setJobDescription] = useState<string>(`We are looking for a Senior Full Stack Engineer to join our core product team. 

Key Responsibilities:
- Design, build, and maintain highly scalable React applications with TypeScript
- Build modern, pixel-perfect user interfaces using Tailwind CSS
- Integrate state management solutions and asynchronous backend services
- Collaborate with product managers, UX designers, and other engineers

Required Skills:
- 5+ years of software engineering experience
- Expertise in React, TypeScript, and modern styling utilities
- Strong system architecture and API integration patterns`);

  const [isJdSaved, setIsJdSaved] = useState(false);
  const [stagedCvs, setStagedCvs] = useState<{ id: string; name: string; size: string; status: "staged" | "parsing" | "completed" }[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [actualFiles, setActualFiles] = useState<Map<string, File>>(new Map());
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isLeaderboardRevealed, setIsLeaderboardRevealed] = useState<boolean>(false);
  const [isScoringRunning, setIsScoringRunning] = useState(false);
  const [scoringProgress, setScoringProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isFetchingFromBoards, setIsFetchingFromBoards] = useState(false);
  const [fetchedCandidates, setFetchedCandidates] = useState<CandidateDTO[]>([]);
  const [fetchPlatformBreakdown, setFetchPlatformBreakdown] = useState<Record<string, number>>({});
  const [fetchTimeMs, setFetchTimeMs] = useState(0);
  const [fetchMessage, setFetchMessage] = useState("");
  const [boardFilters, setBoardFilters] = useState<FiltersState>({
    gender: "", shift: "", remote: "", ageMin: "", ageMax: "",
    location: "", experienceMin: "", experienceMax: "",
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesList = Array.from(e.dataTransfer.files);
      const newStaged = filesList.map((file: File, idx) => ({
        id: `custom-cv-${Date.now()}-${idx}`,
        name: file.name,
        size: `${Math.round(file.size / 1024)} KB`,
        status: "staged" as const
      }));
      setStagedCvs(prev => [...prev, ...newStaged]);
      setFiles(prev => [...prev, ...newStaged]);
      setActualFiles(prev => {
        const next = new Map(prev);
        newStaged.forEach((s, i) => next.set(s.id, filesList[i]));
        return next;
      });
      showToast(`Staged ${plural(filesList.length, "candidate CV file")}`);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesList = Array.from(e.target.files);
      const newStaged = filesList.map((file: File, idx) => ({
        id: `custom-cv-${Date.now()}-${idx}`,
        name: file.name,
        size: `${Math.round(file.size / 1024)} KB`,
        status: "staged" as const
      }));
      setStagedCvs(prev => [...prev, ...newStaged]);
      setFiles(prev => [...prev, ...newStaged]);
      setActualFiles(prev => {
        const next = new Map(prev);
        newStaged.forEach((s, i) => next.set(s.id, filesList[i]));
        return next;
      });
      showToast(`Staged ${plural(filesList.length, "candidate CV file")}`);
    }
  };

  const handleFetchFromBoards = async () => {
    if (!jobDescription.trim()) {
      showToast("Please enter a Job Description first");
      return;
    }
    setIsFetchingFromBoards(true);
    setFetchedCandidates([]);
    setFetchMessage("Starting...");
    showToast("Searching job boards for real candidates...");
    try {
      const f = boardFilters;
      const result = await api.fetchCandidates.fromBoards({
        job_title: jobDescription.split("\n")[0].slice(0, 60),
        job_description: jobDescription,
        max_results_per_source: 15,
        filters: {
          gender: f.gender || undefined,
          shift: f.shift || undefined,
          remote: f.remote ? f.remote === "true" : undefined,
          age_min: f.ageMin ? parseInt(f.ageMin) : undefined,
          age_max: f.ageMax ? parseInt(f.ageMax) : undefined,
          location: f.location || undefined,
          experience_min: f.experienceMin ? parseInt(f.experienceMin) : undefined,
          experience_max: f.experienceMax ? parseInt(f.experienceMax) : undefined,
        },
      });
      // Poll for completion
      const poll = async (): Promise<void> => {
        const status = await api.fetchCandidates.getStatus(result.fetch_id);
        setFetchMessage(status.message || `Fetching... ${status.progress ?? 0}%`);
        if (status.status === "completed") {
          setFetchedCandidates(status.candidates || []);
          setFetchPlatformBreakdown(status.platform_breakdown);
          setFetchTimeMs(status.fetch_time_ms);
          if (status.total_fetched > 0) {
            showToast(`Found ${status.total_fetched} candidates ${status.fetch_time_ms > 0 ? `in ${status.fetch_time_ms}ms` : ""}!`);
            await useAppStore.getState().fetchCandidates();
          } else {
            showToast("No candidates matched your filters. Try broader criteria.");
          }
          setFetchMessage("");
          setIsFetchingFromBoards(false);
          return;
        }
        if (status.status === "error") {
          showToast(`Fetch failed: ${status.message}`);
          setFetchMessage(status.message || "Failed");
          setFetchMessage("");
          setIsFetchingFromBoards(false);
          return;
        }
        // Still processing — retry after 2s
        setTimeout(poll, 2000);
      };
      await poll();
    } catch (e: any) {
      showToast(`Fetch failed: ${e.message || e}`);
      setIsFetchingFromBoards(false);
    }
  };

  const handleSaveJd = async () => {
    if (!jobDescription.trim()) {
      showToast("Error: Job Description cannot be empty");
      return;
    }
    try {
      await api.jobs.save({ title: "Current JD", text: jobDescription });
      setIsJdSaved(true);
      showToast("Success: Job Description successfully saved and vectorized!");
    } catch (e) {
      showToast(`Failed to save JD: ${e}`);
    }
  };

  const handleJdChange = (val: string) => {
    setJobDescription(val);
    if (isJdSaved) {
      setIsJdSaved(false);
    }
  };

  const handleRemoveStagedCv = (id: string) => {
    setStagedCvs(prev => prev.filter(cv => cv.id !== id));
    setFiles(prev => prev.filter(cv => cv.id !== id));
    setActualFiles(prev => { const next = new Map(prev); next.delete(id); return next; });
    showToast("Candidate CV removed from staging");
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isJdSaved || (stagedCvs.length === 0 && files.length === 0)) {
      showToast("Please save the Job Description and stage CV files first");
      return;
    }

    setIsProcessing(true);
    setIsScoringRunning(true);
    setScoringProgress(0);
    showToast("Initializing Agentix AI engine analysis...");

    // Set all files/CVs status to parsing
    setStagedCvs(prev => prev.map(cv => ({ ...cv, status: "parsing" })));
    setFiles(prev => prev.map(f => ({ ...f, status: "parsing" })));

    const activeFilesList = stagedCvs.length > 0 ? stagedCvs : files;

    for (let idx = 0; idx < activeFilesList.length; idx++) {
      const cv = activeFilesList[idx];
      setScoringProgress(Math.round(((idx) / activeFilesList.length) * 90));

      const file = actualFiles.get(cv.id);
      if (file) {
        try {
          const dto = await api.candidates.upload(file, jobDescription);
          prependCandidates([{
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
          }]);
        } catch (e) {
          showToast(`Upload failed for ${cv.name}: ${e}`);
        }
      }

      setStagedCvs(curr => curr.map((c, i) => i === idx ? { ...c, status: "completed" } : c));
      setFiles(curr => curr.map((c, i) => i === idx ? { ...c, status: "completed" } : c));
    }

    setScoringProgress(100);
    setActualFiles(new Map());
    setStagedCvs([]);
    setFiles([]);
    setIsProcessing(false);
    setIsScoringRunning(false);
    setScoringProgress(0);
    setIsLeaderboardRevealed(true);

    await useAppStore.getState().fetchCandidates();

    showToast(`Agentix Scoring Complete! Evaluated and imported ${plural(activeFilesList.length, "candidate CV", "candidate CVs")}.`);
  };

  const runAgentixScoring = () => {
    handleSubmit();
  };

  // State to simulate adding a new candidate
  const [newCandName, setNewCandName] = useState("");
  const [newCandRole, setNewCandRole] = useState("");
  const [newCandDept, setNewCandDept] = useState("Engineering");
  const [newCandEmail, setNewCandEmail] = useState("");

  // Filter candidates based on search query and status filter
  const filteredCandidates = useMemo(() => {
    return candidates.filter((cand) => {
      const matchesSearch =
        cand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cand.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cand.department.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "All" || cand.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [candidates, searchQuery, statusFilter]);

  // Aggregate Key Statistics
  const stats = useMemo(() => {
    const totalCandidates = candidates.length;
    const activeAIAgents = agents.filter(a => a.isRunning).length;
    const highMatchCandidates = candidates.filter(c => c.matchScore && c.matchScore >= config.highMatchThreshold).length;

    // Real calculation: AI takes ~30s per candidate for full pipeline
    const avgSecondsPerCandidate = 30;
    const totalSeconds = totalCandidates * avgSecondsPerCandidate;
    const hoursSavedThisMonth = Math.round(totalSeconds / 3600);

    // Real avg match from pipeline results
    const pipelineScores = pipelineResults.filter(r => r.screened_score != null).map(r => r.screened_score!);
    const avgPipelineScore = pipelineScores.length ? Math.round(pipelineScores.reduce((a, b) => a + b, 0) / pipelineScores.length) : avgMatch;

    // Total pipeline runs completed
    const completedRuns = pipelineRuns.filter(r => r.status === "completed").length;

    return {
      totalCandidates,
      activeAIAgents,
      highMatchCandidates,
      hoursSavedThisMonth,
      avgPipelineScore,
      completedRuns,
    };
  }, [candidates, agents, config.highMatchThreshold, pipelineResults, pipelineRuns, avgMatch]);

  // Chart data - computed from config + live candidate state
  const chartData = useMemo(() => {
    // Real skill distribution from pipeline results
    const allSkills = pipelineResults
      .filter(r => r.parsed_skills)
      .flatMap(r => r.parsed_skills!.split(",").map(s => s.trim()).filter(s => s.length > 0));
    const skillCounts: Record<string, number> = {};
    allSkills.forEach(s => { skillCounts[s] = (skillCounts[s] || 0) + 1; });
    const sortedSkills = Object.entries(skillCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const skillMatchData = sortedSkills.length > 0
      ? sortedSkills.map(([name, count]) => ({
          name, Count: count,
          color: config.skillMatchData.find(s => s.name.toLowerCase() === name.toLowerCase())?.color || "#6366f1",
        }))
      : [];

    // Pipeline status doughnut: aggregate live candidate counts + apply config colors
    const candidatesByStatus = candidates.reduce((acc, cand) => {
      acc[cand.status] = (acc[cand.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const pipelineStatusData = config.pipelineStatusData.map(stage => {
      let value = 0;
      if (stage.name === "Applied") value = candidatesByStatus["Applied"] || 0;
      else if (stage.name === "Screening") value = candidatesByStatus["Screening"] || 0;
      else if (stage.name === "Interviewing") value = candidatesByStatus["Interviewing"] || 0;
      else if (stage.name === "Offered/Rejected") value = (candidatesByStatus["Offered"] || 0) + (candidatesByStatus["Rejected"] || 0);
      return { name: stage.name, value, color: stage.color };
    });

    return { skillMatchData, pipelineStatusData };
  }, [candidates, config, stats.totalCandidates, pipelineResults]);

  // Dynamically compute leaderboard candidate ranking from the candidates state
  const leaderboardCandidates = useMemo(() => {
    const scored = candidates
      .filter((c) => c.matchScore !== null && c.matchScore !== undefined)
      .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

    // Build a map of candidate_id -> skills from pipeline results (real AI data)
    const pipelineSkillsMap: Record<string, string[]> = {};
    pipelineResults.forEach(r => {
      if (r.parsed_skills) {
        pipelineSkillsMap[r.candidate_id] = r.parsed_skills.split(",").map(s => s.trim()).filter(s => s.length > 0);
      }
    });

    return scored.map((c, index) => {
      const initials = c.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

      // Use real AI-extracted skills from pipeline if available
      const realSkills = pipelineSkillsMap[c.id];
      const skills = realSkills && realSkills.length > 0 ? realSkills : (c.skills ? c.skills.split(",").map(s => s.trim()).filter(s => s.length > 0) : ["Skills pending AI analysis"]);

      const scoreVal = c.matchScore || 0;
      let status: "Invite Sent" | "Pending" | "Rejected" = "Pending";
      if (scoreVal >= 85) {
        status = "Invite Sent";
      } else if (scoreVal < 70) {
        status = "Rejected";
      }

      return {
        rank: index + 1,
        name: c.name,
        avatarInitials: initials,
        email: c.email,
        score: scoreVal,
        skills,
        status,
      };
    });
  }, [candidates, pipelineResults]);

  // Handles AI Resume Screening via real Mistral API
  const triggerAIScreen = async (candidateId: string) => {
    setCandidateStage(candidateId, "Awaiting Ranking");

    showToast("Agentix AI: ScreenerX is parsing resume & analyzing match compatibility...");

    try {
      await screenCandidate(candidateId, jobDescription);
      const updated = candidates.find(c => c.id === candidateId);
      showToast(`Screening complete for ${updated?.name || 'candidate'}. Score: ${updated?.matchScore || 'N/A'}%`);
    } catch (e) {
      showToast(`Screening failed: ${e}`);
    }
  };

  // Handles Adding Candidate
  const handleAddCandidateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCandName || !newCandRole || !newCandEmail) {
      alert("Please fill in all required fields.");
      return;
    }

    addCandidate({
      id: Date.now().toString(),
      name: newCandName,
      role: newCandRole,
      department: newCandDept,
      status: "Applied",
      matchScore: null,
      appliedDate: new Date().toISOString().split('T')[0],
      email: newCandEmail,
      currentStage: "Awaiting Parsing",
    });
    setIsAddCandidateOpen(false);
    
    // Reset fields
    setNewCandName("");
    setNewCandRole("");
    setNewCandEmail("");
    
    showToast(`Successfully added ${newCandName} to recruitment pipeline.`);
  };

  // Handles Agent Configuration edits (persists to backend)
  const handleAgentConfigSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentForConfig) return;
    try {
      await updateAgentConfig(selectedAgentForConfig.id, {
        confidence_threshold: selectedAgentForConfig.config.confidenceThreshold,
        channel: selectedAgentForConfig.config.channel,
        auto_screen: selectedAgentForConfig.config.autoScreen,
      });
      showToast(`Configuration updated for ${selectedAgentForConfig.name}.`);
      setSelectedAgentForConfig(null);
    } catch (e) {
      showToast(`Failed to save config: ${e}`);
    }
  };

  // Run Global System Diagnostics (Real API call)
  const runSystemDiagnostic = async () => {
    setDiagnosticRunning(true);
    try {
      await runDiagnosticsAction();
    } catch (e) {
      console.error(e);
    }
    setDiagnosticRunning(false);
  };

  // Auth helper methods
  const handleSignIn = () => {
    setShowAuth(true);
  };

  const handleSignOut = async () => {
    await signOutAction();
    showToast("Logged out successfully.");
  };

  const handleAuthSuccess = () => {
    const u = useAuthStore.getState().user;
    if (u) showToast(`Welcome, ${u.name}!`);
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 text-slate-900 font-sans antialiased flex flex-col">
      {/* Navbar Integration - always rendered, full width */}
      <Navbar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab}
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onMenuToggle={() => setIsSidebarOpen(true)}
        notifications={notifications}
        onMarkRead={markNotificationRead}
      />

      {/* Landing Page - full width, no sidebar */}
      {currentTab === "landing" ? (
        <LandingPage onLaunchDashboard={() => { if (user) { setCurrentTab("dashboard"); } else { setShowAuth(true); } }} />
      ) : (
        <div className="flex flex-1 overflow-hidden relative">
          {/* Mobile Sidebar Overlay */}
          <AnimatePresence>
            {isSidebarOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsSidebarOpen(false)}
                  className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm md:hidden"
                />
                <motion.aside
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="fixed left-0 top-0 z-50 h-full w-64 bg-white border-r border-slate-200 p-4 shadow-xl md:hidden"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Main Menu</span>
                    <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <SidebarItem
                      tab="dashboard"
                      label="Home / Overview"
                      currentTab={currentTab}
                      onNavigate={(t) => { setCurrentTab(t); setIsSidebarOpen(false); }}
                    />
                    <SidebarItem
                      tab="dashboard"
                      label="Dashboard"
                      badge="1 Draft"
                      badgeClass="bg-amber-50 text-amber-700 border border-amber-200/50"
                      currentTab={currentTab}
                      onNavigate={(t) => { setCurrentTab(t); setIsSidebarOpen(false); }}
                    />
                    <SidebarItem
                      tab="agents"
                      label="AI Agents"
                      badge={plural(agents.filter(a => a.isRunning).length, "Active")}
                      badgeClass="bg-purple-50 text-purple-700 border border-purple-200/50"
                      currentTab={currentTab}
                      onNavigate={(t) => { setCurrentTab(t); setIsSidebarOpen(false); }}
                    />
                    <SidebarItem
                      tab="candidates"
                      label="Candidates"
                      badge={`${candidates.length} New`}
                      badgeClass="bg-blue-50 text-blue-700 border border-blue-200/50"
                      currentTab={currentTab}
                      onNavigate={(t) => { setCurrentTab(t); setIsSidebarOpen(false); }}
                    />
                    <SidebarItem
                      tab="analytics"
                      label="Analytics"
                      badge={avgMatchScoreLabel}
                      badgeClass="bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                      currentTab={currentTab}
                      onNavigate={(t) => { setCurrentTab(t); setIsSidebarOpen(false); }}
                    />
                    <SidebarItem
                      tab="pipeline"
                      label="AI Pipeline"
                      badge={pipelineRuns.length > 0 ? `${pipelineRuns.length} Runs` : undefined}
                      badgeClass="bg-indigo-50 text-indigo-700 border border-indigo-200/50"
                      currentTab={currentTab}
                      onNavigate={(t) => { setCurrentTab(t); setIsSidebarOpen(false); }}
                    />
                  </div>
                </motion.aside>
              </>
            )}
          </AnimatePresence>

          {/* Desktop Sidebar */}
          <aside className="hidden md:flex flex-col w-64 border-r border-slate-200 bg-white shrink-0">
            <div className="p-4 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Main Menu</span>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              <SidebarItem
                tab="dashboard"
                label="Home / Overview"
                currentTab={currentTab}
                onNavigate={setCurrentTab}
              />
              <SidebarItem
                tab="dashboard"
                label="Dashboard"
                badge="1 Draft"
                badgeClass="bg-amber-50 text-amber-700 border border-amber-200/50"
                currentTab={currentTab}
                onNavigate={setCurrentTab}
              />
              <SidebarItem
                tab="agents"
                label="AI Agents"
                badge={plural(agents.filter(a => a.isRunning).length, "Active")}
                badgeClass="bg-purple-50 text-purple-700 border border-purple-200/50"
                currentTab={currentTab}
                onNavigate={setCurrentTab}
              />
              <SidebarItem
                tab="candidates"
                label="Candidates"
                badge={`${candidates.length} New`}
                badgeClass="bg-blue-50 text-blue-700 border border-blue-200/50"
                currentTab={currentTab}
                onNavigate={setCurrentTab}
              />
              <SidebarItem
                tab="analytics"
                label="Analytics"
                badge={avgMatchScoreLabel}
                badgeClass="bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                currentTab={currentTab}
                onNavigate={setCurrentTab}
              />
              <SidebarItem
                tab="pipeline"
                label="AI Pipeline"
                badge={pipelineRuns.length > 0 ? `${pipelineRuns.length} Runs` : undefined}
                badgeClass="bg-indigo-50 text-indigo-700 border border-indigo-200/50"
                currentTab={currentTab}
                onNavigate={setCurrentTab}
              />
            </nav>
          </aside>

          {/* Main Content Area - full width */}
          <main className="flex-1 min-w-0 px-4 py-6 md:px-8 overflow-y-auto">
            <div className="w-full max-w-6xl mx-auto space-y-6 md:space-y-8">
        
        {/* Page Title */}
        <div className="mb-6 md:mb-8">
          {currentTab === "agents" ? (
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Agent Control</span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl mt-1">AI Agents Management</h1>
              <p className="text-xs text-slate-500 mt-1.5">Agent Orchestration &amp; Advanced Analytics</p>
            </div>
          ) : (
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {currentTab === "dashboard" && "Dashboard"}
              {currentTab === "candidates" && "Candidates"}
              {currentTab === "analytics" && "Analytics"}
              {currentTab === "pipeline" && "AI Pipeline"}
            </h1>
          )}
        </div>

        {/* Diagnostic Results Display */}
        {(diagnosticResult?.message) && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-slate-900 text-slate-100 border border-slate-800 font-mono text-xs flex items-start gap-3 shadow-md"
            id="diagnostic-result-panel"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[10px]">DIAGNOSTIC_OK</span>
                <button onClick={() => useAppStore.setState({ diagnosticResult: null })} className="text-slate-500 hover:text-slate-300">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1 leading-relaxed text-slate-300">{diagnosticResult?.message}</p>
            </div>
          </motion.div>
        )}

        {/* Render Tab Views with AnimatePresence */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.18 }}
          >
            
            {/* ----------------- TAB: DASHBOARD ----------------- */}
            {currentTab === "dashboard" && (
              <div className="space-y-6 md:space-y-8" id="dashboard-tab">
                
                {/* Job Description & CV Upload Split Workspace */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="workspace-input-area">
                  
                  {/* Left Column: Job Description */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-950 text-white text-xs font-bold">1</span>
                          Job Description
                        </h3>
                        {isJdSaved ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                            <Check className="h-3.5 w-3.5" />
                            <span>Saved & Vectorized</span>
                          </span>
                        ) : (
                          <span className="text-xs text-amber-500 font-medium bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
                            Unsaved Changes
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mb-4">
                        Paste target requirements, role scope, and key candidate attributes for the AI Screener model to match.
                      </p>
                      
                      <textarea
                        value={jobDescription}
                        onChange={(e) => handleJdChange(e.target.value)}
                        placeholder="Paste Job Description here..."
                        className="w-full text-sm rounded-xl border border-slate-200 p-4 focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition font-sans leading-relaxed text-slate-700 bg-slate-50/50 min-h-[280px] resize-y overflow-y-auto"
                      />
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-mono">
                        {jobDescription.split(/\s+/).filter(Boolean).length} words
                      </span>
                      <button
                        onClick={handleSaveJd}
                        className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                          isJdSaved 
                            ? "bg-slate-100 text-slate-500 hover:bg-slate-200" 
                            : "bg-slate-900 text-white hover:bg-slate-800"
                        }`}
                      >
                        {isJdSaved ? "JD Saved" : "Save Job Description"}
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Advanced Bulk Upload Ingestion & Control Hub */}
                  <div className="space-y-6">
                      <BulkUploadZone 
                        onFilesProcessed={() => {}}
                        onFilesSelected={(fileEntries) => {
                          const newStaged = fileEntries.map((f) => ({
                            id: f.id,
                            name: f.name,
                            size: f.size,
                            status: "staged" as const
                          }));
                          setStagedCvs(prev => [...prev, ...newStaged]);
                          setFiles(prev => [...prev, ...newStaged]);
                          setActualFiles(prev => {
                            const next = new Map(prev);
                            fileEntries.forEach(f => next.set(f.id, f.file));
                            return next;
                          });
                        }}
                        showToast={showToast}
                      />

                    {/* Fetch from Job Boards */}
                    <FetchFilters
                      filters={boardFilters}
                      onChange={setBoardFilters}
                      onFetch={handleFetchFromBoards}
                      isFetching={isFetchingFromBoards}
                      platformBreakdown={fetchPlatformBreakdown}
                      fetchMessage={fetchMessage}
                    />

                    {/* Staged Resumes Interactive Panel */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center h-5.5 w-5.5 rounded-full bg-slate-900 text-white text-[10px] font-bold">2</span>
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Candidate Staging Buffer</h4>
                        </div>
                        <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                          {plural(stagedCvs.length, "CV")} Active
                        </span>
                      </div>

                      {stagedCvs.length > 0 ? (
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {stagedCvs.map((cv) => (
                            <div key={cv.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 text-xs hover:bg-slate-50 hover:border-slate-200 transition">
                              <div className="flex items-center gap-2.5 truncate max-w-[70%]">
                                <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                                <span className="font-bold text-slate-700 truncate">{cv.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono shrink-0">({cv.size})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {cv.status === "parsing" ? (
                                  <span className="flex items-center gap-1 text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded animate-pulse">
                                    <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                                    <span>Parsing...</span>
                                  </span>
                                ) : cv.status === "completed" ? (
                                  <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                                    <Check className="h-2.5 w-2.5" />
                                    <span>Scored</span>
                                  </span>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveStagedCv(cv.id);
                                    }}
                                    className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                                    title="Remove from staging"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        ) : (
                        <div className="p-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center text-center">
                          <p className="text-xs text-slate-400 font-medium">Staging buffer is empty</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 max-w-xs">Upload resume files above or fetch candidates from job boards to load into assessment batch.</p>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* Fetched Candidates Results */}
                {fetchedCandidates.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Real Candidates from Job Boards
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                          {fetchedCandidates.length} found
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">({fetchTimeMs}ms)</span>
                      </h3>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500">
                        {Object.entries(fetchPlatformBreakdown).filter(([_, count]) => count > 0).map(([platform, count]) => {
                          const color = platform.includes("Rozee") ? "bg-emerald-500" : platform.includes("LinkedIn") ? "bg-blue-500" : "bg-purple-500"
                          return (
                            <span key={platform} className="flex items-center gap-1">
                              <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
                              {platform}: {count}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/30">
                            <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Name / Role</th>
                            <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Skills</th>
                            <th className="text-center px-4 py-2.5 font-semibold text-slate-500">Score</th>
                              <th className="text-center px-4 py-2.5 font-semibold text-slate-500">Source</th>
                            <th className="text-center px-4 py-2.5 font-semibold text-slate-500">Gender</th>
                            <th className="text-center px-4 py-2.5 font-semibold text-slate-500">Shift</th>
                            <th className="text-center px-4 py-2.5 font-semibold text-slate-500">Remote</th>
                            <th className="text-center px-4 py-2.5 font-semibold text-slate-500">Age</th>
                            <th className="text-center px-4 py-2.5 font-semibold text-slate-500">Exp</th>
                            <th className="text-center px-4 py-2.5 font-semibold text-slate-500">Location</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fetchedCandidates.map((c, i) => (
                            <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                              <td className="px-4 py-2.5">
                                <div className="font-semibold text-slate-800">{c.name}</div>
                                <div className="text-[10px] text-slate-400">{c.role}</div>
                              </td>
                              <td className="px-4 py-2.5 max-w-[200px]">
                                <div className="text-slate-600 truncate" title={c.skills || ""}>{c.skills || "-"}</div>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {c.match_score ? (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    c.match_score >= 80 ? "bg-emerald-50 text-emerald-700" :
                                    c.match_score >= 60 ? "bg-amber-50 text-amber-700" :
                                    "bg-rose-50 text-rose-700"
                                  }`}>
                                    {c.match_score}%
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                                  {c.source_platform || "Rozee.pk"}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-center text-slate-600">{c.gender || "-"}</td>
                              <td className="px-4 py-2.5 text-center text-slate-600">{c.shift_preference || "-"}</td>
                              <td className="px-4 py-2.5 text-center">
                                {c.is_remote === true ? <span className="text-emerald-600 font-bold">Yes</span> :
                                 c.is_remote === false ? <span className="text-slate-400">No</span> : "-"}
                              </td>
                              <td className="px-4 py-2.5 text-center text-slate-600">{c.age || "-"}</td>
                              <td className="px-4 py-2.5 text-center text-slate-600">{c.experience_years != null ? `${c.experience_years}y` : "-"}</td>
                              <td className="px-4 py-2.5 text-center text-slate-600">{c.location || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Full-Width Scoring Run Button or Progress Bar */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  {isProcessing ? (
                    <div className="space-y-4 animate-fadeIn">
                      {/* Progress bar */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 text-indigo-600 font-semibold animate-pulse">
                            <Bot className="h-4 w-4" />
                            <span>Agentix Engine Active: Scoring candidate suitability indexes...</span>
                          </div>
                          <span className="font-mono font-bold text-slate-700">{scoringProgress}%</span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-150 rounded-full" 
                            style={{ width: `${scoringProgress}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
                          <span>[STAGE] Parsing resumes into structured AST formats</span>
                          <span>ScreenerX v2.4 (Active)</span>
                        </div>
                      </div>

                      {/* Loading Button with Spinner */}
                      <div className="flex justify-center">
                        <button
                          disabled
                          className="w-full py-3.5 px-6 rounded-xl font-bold text-sm tracking-wide bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center gap-2 cursor-not-allowed"
                        >
                          <RefreshCw className="h-4.5 w-4.5 animate-spin text-indigo-600" />
                          <span>Analyzing CVs...</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <button
                          onClick={() => handleSubmit()}
                          disabled={!isJdSaved || (stagedCvs.length === 0 && files.length === 0)}
                          className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm tracking-wide transition-all shadow flex items-center justify-center gap-2 cursor-pointer ${
                            isJdSaved && (stagedCvs.length > 0 || files.length > 0)
                              ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-500 hover:to-blue-500 hover:shadow-lg active:scale-[0.99] hover:shadow-indigo-100"
                              : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                          }`}
                        >
                          <Sparkles className={`h-4.5 w-4.5 ${isJdSaved && (stagedCvs.length > 0 || files.length > 0) ? "text-amber-200 animate-pulse" : "text-slate-400"}`} />
                          <span>Run Agentix AI Scoring</span>
                        </button>
                      </div>

                      {(!isJdSaved || (stagedCvs.length === 0 && files.length === 0)) && (
                        <div className="flex items-start gap-2 bg-slate-50 border border-slate-100 p-2.5 rounded-xl sm:max-w-xs shrink-0">
                          <AlertCircle className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                          <p className="text-[10px] text-slate-500 leading-normal font-medium">
                            {!isJdSaved && (stagedCvs.length === 0 && files.length === 0) 
                              ? "Save the Job Description on the left and stage CVs on the right to start scoring." 
                              : !isJdSaved 
                              ? "Click 'Save Job Description' first to initialize suitability evaluation weights." 
                              : "Stage at least 1 candidate resume PDF to trigger the ScreenerX model."}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Asynchronous Processing Queue */}
                <div className="my-2">
                  <AgentQueue
                    items={queueItems}
                    onTriggerToast={showToast}
                    onAdvanceStage={(name) => {
                      const match = candidates.find(c => c.name === name);
                      if (match) advanceCandidateStage(match.id);
                    }}
                    onPushToPipeline={async (ids) => {
                      try {
                        const desc = jobDescription.trim() || "Software Engineer - generic job posting requiring strong technical skills and team collaboration";
                        await runPipelineAction({
                          job_title: desc.split("\n")[0].slice(0, 60),
                          job_description: desc,
                          candidate_ids: ids,
                        });
                        showToast(`Pipeline triggered for ${ids.length} candidate(s)`);
                        await useAppStore.getState().fetchQueue();
                      } catch (e: any) {
                        showToast(`Pipeline error: ${e.message || e}`);
                      }
                    }}
                    onDeleteItem={async (id) => {
                      try {
                        await api.candidates.deleteSelected([id]);
                        await useAppStore.getState().fetchCandidates();
                        fetchQueue();
                      } catch (e: any) {
                        showToast(`Delete failed: ${e.message || e}`);
                      }
                    }}
                    refreshQueue={fetchQueue}
                  />
                </div>

              </div>
            )}

            {/* ----------------- TAB: AI AGENTS ----------------- */}
            {currentTab === "agents" && (
              <div id="agents-tab" className="space-y-6">
                <AgentAnalytics mode="agents" bots={agents} onToggleBot={toggleAgent} onRunBot={async (id) => { try { const urls: Record<string, string> = { fetcher: "/api/agents/fetcher/run-now", parser: "/api/agents/parser/run-now", ranker: "/api/agents/ranker/run-now", scheduler: "/api/agents/scheduler/send-interviews" }; if (urls[id]) { await api.post(urls[id]); showToast(`${id.charAt(0).toUpperCase() + id.slice(1)} bot started`); } } catch (e: any) { showToast(`Bot error: ${e.message}`); } }} candidates={candidates} processingTimeMs={config.processingTimeMs} cvProcessedTrend={config.cvProcessedTrend} chartData={chartData} />

                {/* CV Analysis Studio */}
                <CVAnalyzer
                  onPipelineRun={async (ids) => {
                    try {
                      const desc = jobDescription.trim() || "Software Engineer - generic job posting requiring strong technical skills and team collaboration";
                      await runPipelineAction({
                        job_title: desc.split("\n")[0].slice(0, 60),
                        job_description: desc,
                        candidate_ids: ids,
                      });
                      showToast("CV analysis candidates sent to 4-agent pipeline");
                    } catch (e: any) {
                      showToast(`Pipeline error: ${e.message || e}`);
                    }
                  }}
                  showToast={showToast}
                  jobDescription={jobDescription}
                />

                {/* System Diagnostics */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">System Diagnostics</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Run a health check on all agents and backend services.</p>
                    </div>
                    <button
                      onClick={runSystemDiagnostic}
                      disabled={diagnosticRunning}
                      className={`px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-2 cursor-pointer ${
                        diagnosticRunning
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "bg-slate-900 text-white hover:bg-slate-800"
                      }`}
                    >
                      {diagnosticRunning ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Activity className="h-3.5 w-3.5" />
                          Run Diagnostics
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ----------------- TAB: CANDIDATES ----------------- */}
            {currentTab === "candidates" && (
              <div className="space-y-6" id="candidates-tab">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-900">Candidate Pipeline Hub</h2>
                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200/50 px-2.5 py-0.5 rounded-full">
                      {candidates.length} {candidates.length === 1 ? "Candidate" : "Candidates"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setIsAddCandidateOpen(true)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition focus:outline-none"
                      id="add-candidate-trigger-btn"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Candidate</span>
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const result = await api.candidates.enrichAll();
                          showToast(`Enriched ${result.enriched} candidates (scanned ${result.scanned})`);
                          await useAppStore.getState().fetchCandidates();
                        } catch (e: any) {
                          showToast(`Enrich failed: ${e.message || e}`);
                        }
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition focus:outline-none"
                      id="enrich-candidates-btn"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>Enrich All</span>
                    </button>
                    {selectedIds.size > 0 && (
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete ${selectedIds.size} selected candidates?`)) return;
                          try {
                            await api.candidates.deleteSelected(Array.from(selectedIds));
                            showToast(`Deleted ${selectedIds.size} candidates`);
                            setSelectedIds(new Set());
                            await useAppStore.getState().fetchCandidates();
                          } catch (e: any) {
                            showToast(`Delete failed: ${e.message || e}`);
                          }
                        }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition focus:outline-none"
                        id="delete-selected-btn"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete Selected ({selectedIds.size})</span>
                      </button>
                    )}
                    {candidates.length > 0 && (
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete all ${candidates.length} candidates and results? This cannot be undone.`)) return;
                          try {
                            await api.candidates.deleteAll();
                            setSelectedIds(new Set());
                            showToast(`Deleted all ${candidates.length} candidates`);
                            await useAppStore.getState().fetchCandidates();
                          } catch (e: any) {
                            showToast(`Delete failed: ${e.message || e}`);
                          }
                        }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition focus:outline-none"
                        id="delete-all-candidates-btn"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete All</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Search & Filter Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search candidate by name, role, or department..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 pl-9 pr-4 py-2 text-xs focus:border-slate-400 focus:outline-none transition bg-slate-50/50"
                      id="candidate-search-input"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-400" />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-slate-400 focus:outline-none bg-slate-50/50 text-slate-600 font-medium"
                      id="candidate-status-filter"
                    >
                      <option value="All">All Stages</option>
                      <option value="Applied">Applied</option>
                      <option value="Screening">Screening</option>
                      <option value="Interviewing">Interviewing</option>
                      <option value="Offered">Offered</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                {/* Candidate Table Layout */}
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-slate-100 text-left">
                      <thead className="bg-slate-50/70 font-sans text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-3 py-3.5 w-8">
                            <input
                              type="checkbox"
                              checked={filteredCandidates.length > 0 && selectedIds.size === filteredCandidates.length}
                              onChange={() => {
                                if (selectedIds.size === filteredCandidates.length) {
                                  setSelectedIds(new Set());
                                } else {
                                  setSelectedIds(new Set(filteredCandidates.map(c => c.id)));
                                }
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </th>
                          <th className="px-6 py-3.5">Candidate Details</th>
                          <th className="px-6 py-3.5">Role / Dept</th>
                          <th className="px-4 py-3.5 text-center">AI Score</th>
                          <th className="px-4 py-3.5 text-center">Gender</th>
                          <th className="px-4 py-3.5 text-center">Shift</th>
                          <th className="px-4 py-3.5 text-center">Remote</th>
                          <th className="px-4 py-3.5 text-center">Age</th>
                          <th className="px-4 py-3.5 text-center">Exp</th>
                          <th className="px-4 py-3.5 text-center">Skills</th>
                          <th className="px-6 py-3.5">Status</th>
                          <th className="relative px-6 py-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white text-xs">
                        {filteredCandidates.length > 0 ? (
                          filteredCandidates.map((cand) => (
                            <tr key={cand.id} className="hover:bg-slate-50/50 transition">
                              <td className="whitespace-nowrap px-3 py-4.5">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(cand.id)}
                                  onChange={() => {
                                    const next = new Set(selectedIds);
                                    if (next.has(cand.id)) next.delete(cand.id);
                                    else next.add(cand.id);
                                    setSelectedIds(next);
                                  }}
                                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                              </td>
                              <td className="whitespace-nowrap px-6 py-4.5">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 border border-slate-200 font-bold text-slate-800">
                                    {cand.name.split(" ").map(n => n[0]).join("")}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-slate-900">{cand.name}</div>
                                    <div className="text-slate-400 mt-0.5">{cand.email}</div>
                                  </div>
                                </div>
                              </td>

                              <td className="whitespace-nowrap px-6 py-4.5">
                                <div className="font-medium text-slate-800">{cand.role}</div>
                                <div className="text-slate-500 mt-0.5">{cand.department}</div>
                              </td>

                              <td className="whitespace-nowrap px-4 py-4.5 text-center">
                                {cand.matchScore ? (
                                  <div className="inline-flex items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100 px-2.5 py-1 text-indigo-700 font-mono font-bold">
                                    {cand.matchScore}%
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-medium">-</span>
                                )}
                              </td>

                              <td className="whitespace-nowrap px-4 py-4.5 text-center text-slate-600 text-xs">
                                {cand.gender || "-"}
                              </td>

                              <td className="whitespace-nowrap px-4 py-4.5 text-center text-slate-600 text-xs">
                                {cand.shiftPreference || "-"}
                              </td>

                              <td className="whitespace-nowrap px-4 py-4.5 text-center text-xs">
                                {cand.isRemote === true ? <span className="text-emerald-600 font-bold">Yes</span> :
                                 cand.isRemote === false ? <span className="text-slate-400">No</span> : "-"}
                              </td>

                              <td className="whitespace-nowrap px-4 py-4.5 text-center text-slate-600 text-xs">
                                {cand.age ?? "-"}
                              </td>

                              <td className="whitespace-nowrap px-4 py-4.5 text-center text-slate-600 text-xs">
                                {cand.experienceYears != null ? `${cand.experienceYears}y` : "-"}
                              </td>

                              <td className="whitespace-nowrap px-4 py-4.5 text-slate-600 text-xs max-w-[140px] truncate" title={cand.skills || ""}>
                                {cand.skills || "-"}
                              </td>

                              <td className="whitespace-nowrap px-6 py-4.5">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  cand.status === "Applied" 
                                    ? "bg-slate-100 text-slate-800" 
                                    : cand.status === "Screening"
                                    ? "bg-sky-50 text-sky-700 border-sky-100"
                                    : cand.status === "Interviewing"
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                                    : cand.status === "Offered"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                    : "bg-rose-50 text-rose-700 border-rose-100"
                                }`}>
                                  {cand.status}
                                </span>
                              </td>

                              <td className="whitespace-nowrap px-6 py-4.5 text-right font-medium">
                                <div className="flex items-center justify-end gap-2">
                                  {cand.matchScore === null && (
                                    <>
                                      {cand.currentStage === "Awaiting Ranking" ? (
                                        <div className="inline-flex items-center gap-1.5 text-indigo-600 font-semibold px-3 py-1.5 bg-indigo-50/50 rounded-lg border border-indigo-100">
                                          <RefreshCw className="h-3 w-3 animate-spin" />
                                          <span>Scanning...</span>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => triggerAIScreen(cand.id)}
                                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 font-semibold text-indigo-700 hover:bg-indigo-100/60 transition focus:outline-none"
                                        >
                                          <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                                          <span>AI Screen</span>
                                        </button>
                                      )}
                                    </>
                                  )}

                                  {cand.matchScore !== null && (
                                    <button
                                      onClick={() => alert(`ScreenerX Scorecard Analysis:\nCandidate: ${cand.name}\n\nMatching Score: ${cand.matchScore}%\n\nResume Summary: ${cand.summary || 'Matches ideal workforce parameters.'}`)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 transition focus:outline-none"
                                    >
                                      <Eye className="h-3.5 w-3.5 text-slate-500" />
                                      <span>View Scorecard</span>
                                    </button>
                                  )}

                                  <button
                                    onClick={() => {
                                      if (confirm(`Remove ${cand.name} from pipeline?`)) {
                                        removeCandidate(cand.id);
                                        showToast(`Removed candidate ${cand.name}.`);
                                      }
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition focus:outline-none"
                                    title="Delete candidate"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={12} className="px-6 py-8 md:py-12 text-center text-slate-500">
                              <div className="flex flex-col items-center justify-center">
                                <Search className="h-8 w-8 text-slate-300 mb-2" />
                                <p className="text-sm font-semibold text-slate-700">No candidates found</p>
                                <p className="text-xs text-slate-400 mt-1">Try adjusting your search queries or filter categories.</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                </div>
              </div>
            )}

            {/* ----------------- TAB: ANALYTICS ----------------- */}
            {currentTab === "analytics" && (
              <div className="space-y-6" id="analytics-tab">
                <div className="border-b border-slate-200 pb-5">
                  <h2 className="text-xl font-bold text-slate-900">Analytics & Insights</h2>
                </div>
                <AgentAnalytics mode="analytics" bots={agents} onToggleBot={toggleAgent} onRunBot={async (id) => { try { const urls: Record<string, string> = { fetcher: "/api/agents/fetcher/run-now", parser: "/api/agents/parser/run-now", ranker: "/api/agents/ranker/run-now", scheduler: "/api/agents/scheduler/send-interviews" }; if (urls[id]) { await api.post(urls[id]); showToast(`${id.charAt(0).toUpperCase() + id.slice(1)} bot started`); } } catch (e: any) { showToast(`Bot error: ${e.message}`); } }} candidates={candidates} processingTimeMs={config.processingTimeMs} cvProcessedTrend={config.cvProcessedTrend} chartData={chartData} />
              </div>
            )}

            {/* ----------------- TAB: PIPELINE ----------------- */}
            {currentTab === "pipeline" && (
              <div className="space-y-6" id="pipeline-tab">
                <div className="border-b border-slate-200 pb-5">
                  <h2 className="text-xl font-bold text-slate-900">4-Agent AI Pipeline</h2>
                  <p className="text-xs text-slate-500 mt-1">Run the full candidate processing pipeline: Parse → Screen → Deep Rank → Finalize</p>
                </div>
                {selectedPipelineRunId && pipelineResults.length > 0 ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => { setSelectedPipelineRunId(null); }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        ← Back to Pipeline Runner
                      </button>
                    </div>
                    <ResultsDashboard
                      run={pipelineRuns.find(r => r.id === selectedPipelineRunId) || null}
                      results={pipelineResults}
                      showToast={showToast}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <PipelineRunner
                      jobDescription={jobDescription}
                      candidateIds={candidates.map(c => c.id)}
                      pastRuns={pipelineRuns}
                      onRunPipeline={runPipelineAction}
                      onSelectRun={async (runId) => {
                        await getPipelineRun(runId);
                        setSelectedPipelineRunId(runId);
                      }}
                      showToast={showToast}
                    />
                    <div>
                      {pipelineRuns.length > 0 && !selectedPipelineRunId && (
                        <ResultsDashboard
                          run={pipelineRuns[0]}
                          results={pipelineResults}
                          showToast={showToast}
                        />
                      )}
                      {pipelineRuns.length === 0 && (
                        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col items-center justify-center text-center h-full">
                          <div className="text-4xl mb-3">AI</div>
                          <h3 className="text-sm font-bold text-slate-700">Run the Pipeline</h3>
                          <p className="text-xs text-slate-400 mt-1 max-w-xs">
                            Select candidates and a job description on the Dashboard tab, then run the 4-agent pipeline here.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
          </div>
        </main>
      </div>
      )}

      {/* ----------------- MODAL: ADD CANDIDATE ----------------- */}
      <AnimatePresence>
        {isAddCandidateOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAddCandidateOpen(false)}
                className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity"
              />

              {/* Modal Container */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.2 }}
                className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all w-full max-w-lg p-6 border border-slate-200"
                id="add-candidate-modal"
              >
                <div className="absolute right-4 top-4">
                  <button
                    onClick={() => setIsAddCandidateOpen(false)}
                    className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex items-center gap-2.5 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
                    <UserCheck className="h-5 w-5 text-slate-100" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Add New Candidate</h3>
                    <p className="text-xs text-slate-400">Initialize a custom candidate card into your ATS qualification tracker.</p>
                  </div>
                </div>

                <form onSubmit={handleAddCandidateSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="cand-name" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      id="cand-name"
                      required
                      value={newCandName}
                      onChange={(e) => setNewCandName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs focus:border-slate-400 focus:outline-none transition"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="cand-role" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        Applied Role *
                      </label>
                      <input
                        type="text"
                        id="cand-role"
                        required
                        value={newCandRole}
                        onChange={(e) => setNewCandRole(e.target.value)}
                        placeholder="Sr. Product Designer"
                        className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs focus:border-slate-400 focus:outline-none transition"
                      />
                    </div>

                    <div>
                      <label htmlFor="cand-dept" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        Department
                      </label>
                      <select
                        id="cand-dept"
                        value={newCandDept}
                        onChange={(e) => setNewCandDept(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs focus:border-slate-400 focus:outline-none transition bg-white"
                      >
                        <option value="Engineering">Engineering</option>
                        <option value="Design">Design</option>
                        <option value="Product">Product</option>
                        <option value="Marketing">Marketing</option>
                        <option value="Human Resources">Human Resources</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="cand-email" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="cand-email"
                      required
                      value={newCandEmail}
                      onChange={(e) => setNewCandEmail(e.target.value)}
                      placeholder="jane.doe@example.com"
                      className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs focus:border-slate-400 focus:outline-none transition"
                    />
                  </div>

                  <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsAddCandidateOpen(false)}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition focus:outline-none"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition focus:outline-none"
                    >
                      Add Candidate
                    </button>
                  </div>
                </form>
              </motion.div>

            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------- DRAWER / MODAL: AGENT CONFIGURATION ----------------- */}
      <AnimatePresence>
        {selectedAgentForConfig && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedAgentForConfig(null)}
                className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity"
              />

              {/* Modal Container */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.2 }}
                className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all w-full max-w-lg p-6 border border-slate-200"
                id="agent-config-modal"
              >
                <div className="absolute right-4 top-4">
                  <button
                    onClick={() => setSelectedAgentForConfig(null)}
                    className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex items-center gap-2.5 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
                    <Sliders className="h-5 w-5 text-slate-100" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Configure {selectedAgentForConfig.name}</h3>
                    <p className="text-xs text-slate-400">Tweak core parameters, confidence boundaries, and intake vectors.</p>
                  </div>
                </div>

                <form onSubmit={handleAgentConfigSave} className="space-y-4">
                  <div>
                    <label htmlFor="agent-channel" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Integration Intake Channel
                    </label>
                    <input
                      type="text"
                      id="agent-channel"
                      value={selectedAgentForConfig.config.channel}
                      onChange={(e) => setSelectedAgentForConfig({
                        ...selectedAgentForConfig,
                        config: { ...selectedAgentForConfig.config, channel: e.target.value }
                      })}
                      className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs focus:border-slate-400 focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="confidence-slider" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Confidence Score Threshold
                      </label>
                      <span className="font-mono text-xs font-bold text-indigo-600">
                        {selectedAgentForConfig.config.confidenceThreshold}%
                      </span>
                    </div>
                    <input
                      type="range"
                      id="confidence-slider"
                      min="50"
                      max="95"
                      step="5"
                      value={selectedAgentForConfig.config.confidenceThreshold}
                      onChange={(e) => setSelectedAgentForConfig({
                        ...selectedAgentForConfig,
                        config: { ...selectedAgentForConfig.config, confidenceThreshold: parseInt(e.target.value) }
                      })}
                      className="w-full accent-indigo-600 h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Triggers warning escalation loops for scores registered beneath this standard.
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 mt-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">Autonomous Instant Screening</span>
                      <span className="text-[10px] text-slate-400">Trigger qualification analysis immediately upon inbound upload.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedAgentForConfig({
                        ...selectedAgentForConfig,
                        config: { ...selectedAgentForConfig.config, autoScreen: !selectedAgentForConfig.config.autoScreen }
                      })}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        selectedAgentForConfig.config.autoScreen ? "bg-slate-900" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          selectedAgentForConfig.config.autoScreen ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setSelectedAgentForConfig(null)}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition focus:outline-none"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition focus:outline-none"
                    >
                      Save Configuration
                    </button>
                  </div>
                </form>
              </motion.div>

            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      {showAuth && (
        <AuthModal onClose={() => { setShowAuth(false); handleAuthSuccess(); }} />
      )}

      {/* Floating Global Micro Notification System */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl ring-1 ring-black/5 flex items-start gap-3.5"
            id="toast-notification"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Bot className="h-4.5 w-4.5" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-900">System Notification</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-normal">{toastMessage}</p>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-slate-600 transition">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
