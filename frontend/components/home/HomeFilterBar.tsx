"use client";

import type { FormEvent } from "react";
import InfoTooltip from "@/components/InfoTooltip";
import JobFilterPanel, { type JobFilters } from "@/components/JobFilterPanel";
import Pagination from "@/components/Pagination";
import SectionCard from "@/components/SectionCard";
import { FIAT_CURRENCIES, type FiatCurrency } from "@/lib/format";
import type { JobStatus } from "@/lib/types";

type SortOrder = "newest" | "oldest" | "highest_amount" | "deadline_asc";
type StatusFilter = JobStatus | "Active" | "all";
type ViewMode = "grid" | "list";

interface HomeFilterBarProps {
  display: {
    currency: FiatCurrency;
    fiatTooltip: string;
    fiatRateError: string | null;
    sortOrder: SortOrder;
    showBookmarkedOnly: boolean;
    viewMode: ViewMode;
    loading: boolean;
    onCurrencyChange: (value: FiatCurrency) => void;
    onSortChange: (value: SortOrder) => void;
    onBookmarkedOnlyChange: (value: boolean) => void;
    onViewModeChange: (value: ViewMode) => void;
    onReset: () => void;
  };
  search: {
    term: string;
    recent: string[] | null;
    open: boolean;
    onChange: (term: string) => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    onFocus: () => void;
    onBlur: () => void;
    onSelect: (term: string) => void;
    onRemove: (term: string) => void;
    onClear: () => void;
    onClearHistory: () => void;
  };
  status: {
    value: StatusFilter;
    onChange: (value: StatusFilter) => void;
  };
  filters: JobFilters;
  resultCount: number;
  onFiltersChange: (filters: JobFilters) => void;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
  };
}

export default function HomeFilterBar({ display, search, status, filters, resultCount, onFiltersChange, pagination }: HomeFilterBarProps) {
  return (
    <SectionCard title="Jobs Display" description="Default sort is newest first.">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
        <label className="text-sm font-medium text-slate-700">
          Fiat currency
          <select value={display.currency} onChange={(event) => display.onCurrencyChange(event.target.value as FiatCurrency)} className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm" title={display.fiatTooltip}>
            {FIAT_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
          </select>
        </label>
        {display.fiatRateError && <p className="text-xs text-amber-700">{display.fiatRateError}</p>}
      </div>

      <form onSubmit={search.onSubmit} className="space-y-3 rounded-md border border-slate-200 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="relative flex-1 text-sm text-slate-600" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) search.onBlur();
          }}>
            <label htmlFor="job-search" className="block font-medium text-slate-700">Search jobs</label>
            <input id="job-search" type="search" value={search.term} onChange={(event) => search.onChange(event.target.value)} onFocus={search.onFocus} placeholder="Search by description keyword" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2" aria-controls="recent-searches-listbox" aria-expanded={search.open} aria-haspopup="listbox" />
            {search.open && (search.recent?.length ?? 0) > 0 && (
              <div className="absolute z-20 mt-2 w-full rounded-md border border-slate-200 bg-white p-2 shadow-lg">
                <div id="recent-searches-listbox" role="listbox" aria-label="Recent searches" className="space-y-1">
                  {(search.recent ?? []).map((term) => (
                    <div key={term} role="option" aria-selected={search.term.trim().toLowerCase() === term.toLowerCase()} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                      <button type="button" onClick={() => search.onSelect(term)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                        <span className="truncate">{term}</span>
                      </button>
                      <button type="button" onClick={() => search.onRemove(term)} className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label={`Remove ${term} from recent searches`}>X</button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={search.onClearHistory} className="mt-2 w-full border-t border-slate-100 pt-2 text-left text-xs font-medium text-slate-600 hover:text-slate-900">Clear history</button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={!search.term.trim()}>Search</button>
            <button type="button" onClick={search.onClear} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60" disabled={!search.term}>Clear</button>
          </div>
        </div>
      </form>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-slate-700">Filter by status</legend>
        <div className="flex flex-wrap gap-2">
          {(["Open", "InProgress", "SubmittedForReview", "Completed", "Cancelled", "Disputed"] as JobStatus[]).map((value) => (
            <button key={value} type="button" onClick={() => status.onChange(value)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${status.value === value ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}>
              {value === "SubmittedForReview" ? "Review" : value}
            </button>
          ))}
          <button type="button" onClick={() => status.onChange("all")} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${status.value === "all" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}>All</button>
        </div>
      </fieldset>

      <JobFilterPanel filters={filters} onChange={onFiltersChange} resultCount={resultCount} />
      <div className="mt-4">
        <Pagination page={pagination.page} pageSize={pagination.pageSize} total={pagination.total} onPageChange={pagination.onPageChange} onPageSizeChange={pagination.onPageSizeChange} />
      </div>

      <fieldset className="space-y-3 rounded-md border border-slate-200 p-3">
        <legend className="px-1 text-sm font-medium text-slate-700">Sort and filter job results</legend>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <div className="inline-flex items-center gap-2"><label htmlFor="jobs-sort-order">Sort:</label><InfoTooltip label="Sort and filter jobs help" content="Newest first surfaces recent jobs at the top. Deadline ascending lists jobs with the closest deadline first. Favorites only filters to bookmarked jobs in this browser." /></div>
          <select id="jobs-sort-order" value={display.sortOrder} onChange={(event) => display.onSortChange(event.target.value as SortOrder)} className="rounded-md border border-slate-300 bg-white px-2 py-1" disabled={display.loading}>
            <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest_amount">Highest amount</option><option value="deadline_asc">Deadline ascending</option>
          </select>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={display.showBookmarkedOnly} onChange={(event) => display.onBookmarkedOnlyChange(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />Favorites only</label>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600" role="group" aria-label="Jobs layout">
          <span className="font-medium text-slate-700">Layout:</span>
          {(["grid", "list"] as ViewMode[]).map((mode) => <button key={mode} type="button" className={`rounded-md border px-3 py-1 font-medium ${display.viewMode === mode ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`} aria-pressed={display.viewMode === mode} onClick={() => display.onViewModeChange(mode)}>{mode === "grid" ? "Grid" : "List"}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600"><button type="button" className="rounded-md border border-slate-300 bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-50" onClick={display.onReset}>Reset Preferences</button></div>
      </fieldset>
    </SectionCard>
  );
}
