import React, { useState } from "react";
import { 
  DownloadCloud, 
  FileJson, 
  Cpu, 
  Send, 
  Activity, 
  TrendingUp, 
  Clock, 
  Bot, 
  HelpCircle,
  Sparkles,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface BotState {
  id: string;
  name: string;
  role: string;
  description: string;
  isRunning: boolean;
}

interface CandidateData {
  id: string;
  name: string;
  status: string;
  matchScore: number | null;
}

interface ChartData {
  skillMatchData: { name: string; Count: number; color: string }[];
  pipelineStatusData: { name: string; value: number; color: string }[];
}

interface AgentAnalyticsProps {
  mode?: "agents" | "analytics";
  bots: BotState[];
  onToggleBot: (id: string) => void;
  onRunBot?: (id: string) => void;
  candidates?: CandidateData[];
  /** Overrides the hardcoded processing time ms value — sourced from dashboardConfig */
  processingTimeMs?: number;
  /** Overrides the hardcoded trend badge on the Total CVs KPI — sourced from dashboardConfig */
  cvProcessedTrend?: string;
  /** Chart data sourced from dashboardConfig + live candidate state */
  chartData?: ChartData;
}

export default function AgentAnalytics({ mode = "agents", bots, onToggleBot, onRunBot, candidates = [], processingTimeMs, cvProcessedTrend, chartData }: AgentAnalyticsProps) {
  // Calculate dynamic analytics from actual candidate data
  const totalCvs = candidates.length;
  const avgMatchScore = candidates.length > 0 
    ? Math.round((candidates.reduce((sum, c) => sum + (c.matchScore || 0), 0) / candidates.length) * 10) / 10
    : 0;
  // Use prop value if provided, otherwise fall back to default
  const processingTime = processingTimeMs ?? (candidates.length > 0 ? 380 : 0);
  const trendBadge = cvProcessedTrend ?? "+12.4%";

  const getBotIcon = (id: string, isRunning: boolean) => {
    const color = isRunning ? "text-indigo-600" : "text-slate-400";
    if (id === "fetcher") return <Bot className={`h-5 w-5 ${color}`} />;
    if (id === "parser") return <Bot className={`h-5 w-5 text-blue-600`} />;
    if (id === "ranker") return <Bot className={`h-5 w-5 text-amber-600`} />;
    return <Bot className={`h-5 w-5 text-emerald-600`} />;
  };

  // Use chartData from props if provided, otherwise compute locally as fallback
  const skillMatchData = chartData?.skillMatchData ?? [
    { name: "React 19", Count: 1, color: "#4f46e5" },
  ];
  const pipelineStatusData = chartData?.pipelineStatusData ?? [
    { name: "Applied", value: 0, color: "#6366f1" },
  ];

  return (
    <div className="space-y-8" id="agent-orchestration-workspace">
      {/* Introduction Header - Only show in agents mode */}
      {mode === "agents" && (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500 flex items-center gap-2">
                <Bot className="h-4 w-4 text-indigo-400" />
                Agent Orchestration &amp; Advanced Analytics
              </p>
            </div>

            <div className="flex items-center gap-2 self-start md:self-center">
              {bots.some((b) => b.isRunning) ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  <Zap className="h-3.5 w-3.5 text-indigo-500 fill-indigo-100" />
                  <span>{bots.filter((b) => b.isRunning).length} Agent(s) Active</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                  <span>All Agents Paused</span>
                </span>
              )}
            </div>
          </div>

          {/* Grid: Toggles and Analytics KPI Panel - Only show in agents mode */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Multi-Agent Control Panel (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between" id="agent-control-panel-card">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Activity className="h-4.5 w-4.5 text-indigo-600" />
                Autonomous Agent Control Panel
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">Agentix Core</span>
            </div>


            <div className="space-y-4">
              {bots.map((bot) => (
                <div 
                  key={bot.id} 
                  className={`flex items-start justify-between p-4 rounded-xl border transition-all duration-200 ${
                    bot.isRunning 
                      ? "border-slate-200 bg-white shadow-sm" 
                      : "border-slate-100 bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-start gap-3.5 max-w-[75%]">
                    <div className={`p-2 rounded-lg border shrink-0 ${
                      bot.isRunning 
                        ? "bg-slate-50 border-slate-200" 
                        : "bg-slate-100/50 border-slate-100 text-slate-400"
                    }`}>
                      {getBotIcon(bot.id, bot.isRunning)}
                    </div>
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                        <span className="font-bold text-sm text-slate-900">{bot.name}</span>
                        <span className="text-[10px] font-medium text-slate-400 font-mono">({bot.role})</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{bot.description}</p>
                    </div>
                  </div>

                  {/* Custom Toggle Switch */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button
                      onClick={() => onToggleBot(bot.id)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        bot.isRunning ? "bg-indigo-600" : "bg-slate-200"
                      }`}
                      aria-label={`Toggle ${bot.name}`}
                    >
                      <motion.span
                        layout
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          bot.isRunning ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                    
                    {/* Running / Paused Indicator */}
                    <div className="flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${bot.isRunning ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${bot.isRunning ? "text-emerald-600" : "text-slate-400"}`}>
                        {bot.isRunning ? "Running" : "Paused"}
                      </span>
                    </div>

                    {/* Run Now button for all bots */}
                    {onRunBot && (
                      <button
                        onClick={() => onRunBot(bot.id)}
                        className="mt-1 inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition"
                      >
                        <Zap className="h-3 w-3" />
                        Run Now
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Enterprise Metrics KPI Cards (5 cols) */}
        <div className="lg:col-span-5 space-y-5 flex flex-col justify-between">
          
          {/* KPI 1: Total CVs Processed */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total {totalCvs === 1 ? "CV" : "CVs"} Processed</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{totalCvs.toLocaleString()}</span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <TrendingUp className="h-2.5 w-2.5" />
                  {trendBadge}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Autonomous processing volume since indexing launch.</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Bot className="h-5.5 w-5.5 animate-pulse" />
            </div>
          </div>

          {/* KPI 2: Average Match Score */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Average Match Score</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{totalCvs > 0 ? `${avgMatchScore}%` : '-'}</span>
                {totalCvs > 0 && (
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                  Active
                </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">Benchmark score computed against matching criteria.</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Sparkles className="h-5.5 w-5.5 text-blue-500" />
            </div>
          </div>

          {/* KPI 3: Processing Time per CV */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Processing Time / CV</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{totalCvs > 0 ? `${processingTime} ms` : '-'}</span>
                {totalCvs > 0 && (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  Active
                </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">Average Mistral AI scoring latency per candidate.</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Clock className="h-5.5 w-5.5 text-emerald-500" />
            </div>
          </div>

        </div>
      </div>
        </>
      )}

      {/* Grid: Charts Section - Only show in analytics mode */}
      {mode === "analytics" && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="dashboard-advanced-visualizers">
        
        {/* Visualizer 1: Skill Match Distribution (Bar Chart) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-900">Skill Match Distribution</h3>
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Current Batch</span>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              Percentage frequency of major tech-stacks matched within incoming candidate pools.
            </p>
          </div>

          <div className="h-72 w-full flex items-center justify-center">
            {skillMatchData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={skillMatchData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      borderRadius: '8px', 
                      border: 'none',
                      color: '#fff',
                      fontSize: '11px',
                      fontFamily: 'sans-serif'
                    }}
                    itemStyle={{ color: '#fff' }}
                    labelStyle={{ fontWeight: 'bold', color: '#94a3b8' }}
                  />
                  <Bar dataKey="Count" fill="#4f46e5" radius={[4, 4, 0, 0]}>
                    {skillMatchData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400">
                <Activity className="h-8 w-8 mb-2 text-slate-300" />
                <p className="text-xs font-semibold">No Data Yet</p>
                <p className="text-[10px] mt-0.5">Run the AI pipeline to see skill distribution</p>
              </div>
            )}
          </div>
        </div>

        {/* Visualizer 2: Candidate Pipeline Status (Doughnut Chart) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-900">Candidate Pipeline Status</h3>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Live Status</span>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              Real-time progression of candidate resume documents moving through the agent nodes.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            {/* Chart Area */}
            <div className="sm:col-span-7 h-60 w-full flex items-center justify-center">
              {pipelineStatusData.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pipelineStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pipelineStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        borderRadius: '8px', 
                        border: 'none',
                        color: '#fff',
                        fontSize: '11px',
                        fontFamily: 'sans-serif'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <Activity className="h-8 w-8 mb-2 text-slate-300" />
                  <p className="text-xs font-semibold">No Candidates Yet</p>
                  <p className="text-[10px] mt-0.5">Upload or fetch candidates to see pipeline status</p>
                </div>
              )}
            </div>

            {/* Legend / Metrics Area */}
            <div className="sm:col-span-5 space-y-3 font-sans">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">State Breakdown</div>
              {pipelineStatusData.map((entry, idx) => (
                <div key={entry.name} className="flex items-center justify-between p-1.5 rounded-lg border border-slate-50 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs font-medium text-slate-700">{entry.name}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-900">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
      )}

    </div>
  );
}
