# Second Brain Feature — Design Document

> Status: Draft for review  
> Target: Extend WA Mention Agent into a personal knowledge management system  
> Principle: WA remains the primary input channel; second brain is the layer on top

---

## 1. Vision

The app already captures what matters to you from WhatsApp. Second Brain extends this by:

1. **Capturing** — not just WA mentions, but any information (manual notes, web clips, files, ideas)
2. **Organizing** — tagging, linking between items, grouping into spaces
3. **Retrieving** — full-text search + AI-powered semantic search (ask questions, get answers from your own data)
4. **Connecting** — surface relationships between mentions, tasks, notes, and summaries automatically

The result: everything you need to remember or act on lives in one place, with AI that understands the full context.

---

## 2. Core Concepts

### 2.1 Note
The atomic unit of knowledge. A note is anything worth remembering:
- A thought written manually
- A web page clipped from a browser
- A WhatsApp message saved manually
- A file upload (PDF, image)
- A WA mention promoted to a note

### 2.2 Space
A named collection of notes, similar to a notebook or folder. Examples: "Work", "Personal", "Project Alpha", "Learning". Users can have multiple spaces; notes belong to one space.

### 2.3 Tag
Free-form labels attached to any item (note, mention, task, summary). Used for cross-cutting themes that don't fit into a single space. Example: `#idea`, `#follow-up`, `#urgent`.

### 2.4 Link
An explicit connection between any two items. Inspired by Obsidian-style bidirectional linking. A note can link to a task, a mention can link to a note, etc.

### 2.5 Knowledge Base
The user's entire corpus of notes + mentions + summaries + tasks, queryable by AI. Used for RAG (Retrieval-Augmented Generation) in the AI chat.

---

## 3. New Features

### 3.1 Notes (Manual Capture)
- Rich text editor (Markdown-based) for writing notes manually
- Support for: headings, bold/italic, bullet lists, code blocks, checkboxes
- Attach tags at creation time
- Link to existing tasks, mentions, or other notes with `[[note-title]]` syntax
- Notes live in a Space (user selects on creation, defaults to last used)

### 3.2 Web Clipper
- Browser bookmarklet or extension (MVP: bookmarklet)
- Clip: full page, selection only, or just metadata (title + URL + description)
- Clipped items land in a "Inbox" space for later organization
- Auto-extract: title, URL, date, estimated reading time

### 3.3 Save from WhatsApp
- Any WA mention can be promoted to a note with one click
- The original message becomes the note body; user can append their own context
- Tags and space assignment at save time
- Bidirectional link: note ↔ original mention

### 3.4 Full-Text Search
- Search across all notes, mentions, summaries, and tasks simultaneously
- Instant results (no round trip to AI)
- Filter by: content type, space, tag, date range
- Highlight matching terms in results

### 3.5 AI Semantic Search & Q&A (RAG)
- Powered by vector embeddings stored in the database
- Ask natural language questions: "What did we decide about the API design?" or "What tasks are related to payments?"
- AI reads the top matching chunks from your knowledge base and answers with citations
- Integrated into the existing `/ai` chat as a new tool: `search_knowledge_base`
- Citations link back to the original source (note, mention, summary, task)

### 3.6 Tag Management
- Tags are global across all item types
- Tag page shows all items with that tag
- Rename, merge, delete tags
- Auto-suggest tags based on content (AI-powered, opt-in)

### 3.7 Space Management
- Create, rename, archive spaces
- Reorder notes within a space (manual drag-and-drop or alphabetical/date)
- Space overview: item count, last activity, pinned notes

### 3.8 Linked Mentions (Graph)
- View panel showing all items linked to the current note/mention
- Backlinks: "X other items reference this"
- Optional: graph view (force-directed) showing knowledge connections

### 3.9 Daily Log
- Auto-created daily note (optional, toggle in settings)
- Mentions received today are appended automatically
- User can write free-form at the top
- Acts as a journal + activity log

