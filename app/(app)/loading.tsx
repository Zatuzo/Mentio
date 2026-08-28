export default function AppLoading() {
  return (
    <div className="space-y-6 max-w-full animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-44 rounded-md bg-muted/50 animate-pulse" />
          <div className="h-4 w-64 rounded-md bg-muted/30 animate-pulse" />
        </div>
        <div className="h-9 w-32 rounded-md bg-muted/40 animate-pulse" />
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-lg border border-border/60 bg-card/40 animate-pulse"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>

      {/* Content block */}
      <div className="rounded-lg border border-border/60 bg-card/40 animate-pulse" style={{ height: 320 }} />
    </div>
  );
}
