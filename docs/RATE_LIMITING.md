# Mention Rate Limiting

> Status: Implemented — `src/listener-policy.js`.

## Why

A noisy sender (a broadcast bot, a forwarded chain, someone spamming
`@mentions`) can otherwise flood a user's mention feed and burn AI summary
budget for no real signal. The listener drops a mention past the limit
instead of persisting it.

## How

A sliding window keyed by `(group, sender)`, kept isolated from the Baileys
socket plumbing so the actual rule is easy to read and change on its own.
Defaults: 5 mentions per sender per group per 60 seconds.

```
MENTION_RATE_LIMIT_MAX=5
MENTION_RATE_LIMIT_WINDOW_MS=60000
```

Set `MENTION_RATE_LIMIT_MAX=0` to disable the limit entirely (e.g. for a
low-volume number where it would never trigger anyway).

## Not persisted

State lives in memory only — a listener restart clears it. That's
intentional: this is a noise filter, not an audit log, and it keeps the
implementation dependency-free.
