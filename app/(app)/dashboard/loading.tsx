export default function DashboardLoading() {
  return (
    <div className="space-y-6 w-full min-w-0 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded-md bg-muted/60" />
        <div className="h-8 w-24 rounded-md bg-muted/40" />
      </div>

      {/* Stats: 3 columns with dividers — matches DashboardStats grid */}
      <div className="grid grid-cols-3 divide-x divide-border border border-border rounded-lg overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="px-5 py-4 space-y-2">
            <div className="h-7 w-10 rounded-md bg-muted/60" style={{ animationDelay: `${i * 80}ms` }} />
            <div className="h-3 w-20 rounded bg-muted/40" />
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-border pb-3">
        <div className="h-8 w-16 rounded-md bg-muted/50" />
        <div className="h-8 w-20 rounded-md bg-muted/40" />
        <div className="h-8 w-14 rounded-md bg-muted/30" />
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-hidden">
        {['', '', ''].map((_, col) => (
          <div key={col} className="flex-1 min-w-[220px] bg-card/30 border border-border/50 rounded-lg p-3 space-y-3 min-h-[320px]">
            <div className="flex items-center gap-2 pb-2 border-b border-border/50">
              <div className="h-4 w-20 rounded bg-muted/50" />
              <div className="h-4 w-6 rounded-full bg-muted/30" />
            </div>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-md border border-border/60 bg-card/60 p-2.5 space-y-2"
                style={{ animationDelay: `${(col * 3 + i) * 60}ms` }}
              >
                <div className="h-4 w-4/5 rounded bg-muted/50" />
                <div className="h-3 w-3/5 rounded bg-muted/30" />
                <div className="flex items-center justify-between mt-1">
                  <div className="h-4 w-14 rounded bg-muted/40" />
                  <div className="h-3 w-12 rounded bg-muted/30" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
