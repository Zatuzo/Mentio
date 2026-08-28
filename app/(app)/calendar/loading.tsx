export default function CalendarLoading() {
  const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

  return (
    <div className="space-y-6 max-w-full animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-32 rounded-md bg-muted/50 animate-pulse" />
          <div className="h-4 w-48 rounded-md bg-muted/30 animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-8 rounded-md bg-muted/40 animate-pulse" />
          <div className="h-8 w-28 rounded-md bg-muted/50 animate-pulse" />
          <div className="h-8 w-8 rounded-md bg-muted/40 animate-pulse" />
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-lg border border-border/60 bg-card/60 overflow-hidden animate-pulse">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border/60">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2.5 flex items-center justify-center">
              <div className="h-3 w-6 rounded bg-muted/40" />
            </div>
          ))}
        </div>

        {/* Calendar cells — 5 rows × 7 cols */}
        {[...Array(5)].map((_, row) => (
          <div key={row} className="grid grid-cols-7 border-b last:border-0 border-border/40">
            {[...Array(7)].map((_, col) => {
              const delay = (row * 7 + col) * 15;
              const hasTask = (row * 7 + col) % 5 === 2 || (row * 7 + col) % 7 === 3;
              return (
                <div
                  key={col}
                  className="min-h-[88px] p-1.5 border-r last:border-0 border-border/40"
                  style={{ animationDelay: `${delay}ms` }}
                >
                  <div className="h-6 w-6 rounded-full bg-muted/30 mb-1.5" />
                  {hasTask && (
                    <div className="h-5 w-full rounded-sm bg-muted/40 mt-1" />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
