export default function InboxLoading() {
  return (
    <div className="space-y-5 max-w-full animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-24 rounded-md bg-muted/50 animate-pulse" />
          <div className="h-4 w-48 rounded-md bg-muted/30 animate-pulse" />
        </div>
        <div className="h-8 w-20 rounded-md bg-muted/40 animate-pulse" />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {[80, 64, 96, 72].map((w, i) => (
          <div key={i} className={`h-7 w-${w === 80 ? '20' : w === 64 ? '16' : w === 96 ? '24' : '18'} rounded-md bg-muted/40 animate-pulse`} style={{ width: w }} />
        ))}
      </div>

      {/* Message list */}
      <div className="border border-border/60 rounded-lg overflow-hidden divide-y divide-border/40">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="flex gap-3 px-4 py-3.5 animate-pulse"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            {/* Unread dot */}
            <div className="mt-2 h-2 w-2 rounded-full bg-muted/50 flex-shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              {/* Sender + time */}
              <div className="flex items-center justify-between gap-2">
                <div className="h-3.5 w-28 rounded bg-muted/60" />
                <div className="h-3 w-14 rounded bg-muted/30" />
              </div>
              {/* Group name */}
              <div className="h-3 w-40 rounded bg-muted/30" />
              {/* Message preview */}
              <div className="h-3.5 w-full rounded bg-muted/40" />
              <div className="h-3.5 w-3/4 rounded bg-muted/30" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
