# Data-at-Rest Encryption

> Status: Implemented — `src/crypto.js` (listener/summarizer) + `app/lib/crypto.ts` (Next.js).

## What gets encrypted

Only `Mention.text` — the actual WA message content. Every other field
(sender, group, timestamp, priority, etc.) stays plain in its own column so
queries and indexes don't need to change.

## Scheme

AES-256-GCM. Ciphertext is stored as a single string:

```
enc:v1:<ivBase64>:<authTagBase64>:<ciphertextBase64>
```

The `enc:v1:` prefix lets `decryptText()` tell an already-encrypted row apart
from a legacy one written before this feature existed — a legacy row is
returned unchanged instead of throwing. That means **no backfill migration
is required** when this feature is first deployed;
`scripts/encrypt-existing-mentions.js` is available for anyone who wants to
backfill old data anyway.

## Why two implementations (crypto.js and crypto.ts)

`src/listener.js` and `src/summarizer.js` run as plain Node scripts (not
through the Next.js build), so they can't `import` a `.ts` file directly.
Both must stay algorithmically identical — if one changes, change the other
too.

## Setup

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# or
npm run keygen
```

Put the result in `ENCRYPTION_KEY` in `.env`. If it's left empty, chat text
is stored in plain text instead (a warning is logged) — only meant for local
experimentation.
