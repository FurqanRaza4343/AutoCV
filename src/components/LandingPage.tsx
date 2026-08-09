import React from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Cpu,
  CheckCircle2,
  Zap,
  Terminal,
  Layers,
  DownloadCloud,
  FileText,
  Sparkles,
  ArrowUpRight,
  BarChart3,
  Mail,
  ShieldCheck,
  ListChecks,
} from "lucide-react";
import VideoHero from "./VideoHero";
import { BackgroundPathsWrapper } from "./BackgroundPaths";
import { InfiniteGridWrapper } from "./InfiniteGridBackground";

interface LandingPageProps {
  onLaunchDashboard: () => void;
}

export default function LandingPage({ onLaunchDashboard }: LandingPageProps) {
  // Bento Box animation variants
  const bentoCardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        stiffness: 80,
        damping: 15
      }
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-800 overflow-x-hidden relative font-sans">
      
      {/* HTML5 Video Background and Glassmorphism Overlay */}
      <VideoHero />

      {/* Grid Overlay for extra design depth */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f015_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f015_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_60%,transparent_100%)] pointer-events-none -z-10" />

      <div className="relative z-20">

        {/* Hero Section */}
        <section className="relative min-h-[90vh] w-full flex items-center justify-center overflow-hidden bg-white">
          <BackgroundPathsWrapper />

          <div className="relative z-10 text-center max-w-4xl mx-auto px-4 space-y-6 md:space-y-8">
            
            {/* Subtle Tagline */}
            <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-50/80 border border-sky-100/80 px-3.5 py-1.5 text-xs font-semibold text-sky-700 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-sky-500 animate-pulse" />
              <span>Autonomous Candidate Orchestration</span>
            </div>

            {/* Animated Headline */}
            <h1 className="flex flex-wrap items-center justify-center gap-x-3">
              {"Hire Smarter, Not Harder with Autonomous AI.".split(" ").map((word, wordIndex) => (
                <span key={wordIndex} className="inline-flex">
                  {word.split("").map((letter, letterIndex) => (
                    <motion.span
                      key={letterIndex}
                      initial={{ y: 60, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 150,
                        damping: 25,
                        delay: wordIndex * 0.1 + letterIndex * 0.03,
                      }}
                      className="inline-block text-5xl sm:text-7xl md:text-8xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-neutral-900 to-neutral-800"
                    >
                      {letter}
                    </motion.span>
                  ))}
                </span>
              ))}
            </h1>

            {/* Description */}
            <p className="text-slate-500 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              Upload CVs or source LinkedIn leads, then let AI screen, rank, and recommend candidates against your job description - all in one place.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button
                onClick={onLaunchDashboard}
                className="bg-[#0284c7] hover:bg-[#0369a1] text-white px-8 py-4 rounded-xl shadow-md transition-all cursor-pointer text-center flex items-center justify-center gap-2 text-sm font-bold"
                id="hero-launch-dashboard-btn"
              >
                <span>Access the Hub</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <a
                href="#features"
                className="border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 px-8 py-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 text-sm font-bold"
                id="hero-explore-architecture-btn"
              >
                <span>See What It Does</span>
              </a>
            </div>

          </div>
        </section>

        <InfiniteGridWrapper>

        {/* Bento Box Features Section */}
        <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 py-12 md:py-20 mb-8 md:mb-12">
          
          {/* Section Heading */}
          <div className="max-w-3xl mb-8 md:mb-12 space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50/80 border border-sky-100 px-3 py-1 text-xs font-semibold text-sky-700 backdrop-blur-sm">
              <Layers className="h-3.5 w-3.5 text-sky-500" />
              Platform Capabilities
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 leading-tight">
              The Agentix Orchestration Engine
            </h2>
            <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
              Four AI agents handle parsing, screening, ranking, and candidate communication - configurable to match your hiring criteria.
            </p>
          </div>

          {/* Bento Box Grid with glassmorphic cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="bento-box-orchestration-engine">
            
            {/* Card 1: Omnichannel Fetcher (Col Span 2) */}
            <motion.div
              variants={bentoCardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              whileHover={{ y: -5 }}
              className="md:col-span-2 group relative rounded-2xl bg-white/70 border border-slate-200/80 p-6 md:p-8 flex flex-col justify-between overflow-hidden shadow-sm backdrop-blur-md transition-all duration-300 hover:shadow-md hover:bg-white"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-sky-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div 
                      whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
                      transition={{ duration: 0.3 }}
                      className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 border border-sky-100 text-sky-600 cursor-pointer"
                    >
                      <DownloadCloud className="h-6 w-6" />
                    </motion.div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Candidate Sourcing</h3>
                      <p className="text-[10px] font-mono text-sky-600 font-semibold tracking-wider uppercase">FetcherBot Node</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wider bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded">
                    2 SOURCES
                  </span>
                </div>

                <p className="text-slate-500 text-xs sm:text-sm leading-relaxed max-w-xl">
                  Bring your own CVs for a full AI screening, or let the fetcher bot source LinkedIn leads to expand your pipeline - each clearly labeled by confidence level.
                </p>
              </div>

              {/* Real sources, honestly labeled */}
              <div className="mt-6 pt-6 border-t border-slate-150 grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-10 text-xs">
                <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-2.5 text-center">
                  <div className="font-mono font-bold text-slate-800">CV UPLOAD</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Full AI screening</div>
                </div>
                <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-2.5 text-center">
                  <div className="font-mono font-bold text-slate-800">LINKEDIN SOURCING</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Low-confidence leads</div>
                </div>
              </div>
            </motion.div>

            {/* Card 2: JSON Parser (Col Span 1) */}
            <motion.div
              variants={bentoCardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              whileHover={{ y: -5 }}
              className="md:col-span-1 group relative rounded-2xl bg-white/70 border border-slate-200/80 p-6 md:p-8 flex flex-col justify-between overflow-hidden shadow-sm backdrop-blur-md transition-all duration-300 hover:shadow-md hover:bg-white"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-sky-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-3">
                  <motion.div 
                    whileHover={{ scale: 1.1, rotate: 180 }}
                    transition={{ duration: 0.4 }}
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 border border-sky-100 text-sky-600 cursor-pointer"
                  >
                    <Terminal className="h-6 w-6" />
                  </motion.div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">AI Resume Parsing</h3>
                    <p className="text-[10px] font-mono text-sky-600 font-semibold tracking-wider uppercase">ParserBot Node</p>
                  </div>
                </div>

                <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
                  Upload a real PDF or DOCX resume and Mistral AI extracts name, skills, experience, and location straight from the document text - no manual data entry.
                </p>
              </div>

              {/* Real extracted-field example */}
              <div className="mt-6 bg-slate-50/80 border border-slate-200 rounded-xl p-3 font-mono text-[9px] text-sky-700 relative z-10 overflow-hidden">
                <p className="text-slate-400">{"{"}</p>
                <p className="pl-3"><span className="text-slate-800">"skills"</span>: ["React", "Node.js", "AWS"],</p>
                <p className="pl-3"><span className="text-slate-800">"experience_years"</span>: 4</p>
                <p className="text-slate-400">{"}"}</p>
              </div>
            </motion.div>

            {/* Card 3: Scoring Engine (Col Span 1) */}
            <motion.div
              variants={bentoCardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              whileHover={{ y: -5 }}
              className="md:col-span-1 group relative rounded-2xl bg-white/70 border border-slate-200/80 p-6 md:p-8 flex flex-col justify-between overflow-hidden shadow-sm backdrop-blur-md transition-all duration-300 hover:shadow-md hover:bg-white"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-sky-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-3">
                  <motion.div 
                    whileHover={{ scale: 1.1, y: -3 }}
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 border border-sky-100 text-sky-600 cursor-pointer"
                  >
                    <Cpu className="h-6 w-6" />
                  </motion.div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Screening & Ranking</h3>
                    <p className="text-[10px] font-mono text-sky-600 font-semibold tracking-wider uppercase">RankerBot Node</p>
                  </div>
                </div>

                <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
                  Every candidate is scored 0-100 against your exact job description, ranked, and given a clear verdict - Recommend, Consider, or Do Not Recommend.
                </p>
              </div>

              {/* Score Match bar indicator representation */}
              <div className="mt-6 bg-slate-50/80 border border-slate-200/60 rounded-xl p-4 relative z-10 space-y-3 text-xs">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-slate-500 uppercase">Match Score</span>
                  <span className="text-sky-600 font-mono">Recommend @ 88%</span>
                </div>
                <div className="h-2 w-full bg-slate-200/60 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-600 rounded-full w-[88%]" />
                </div>
              </div>
            </motion.div>

            {/* Card 4: Auto-Scheduler (Col Span 2) */}
            <motion.div
              variants={bentoCardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              whileHover={{ y: -5 }}
              className="md:col-span-2 group relative rounded-2xl bg-white/70 border border-slate-200/80 p-6 md:p-8 flex flex-col justify-between overflow-hidden shadow-sm backdrop-blur-md transition-all duration-300 hover:shadow-md hover:bg-white"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-sky-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div 
                      whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
                      className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 border border-sky-100 text-sky-600 cursor-pointer"
                    >
                      <Zap className="h-6 w-6" />
                    </motion.div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Auto-Notify</h3>
                      <p className="text-[10px] font-mono text-sky-600 font-semibold tracking-wider uppercase">SchedulerBot Node</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wider bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded">
                    EMAIL
                  </span>
                </div>

                <p className="text-slate-500 text-xs sm:text-sm leading-relaxed max-w-xl">
                  When a candidate clears your screening bar, Agentix can send them a personalized screening update and interview invite automatically - no manual follow-up needed.
                </p>
              </div>

              {/* Real pipeline stage labels this connects to */}
              <div className="mt-6 pt-4 border-t border-slate-150 flex flex-wrap items-center gap-2 relative z-10 text-[10px]">
                <span className="px-2.5 py-1 rounded-lg bg-slate-50/80 border border-slate-200/60 font-mono font-semibold text-slate-600">Applied</span>
                <ArrowRight className="h-3 w-3 text-slate-300" />
                <span className="px-2.5 py-1 rounded-lg bg-slate-50/80 border border-slate-200/60 font-mono font-semibold text-slate-600">Screening</span>
                <ArrowRight className="h-3 w-3 text-slate-300" />
                <span className="px-2.5 py-1 rounded-lg bg-slate-50/80 border border-slate-200/60 font-mono font-semibold text-slate-600">Interviewing</span>
                <ArrowRight className="h-3 w-3 text-slate-300" />
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 font-mono font-semibold text-emerald-700">Offered</span>
              </div>
            </motion.div>

          </div>

          {/* Additional real capabilities - lighter-weight strip below the main bento grid */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: BarChart3, label: "Analytics Dashboard", desc: "Live hiring funnel & skill trends" },
              { icon: FileText, label: "Export Reports", desc: "TXT, XLSX, and PDF per candidate" },
              { icon: ListChecks, label: "Status Pipeline", desc: "Track candidates stage by stage" },
              { icon: ShieldCheck, label: "Private Workspace", desc: "Your candidate data, isolated per account" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="rounded-xl bg-white/70 border border-slate-200/80 backdrop-blur-md p-4 flex flex-col gap-2">
                <Icon className="h-4 w-4 text-sky-600" />
                <div className="text-xs font-bold text-slate-900">{label}</div>
                <div className="text-[10px] text-slate-500 leading-snug">{desc}</div>
              </div>
            ))}

          </div>

        </section>

        {/* Call to Action Section */}
        <section className="relative z-20 max-w-7xl mx-auto px-6 sm:px-8 py-10 md:py-16">
          <div className="max-w-5xl mx-auto overflow-hidden rounded-3xl border border-slate-200 bg-white/70 backdrop-blur-md p-8 md:p-12 text-center shadow-sm relative">
            <div className="absolute inset-0 bg-gradient-to-br from-sky-50/20 to-transparent pointer-events-none" />
            
            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 border border-sky-200 px-3.5 py-1 text-xs font-semibold text-sky-700">
                <Sparkles className="h-3.5 w-3.5 text-sky-500" />
                Free to Try
              </span>
              <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 leading-tight">
                Ready to Automate Your Screening?
              </h3>
              <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
                Sign up, upload a few resumes or source LinkedIn leads, and watch the full AI pipeline - parsing, screening, ranking, and verdicts - run end-to-end in under a minute.
              </p>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                <motion.button
                  onClick={onLaunchDashboard}
                  animate={{ scale: [1, 1.03, 1] }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="group relative overflow-hidden rounded-xl bg-sky-600 px-8 py-4 text-sm font-bold text-white shadow-md shadow-sky-100 hover:bg-sky-500 transition active:scale-95 cursor-pointer text-center flex items-center justify-center gap-2"
                  id="cta-start-screening-btn"
                >
                  <span>Access the Hub</span>
                  <ArrowRight className="h-4 w-4" />
                </motion.button>

                <a
                  href="#features"
                  className="rounded-xl bg-white border border-slate-200 hover:bg-slate-50 px-6 py-3.5 text-sm font-bold text-slate-700 transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  id="cta-explore-integrations-btn"
                >
                  <span>See What It Does</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative z-10 w-full bg-white/80 border-t border-slate-200 backdrop-blur-md font-sans">
          <div className="max-w-7xl mx-auto px-6 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
            <span>&copy; 2026 Agentix AI. All rights reserved.</span>
            <div className="flex items-center gap-3 text-slate-300">
              <span className="cursor-not-allowed" title="Coming soon">Privacy Policy</span>
              <span className="cursor-not-allowed" title="Coming soon">Terms of Service</span>
              <span className="cursor-not-allowed" title="Coming soon">Status Hub</span>
            </div>
          </div>
        </footer>

        </InfiniteGridWrapper>

      </div>
    </div>
  );
}
