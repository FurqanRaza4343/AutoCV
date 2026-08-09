import React, { useState } from "react";
import { Filter, X, MapPin } from "lucide-react";
import { platformDotClass } from "../lib/platformBadge";

const PAKISTAN_CITIES = ["Karachi", "Lahore", "Islamabad", "Rawalpindi"];

export interface FiltersState {
  gender: string;
  shift: string;
  remote: string;
  ageMin: string;
  ageMax: string;
  location: string;
  experienceMin: string;
  experienceMax: string;
}

interface FetchFiltersProps {
  filters: FiltersState;
  onChange: (filters: FiltersState) => void;
  onFetch: () => void;
  isFetching: boolean;
  platformBreakdown?: Record<string, number>;
  fetchMessage?: string;
}

export default function FetchFilters({ filters, onChange, onFetch, isFetching, platformBreakdown, fetchMessage }: FetchFiltersProps) {
  const [showCityPicker, setShowCityPicker] = useState(false);

  const update = (key: keyof FiltersState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const hasAnyFilter = Object.values(filters).some(v => v !== "" && v !== "any");

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Filter className="h-4 w-4 text-indigo-600" />
          Candidate Filters
        </h3>
        {hasAnyFilter && (
          <button
            onClick={() => onChange({ gender: "", shift: "", remote: "", ageMin: "", ageMax: "", location: "", experienceMin: "", experienceMax: "" })}
            className="text-xs text-slate-400 hover:text-rose-500 flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Gender</label>
          <select
            value={filters.gender}
            onChange={(e) => update("gender", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs focus:border-slate-400 focus:outline-none bg-white"
          >
            <option value="">Any</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Shift</label>
          <select
            value={filters.shift}
            onChange={(e) => update("shift", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs focus:border-slate-400 focus:outline-none bg-white"
          >
            <option value="">Any</option>
            <option value="Morning">Morning</option>
            <option value="Evening">Evening</option>
            <option value="Night">Night</option>
            <option value="Remote">Remote</option>
            <option value="Hybrid">Hybrid</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Remote</label>
          <select
            value={filters.remote}
            onChange={(e) => update("remote", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs focus:border-slate-400 focus:outline-none bg-white"
          >
            <option value="">Any</option>
            <option value="true">Remote Only</option>
            <option value="false">On-site Only</option>
          </select>
        </div>

        <div className="relative">
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Location</label>
          <div className="relative">
            <input
              type="text"
              value={filters.location}
              onChange={(e) => update("location", e.target.value)}
              placeholder="e.g. Lahore"
              className="w-full rounded-lg border border-slate-200 pl-2.5 pr-8 py-2 text-xs focus:border-slate-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowCityPicker((v) => !v)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              title="Pick a Pakistani city"
              aria-expanded={showCityPicker}
            >
              <MapPin className="h-3.5 w-3.5" />
            </button>
          </div>
          {showCityPicker && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg p-1.5">
              {PAKISTAN_CITIES.map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => { update("location", city); setShowCityPicker(false); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                    filters.location === city ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {city}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Age (min)</label>
          <input
            type="number"
            value={filters.ageMin}
            onChange={(e) => update("ageMin", e.target.value)}
            placeholder="20"
            min={18}
            max={70}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs focus:border-slate-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Age (max)</label>
          <input
            type="number"
            value={filters.ageMax}
            onChange={(e) => update("ageMax", e.target.value)}
            placeholder="45"
            min={18}
            max={70}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs focus:border-slate-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Experience (min yrs)</label>
          <input
            type="number"
            value={filters.experienceMin}
            onChange={(e) => update("experienceMin", e.target.value)}
            placeholder="0"
            min={0}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs focus:border-slate-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Experience (max yrs)</label>
          <input
            type="number"
            value={filters.experienceMax}
            onChange={(e) => update("experienceMax", e.target.value)}
            placeholder="15"
            min={0}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs focus:border-slate-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        {platformBreakdown && Object.keys(platformBreakdown).length > 0 && (
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            {Object.entries(platformBreakdown).map(([platform, count]) => (
              <span key={platform} className="flex items-center gap-1">
                <span className={`inline-block w-2 h-2 rounded-full ${platformDotClass(platform)}`} />
                {platform}: {count}
              </span>
            ))}
          </div>
        )}
        <button
          onClick={onFetch}
          disabled={isFetching}
          className={`ml-auto px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 ${
            isFetching
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-indigo-600 text-white hover:bg-indigo-700"
          }`}
        >
          {isFetching ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {fetchMessage || "Finding LinkedIn Leads..."}
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Find LinkedIn Leads
            </>
          )}
        </button>
      </div>
    </div>
  );
}