### 3.10 Quick Capture
- Global keyboard shortcut or floating button to create a note instantly
- Minimal UI: just a text box + optional tag + save
- Sends to Inbox space, no friction

---

## 4. Schema Changes

### 4.1 New Models

```prisma
model Space {
  id          String   @id @default(cuid())
  userId      String
  user        user     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  description String?
  color       String?  // hex color for visual identification
  icon        String?  // emoji or icon name
  isInbox     Boolean  @default(false) // one default inbox per user
  isArchived  Boolean  @default(false)
  order       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  notes       Note[]

  @@unique([userId, name])
  @@index([userId, isArchived])
}

model Note {
  id          String    @id @default(cuid())
  userId      String
  user        user      @relation(fields: [userId], references: [id], onDelete: Cascade)
  spaceId     String
  space       Space     @relation(fields: [spaceId], references: [id])
  title       String    @default("Untitled")
  content     String    @db.Text            // Markdown
  contentText String    @db.Text            // plain text for FTS, stripped from content
  sourceType  String    @default("manual")  // manual | web_clip | wa_mention | file
  sourceUrl   String?                       // for web clips
  sourceMentionId String?                   // for wa_mention source
  sourceMention   Mention? @relation(fields: [sourceMentionId], references: [id], onDelete: SetNull)
  isPinned    Boolean   @default(false)
  isDaily     Boolean   @default(false)     // true = auto-created daily log
  dailyDate   DateTime?                     // date if isDaily=true
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  tags        NoteTag[]
  embeddings  NoteEmbedding[]
  linksFrom   ItemLink[] @relation("LinkSource")
  linksTo     ItemLink[] @relation("LinkTarget")

  @@index([userId, spaceId])
  @@index([userId, createdAt])
  @@index([sourceMentionId])
}

model Tag {
  id        String    @id @default(cuid())
  userId    String
  user      user      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  color     String?
  createdAt DateTime  @default(now())

  noteTags     NoteTag[]
  mentionTags  MentionTag[]
  taskTags     TaskTag[]

  @@unique([userId, name])
  @@index([userId])
}

model NoteTag {
  noteId String
  tagId  String
  note   Note   @relation(fields: [noteId], references: [id], onDelete: Cascade)
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([noteId, tagId])
}

model MentionTag {
  mentionId String
  tagId     String
  mention   Mention @relation(fields: [mentionId], references: [id], onDelete: Cascade)
  tag       Tag     @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([mentionId, tagId])
}

model TaskTag {
  taskId String
  tagId  String
  task   Task   @relation(fields: [taskId], references: [id], onDelete: Cascade)
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([taskId, tagId])
}

// Generic bidirectional link between any two items
model ItemLink {
  id           String   @id @default(cuid())
  userId       String
  sourceType   String   // note | mention | task | summary
  sourceId     String
  targetType   String   // note | mention | task | summary
  targetId     String
  createdAt    DateTime @default(now())

  // Convenience FK for Note-to-Note links (optional — nullable for cross-type links)
  sourceNote   Note?    @relation("LinkSource", fields: [sourceId], references: [id], onDelete: Cascade, map: "ItemLink_sourceNote_fk")
  targetNote   Note?    @relation("LinkTarget", fields: [targetId], references: [id], onDelete: Cascade, map: "ItemLink_targetNote_fk")

  @@unique([sourceType, sourceId, targetType, targetId])
  @@index([userId, targetType, targetId])
  @@index([userId, sourceType, sourceId])
}

// Vector embeddings for semantic search (RAG)
model NoteEmbedding {
  id        String   @id @default(cuid())
  noteId    String
  note      Note     @relation(fields: [noteId], references: [id], onDelete: Cascade)
  chunkIdx  Int      @default(0)  // chunk index (for long notes split into chunks)
  chunkText String   @db.Text
  embedding Bytes    // float32[] serialized; or store as JSON if pgvector not available
  model     String   @default("text-embedding-3-small")
  createdAt DateTime @default(now())

  @@index([noteId])
}

// Same for mentions (so AI can search across all content types)
model MentionEmbedding {
  id        String   @id @default(cuid())
  mentionId String
  mention   Mention  @relation(fields: [mentionId], references: [id], onDelete: Cascade)
  chunkText String   @db.Text
  embedding Bytes
  model     String   @default("text-embedding-3-small")
  createdAt DateTime @default(now())

  @@index([mentionId])
}
```

