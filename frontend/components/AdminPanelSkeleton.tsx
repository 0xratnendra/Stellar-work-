export default function AdminPanelSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden="true">
      {/* Platform Fees */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="h-5 w-32 rounded bg-slate-200" />
        <div className="mt-4 h-9 w-40 rounded bg-slate-200" />
        <div className="mt-2 h-4 w-48 rounded bg-slate-200" />
        <div className="mt-4 h-9 w-32 rounded-md bg-slate-200" />
      </div>

      {/* Announcement Management */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="h-5 w-56 rounded bg-slate-200" />
        <div className="mt-4 h-20 w-full rounded-md bg-slate-200" />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="h-9 w-full rounded-md bg-slate-200" />
          <div className="h-9 w-full rounded-md bg-slate-200" />
          <div className="h-9 w-full rounded-md bg-slate-200" />
        </div>
        <div className="mt-4 h-9 w-28 rounded-md bg-slate-200" />
      </div>
    </div>
  );
}
