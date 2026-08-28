export default function SettingsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Section title */}
      <div className="h-6 w-40 rounded-md bg-muted/50 animate-pulse" />

      {/* Form fields */}
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="h-3.5 w-24 rounded bg-muted/40 animate-pulse" />
            <div className="h-9 w-full rounded-md bg-muted/30 animate-pulse border border-border/40" />
          </div>
        ))}
      </div>

      <div className="h-px bg-border/40" />

      {/* Second section */}
      <div className="h-5 w-32 rounded-md bg-muted/40 animate-pulse" />
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 rounded-lg border border-border/60 bg-card/40 animate-pulse"
            style={{ animationDelay: `${(i + 4) * 60}ms` }}
          >
            <div className="space-y-1.5">
              <div className="h-4 w-36 rounded bg-muted/50" />
              <div className="h-3 w-56 rounded bg-muted/30" />
            </div>
            <div className="h-6 w-11 rounded-full bg-muted/40" />
          </div>
        ))}
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <div className="h-9 w-24 rounded-md bg-muted/50 animate-pulse" />
      </div>
    </div>
  );
}