### 4.2 Modifications to Existing Models

```prisma
// Add to Mention model:
  savedAsNoteId   String?   // if promoted to a note
  tags            MentionTag[]
  embeddings      MentionEmbedding[]

// Add to Task model:
  tags            TaskTag[]

// Add to user model:
  spaces          Space[]
  notes           Note[]
  tags            Tag[]
```

### 4.3 PostgreSQL Full-Text Search

Use PostgreSQL's built-in `tsvector` / `tsquery` for fast FTS on notes. Add a generated column or a trigger to keep `contentText` in sync, then index it:

```sql
-- After migration, add a GIN index for FTS:
CREATE INDEX notes_content_fts ON "Note" USING GIN (to_tsvector('english', "contentText"));
```

For the Prisma query layer, use raw SQL via `$queryRaw` until Prisma adds native FTS support.

---

## 5. API Routes

```
# Notes CRUD
POST   /api/notes                  — create note
GET    /api/notes                  — list notes (with filters: spaceId, tag, query)
GET    /api/notes/[id]             — get note + backlinks
PATCH  /api/notes/[id]             — update note
DELETE /api/notes/[id]             — delete note

# Spaces
POST   /api/spaces                 — create space
GET    /api/spaces                 — list user spaces
PATCH  /api/spaces/[id]            — update space
DELETE /api/spaces/[id]            — archive space

# Tags
GET    /api/tags                   — list tags with item counts
POST   /api/tags                   — create tag
PATCH  /api/tags/[id]              — rename/recolor tag
DELETE /api/tags/[id]              — delete tag (untag all items)
POST   /api/tags/merge             — merge tagA into tagB

# Search
GET    /api/search?q=...&type=...  — full-text search across all types
POST   /api/search/semantic        — semantic search (returns top K chunks + source refs)

# Web clipper
POST   /api/clip                   — receive clip payload from bookmarklet

# Mention → Note
POST   /api/mentions/[id]/save     — promote mention to note (creates Note, sets savedAsNoteId)
```

---

## 6. AI Chat Tools (RAG)

Add to the existing AI chat agent (`/ai`):

```typescript
// New tool: search_knowledge_base
{
  name: "search_knowledge_base",
  description: "Search the user's personal knowledge base (notes, mentions, summaries, tasks). Use when the user asks about past conversations, decisions, ideas, or anything they may have saved.",
  parameters: {
    query: string,           // natural language query
    types: string[],         // optional: ["note","mention","summary","task"]
    limit: number            // default 5
  }
}

// New tool: create_note
{
  name: "create_note",
  description: "Create a new note in the user's second brain from the conversation.",
  parameters: {
    title: string,
    content: string,         // markdown
    spaceId: string,         // optional, defaults to inbox
    tags: string[]           // optional tag names
  }
}

// New tool: save_mention_as_note
{
  name: "save_mention_as_note",
  description: "Promote a WhatsApp mention to a note with optional additional context.",
  parameters: {
    mentionId: string,
    additionalContext: string // optional, appended to note body
  }
}
```

**RAG Pipeline:**
1. User asks a question in AI chat
2. Agent calls `search_knowledge_base`
3. Query is embedded using the same model as stored embeddings
4. Top-K nearest chunks retrieved using cosine similarity (via `pgvector` extension or manual dot-product)
5. Chunks injected into the Claude context as `<source>` blocks
6. Claude answers with citations like `[Note: "API Design Decision", 2026-05-12]`

---

## 7. Embedding Strategy

### Model
- **OpenAI `text-embedding-3-small`** (1536 dims, cheap at $0.02/M tokens)
- Or **Claude's own embedding** if Anthropic adds one
- Store model name per embedding row so we can migrate models later

