export default function AnalyticsLoading() {
  return (
    <div className="space-y-6 max-w-full animate-in fade-in duration-200">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-36 rounded-md bg-muted/50 animate-pulse" />
        <div className="h-4 w-44 rounded-md bg-muted/30 animate-pulse" />
      </div>

      {/* Controls row: scope + period */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          <div className="h-7 w-14 rounded-md bg-muted/50 animate-pulse" />
          <div className="h-7 w-12 rounded-md bg-muted/30 animate-pulse" />
        </div>
        <div className="w-px h-4 bg-border/60" />
        <div className="flex gap-1">
          <div className="h-7 w-16 rounded-md bg-muted/40 animate-pulse" />
          <div className="h-7 w-18 rounded-md bg-muted/30 animate-pulse" style={{ width: 72 }} />
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border/60 bg-card/60 p-5 space-y-3 animate-pulse"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex justify-between items-start">
              <div className="space-y-2 flex-1">
                <div className="h-3 w-20 rounded bg-muted/40" />
                <div className="h-8 w-16 rounded bg-muted/60" />
                <div className="h-3 w-24 rounded bg-muted/30" />
              </div>
              <div className="h-9 w-9 rounded-lg bg-muted/40" />
            </div>
          </div>
        ))}
      </div>

      {/* Daily volume chart */}
      <div className="rounded-lg border border-border/60 bg-card/60 p-5 space-y-3 animate-pulse">
        <div className="h-4 w-36 rounded bg-muted/50" />
        <div className="h-3 w-52 rounded bg-muted/30" />
        <div className="h-52 rounded-md bg-muted/20 mt-2" />
      </div>

      {/* Two charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg border border-border/60 bg-card/60 p-5 space-y-3 animate-pulse" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="h-4 w-32 rounded bg-muted/50" />
            <div className="h-3 w-44 rounded bg-muted/30" />
            <div className="h-52 rounded-md bg-muted/20 mt-2" />
          </div>
        ))}
      </div>

      {/* Open tasks table */}
      <div className="rounded-lg border border-border/60 bg-card/60 p-5 space-y-3 animate-pulse">
        <div className="h-4 w-48 rounded bg-muted/50" />
        <div className="h-3 w-64 rounded bg-muted/30" />
        <div className="space-y-0 border border-border/60 rounded-lg overflow-hidden mt-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 px-3 py-3 border-b last:border-0 border-border/40" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-3/5 rounded bg-muted/50" />
                <div className="h-3 w-2/5 rounded bg-muted/30" />
              </div>
              <div className="h-5 w-20 rounded-md bg-muted/40" />
              <div className="h-3.5 w-14 rounded bg-muted/30" />
              <div className="h-3.5 w-14 rounded bg-muted/30" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
