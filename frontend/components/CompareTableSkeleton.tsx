type CompareTableSkeletonProps = {
  /** Number of job columns to render placeholders for. */
  columns?: number;
  /** Number of comparison field rows to render placeholders for. */
  rows?: number;
};

export default function CompareTableSkeleton({
  columns = 2,
  rows = 7,
}: CompareTableSkeletonProps) {
  return (
    <div
      className="animate-pulse overflow-x-auto rounded-lg border border-slate-200"
      aria-hidden="true"
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="h-4 w-12 rounded bg-slate-200" />
            </th>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="h-4 w-16 rounded bg-slate-200" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              <th scope="row" className="border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="h-4 w-20 rounded bg-slate-200" />
              </th>
              {Array.from({ length: columns }).map((_, c) => (
                <td key={c} className="border border-slate-200 px-3 py-2">
                  <div className="h-4 w-24 rounded bg-slate-200" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