### When to embed
- On note create/update: chunk content into 500-token overlapping windows, embed each chunk asynchronously (background job)
- On mention created: embed the `text` field
- On summary created: embed the `content` field

### Storage
- **MVP**: store as `Bytes` (serialized float32 array), compute cosine similarity in a Prisma `$queryRaw`
- **Scale**: migrate to `pgvector` extension on Neon PostgreSQL (`vector(1536)` column, `ivfflat` index)

### Chunking
```
chunk_size    = 500 tokens
overlap       = 50 tokens
max_chunks    = 20 per note (notes > 10k tokens are split)
```

---

## 8. Web Clipper (MVP: Bookmarklet)

```javascript
// Bookmarklet code (minified in production)
javascript:(function(){
  const payload = {
    title: document.title,
    url: location.href,
    selection: window.getSelection().toString(),
    description: document.querySelector('meta[name="description"]')?.content || ''
  };
  fetch('https://your-app.com/api/clip', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer USER_API_KEY', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(() => alert('Saved to Second Brain'));
})();
```

The user copies their personal bookmarklet URL from Settings → Second Brain. The API key is auto-generated for them.

**Future**: Chrome/Firefox extension with richer UI (select space + tags before saving).

---

## 9. UI / Pages

### 9.1 New Routes

```
/brain                    — Second Brain home (recent + spaces sidebar)
/brain/inbox              — Inbox space (unorganized clips + quick captures)
/brain/spaces/[id]        — Space view (list/grid of notes)
/brain/notes/[id]         — Note editor (full-screen, markdown)
/brain/tags               — Tag management page
/brain/tags/[name]        — All items with this tag
/brain/search             — Search results page
/brain/daily              — Today's daily log
/brain/graph              — Knowledge graph (Phase 2)
```

### 9.2 Note Editor
- Left: note content (markdown editor with live preview toggle)
- Right panel (collapsible): tags, space, linked items, backlinks, source info
- Toolbar: headings, bold, italic, link, code block, `[[` to link to other notes
- Auto-save on type (debounced 1s)
- Keyboard shortcut: `Cmd+K` to quick-link

### 9.3 Second Brain Home (`/brain`)
- Left sidebar: Spaces list + Inbox + Tags (collapsible)
- Main area: Recent notes (last 10 updated)
- Quick capture input at top
- Search bar (opens full search on focus)

### 9.4 Search Page
- Unified search: toggle between FTS (instant) and semantic (slower, deeper)
- Result cards show: title, source type badge, snippet with highlights, space + tags
- Click result → navigates to item

### 9.5 Sidebar Integration
- Add "Brain" nav item in the main app sidebar (between Inbox and Analytics)
- Unread inbox count badge

---

## 10. Implementation Phases

### Phase A — Foundation (1-2 weeks)
> Goal: notes work, no search, no AI

- [ ] Prisma schema: `Space`, `Note`, `Tag`, `NoteTag`, `MentionTag`, `TaskTag`
- [ ] Seed: create default "Inbox" space for each user on first login
- [ ] API: full CRUD for notes, spaces, tags
- [ ] UI: `/brain` home, `/brain/spaces/[id]`, `/brain/notes/[id]` with markdown editor
- [ ] Save mention as note (button on mention card)
- [ ] Tags UI on notes, mentions, and tasks

### Phase B — Search (1 week)
> Goal: find anything fast

- [ ] Full-text search via PostgreSQL `tsvector` across notes + mentions + summaries + tasks
- [ ] `/api/search` route with type filters
- [ ] `/brain/search` page with unified results
- [ ] Highlight matching terms

### Phase C — Web Clipper (3-4 days)
> Goal: capture from browser

- [ ] `/api/clip` route (accepts bookmarklet payload, creates note in Inbox)
- [ ] Bookmarklet generator in Settings → Second Brain
- [ ] Clip shows source URL and auto-title from page title

### Phase D — AI Semantic Search (1-2 weeks)
> Goal: ask questions about your own knowledge

