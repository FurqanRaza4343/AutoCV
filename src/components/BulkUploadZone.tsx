import React, { useState } from "react";
import {
  UploadCloud,
  FileText,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface StagedFile {
  id: string;
  name: string;
  size: string;
  type: string;
}

interface BulkUploadZoneProps {
  onFilesProcessed?: (count: number) => void;
  onFilesSelected?: (files: { id: string; name: string; size: string; file: File }[]) => void;
  showToast?: (message: string) => void;
}

const plural = (count: number, singular: string, pluralForm?: string): string => {
  const word = count === 1 ? singular : (pluralForm ?? `${singular}s`);
  return `${count} ${word}`;
};

export default function BulkUploadZone({ onFilesProcessed, onFilesSelected, showToast }: BulkUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);

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
      handleIncomingFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleIncomingFiles(Array.from(e.target.files));
    }
  };

  const handleIncomingFiles = (filesList: File[]) => {
    const validExtensions = [".pdf", ".docx"];
    const filteredFiles = filesList.filter(file => {
      const name = file.name.toLowerCase();
      return validExtensions.some(ext => name.endsWith(ext));
    });

    if (filteredFiles.length === 0) {
      const message = "No compatible files found. Please upload .pdf or .docx resumes.";
      if (showToast) showToast(message); else console.warn(message);
      return;
    }

    const newStagedFiles: StagedFile[] = filteredFiles.map((file, idx) => ({
      id: `bulk-${Date.now()}-${idx}`,
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
      type: file.name.split(".").pop()?.toUpperCase() || "PDF",
    }));

    if (onFilesSelected) {
      onFilesSelected(newStagedFiles.map((s, i) => ({
        id: s.id,
        name: s.name,
        size: s.size,
        file: filteredFiles[i],
      })));
    }

    // Files are already in memory at this point - there's no real upload to animate
    // progress toward yet. The actual upload happens when "Run AI Scoring" is clicked.
    setStagedFiles(newStagedFiles);
    if (showToast) {
      showToast(`${plural(newStagedFiles.length, "file")} staged - click "Run Agentix AI Scoring" to upload & score.`);
    }
    if (onFilesProcessed) {
      onFilesProcessed(newStagedFiles.length);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" id="agentix-bulk-upload-widget">
      {/* Title block */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="h-4.5 w-4.5 text-indigo-600" />
            Bulk Resume Upload
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Stage multiple CVs, then run AI scoring on all of them at once.</p>
        </div>
      </div>

      {/* Full-width Manual Bulk Upload Area */}
      <div className="p-6">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">Upload Candidate CVs</h4>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById("bulk-file-uploader-input")?.click()}
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
            isDragging 
              ? "border-indigo-500 bg-indigo-50/20" 
              : "border-slate-200 hover:border-slate-300 bg-slate-50/30 hover:bg-slate-50/70"
          }`}
        >
          <input
            id="bulk-file-uploader-input"
            type="file"
            multiple
            accept=".pdf,.docx"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-3 border border-indigo-100">
            <UploadCloud className="h-5.5 w-5.5" />
          </div>

          <p className="text-xs font-bold text-slate-800">Drag &amp; drop resume files here, or browse</p>
          <p className="text-[10px] text-slate-400 mt-1 max-w-xs">Supports PDF and DOCX formats, up to 10MB each.</p>

          <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600 border border-slate-200/60">
              <FileText className="h-2.5 w-2.5 text-red-500" />
              PDF
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600 border border-slate-200/60">
              <FileText className="h-2.5 w-2.5 text-blue-500" />
              DOCX
            </span>
          </div>
        </div>
      </div>

      {/* Staged files - not yet uploaded. Upload happens when "Run AI Scoring" runs. */}
      <AnimatePresence>
        {stagedFiles.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-100 bg-slate-50/60 p-5 space-y-3"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{plural(stagedFiles.length, "file")} staged - not yet uploaded</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              {stagedFiles.slice(0, 6).map((file) => (
                <div key={file.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-200/50 bg-white text-[10px]">
                  <div className="flex items-center gap-2 truncate max-w-[80%]">
                    <FileText className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-700 truncate">{file.name}</span>
                  </div>
                  <span className="text-slate-400 font-mono">{file.size}</span>
                </div>
              ))}
              {stagedFiles.length > 6 && (
                <div className="p-2 rounded-lg border border-dashed border-slate-200/80 bg-slate-100/30 text-[10px] text-slate-400 flex items-center justify-center font-medium">
                  + {stagedFiles.length - 6} more {stagedFiles.length - 6 === 1 ? "document" : "documents"} staged
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
