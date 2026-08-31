# IBM watsonx.ai — Mention Classification

> Status: Implemented, optional — `src/watsonx.js` (listener) + `app/lib/watsonx.ts` (API).

## What it does

Every new mention gets tagged with a category (`request`, `question`,
`urgent`, `info`, `other`) via watsonx.ai, separate from the existing
DeepSeek pipeline (summarize + task extraction). The goal is quick triage in
the Inbox — not a replacement for the summarizer.

## Why two network calls

1. Exchange `WATSONX_API_KEY` for a bearer token via IBM IAM
   (`iam.cloud.ibm.com/identity/token`). The token is cached in memory until
   shortly before it expires.
2. POST the classification prompt to `POST /ml/v1/text/generation` on
   watsonx.ai.

Reference: https://cloud.ibm.com/apidocs/watsonx-ai

## Fails safely

`classifyMessage()` never throws to its caller — if `WATSONX_PROJECT_ID`
isn't set, or the request times out (8s), or IBM returns an error, the
result is `null` and the listener carries on as normal. Classification is
purely a nice-to-have and must never block mention ingestion.

## Manual endpoint

`POST /api/mentions/:id/classify` — re-tags an older mention, or verifies
the integration works without the listener running.

## Setup

Set `WATSONX_API_KEY` and `WATSONX_PROJECT_ID` in `.env`. `WATSONX_URL` and
`WATSONX_MODEL_ID` have sensible defaults (us-south region,
granite-13b-instruct-v2) — only change them if your watsonx project lives in
a different region or you want a different model.