- [ ] Background job: embed notes + mentions on create/update
- [ ] `NoteEmbedding` + `MentionEmbedding` models in Prisma
- [ ] `/api/search/semantic` route (embed query → cosine similarity → return top K)
- [ ] Add `search_knowledge_base` and `create_note` tools to AI chat agent
- [ ] Citations in AI responses link back to sources

### Phase E — Linking & Daily Log (1 week)
> Goal: connect knowledge, build habit

- [ ] `ItemLink` model + link creation from note editor (`[[` autocomplete)
- [ ] Backlinks panel in note editor
- [ ] Daily log: auto-create note for today, append today's mentions
- [ ] Toggle in Settings: enable/disable daily log

### Phase F — Graph View (Phase 2, after traction)
> Goal: visual knowledge map

- [ ] Force-directed graph using `d3-force` or `react-force-graph`
- [ ] Nodes: notes, mentions, tasks; edges: `ItemLink` rows
- [ ] Click node → navigate to item
- [ ] Filter by space, tag, date

---

## 11. Settings Additions

Under Settings → Second Brain:
- **Default space** for quick captures
- **Daily log** toggle (auto-create daily note)
- **Auto-embed** toggle (enable semantic search; warns about embedding costs)
- **Web Clipper** section: show bookmarklet URL + instructions
- **API key** for bookmarklet (uses existing `ApiKey` model, scope: `write:notes`)

---

## 12. Data Ownership & Privacy

- All notes are private to the user (userId isolation, enforced at query layer)
- Embeddings are computed server-side; no raw content sent to embedding API if user opts out
- Web clipper only captures what the user explicitly triggers (no passive tracking)
- Delete note → cascades to embeddings, tags, links

---

## 13. Dependencies

| Dependency | Purpose | Already in project |
|---|---|---|
| `@anthropic-ai/sdk` | Embeddings (if using Claude) | Yes |
| `openai` | `text-embedding-3-small` | No — add if using OpenAI embeddings |
| `@uiw/react-md-editor` or `@tiptap/react` | Markdown editor | No |
| `pgvector` (Neon extension) | Vector similarity search | No — enable on Neon dashboard |
| `d3-force` or `react-force-graph` | Graph view (Phase F only) | No |

**Recommended markdown editor**: `@tiptap/react` (extensible, supports custom nodes for `[[links]]`, headings, code blocks, checkboxes). Alternatively `@uiw/react-md-editor` for simpler markdown-only use case.

---

## 14. Open Questions for Review

1. **Embedding model**: use OpenAI `text-embedding-3-small` (cheapest + best quality) or a free local model via Ollama? OpenAI costs ~$0.02/M tokens; for a personal app this is negligible.

2. **pgvector vs manual**: enable `pgvector` on Neon (one click) for proper ANN index, or compute cosine similarity in JavaScript for MVP simplicity? pgvector is recommended for >10k embeddings.

3. **Markdown editor**: Tiptap (rich, extensible, supports slash commands) or a simpler raw markdown editor? Tiptap requires more setup but gives a Notion-like experience.

4. **Daily log**: auto-append all mentions to today's note, or let the user pull them manually? Auto-append is more powerful but may be noisy.

5. **Bookmarklet vs extension**: bookmarklet is zero-install (good for MVP) but limited UI. A Chrome extension allows selecting space + tags before saving. Bookmarklet first, extension later?

6. **Tags scope**: should tags be shared across team members in a Project, or strictly personal? Current design is personal only.

---

## 15. Non-Goals (for now)

- ❌ PDF/file upload (parsing pipeline is complex; use web clip instead)
- ❌ Spaced repetition / Anki-style review (separate product concern)
- ❌ Collaborative notes (team editing) — personal first
- ❌ Native mobile app — web-first, consider PWA
- ❌ Import from Notion/Obsidian — not needed for MVP adoption
- ❌ Real-time sync across devices — Next.js SSR + auto-save is sufficient

---

*Created: 2026-06-10 | Status: Draft — awaiting review before implementation*
