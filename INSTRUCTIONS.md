# GTD Flow

Structured GTD for Obsidian: sequential/parallel projects, defer dates, next-action availability, inbox triage. Markdown stays the source of truth — the plugin only indexes and edits your notes.

## Concepts

| Concept | GTD Flow |
|---|---|
| Project | One note in the projects folder with `type: project` frontmatter |
| Sequential / parallel | `flow:` frontmatter key |
| Defer date | 🛫 start date (Tasks-plugin syntax) |
| Due date | 📅 |
| Repeat | 🔁 (parsing only; auto-recurrence not implemented yet) |
| Inbox | A single inbox note collecting quick captures |
| Next action | First *available* task of each active project |
| Review | `review-interval` / `last-reviewed` frontmatter + Review view |

A task is **available** when its project is `active`, its defer date (if any) has arrived, and — in sequential projects — every earlier task is done.

## Setup

1. Build (`npm install && npm run build`) and link/copy the folder into `<vault>/.obsidian/plugins/gtd-flow/` (needs `manifest.json`, `main.js`, `styles.css`).
2. Enable **GTD Flow** in Settings → Community plugins.
3. In the plugin settings, set:
   - **Projects folder** (default `GTD/Projects`)
   - **Inbox note** (default `GTD/Inbox.md`)
   - **Forecast horizon** in days (default 7)
   - **Flag tag** (default `flag`)
   - **Archive tasks done for (days)** (default 7) and **Archive folder** (default `GTD/Archive`)

## Project note format

```markdown
---
type: project          # required — marks the note as a project
status: active         # active | on-hold | someday | completed | dropped (default active)
flow: sequential       # sequential | parallel (default parallel)
review-interval: 1w    # optional: Nd / Nw / Nm / Ny
last-reviewed: 2026-06-10
---
- [ ] Measure space 📅 2026-06-16
- [ ] Get quotes 🛫 2026-06-20 #errand
- [x] Browse ideas ✅ 2026-06-01
```

Task lines use [Tasks plugin](https://publish.obsidian.md/tasks) emoji syntax, so both plugins can read the same files: 🛫 defer/start, 📅 due, ✅ completion date, 🔁 repeat rule, `#tags`. GTD Flow adds ⏱ for estimated duration (`⏱ 30m`, `⏱ 2h`, `⏱ 1h30m`) and ⏰ for a time of day (`⏰ 14:30`) — its own markers, ignored by Tasks. A ⏳ scheduled date counts as the defer date when no 🛫 is present; ➕ created dates and priority emojis are recognized and ignored.

### Action groups (nesting)

Indent tasks to create action groups:

```markdown
- [ ] Plan party #parallel
  - [ ] Book venue
  - [ ] Send invites
- [ ] Buy supplies
```

- A parent with open children is a container, not an action — its children are the available tasks; the parent becomes available once all children are done.
- Sibling ordering follows the project `flow`; a `#sequential` or `#parallel` tag on the parent line overrides it for that group.
- Deferring a parent defers its whole subtree.
- Note: "move task to project" moves single lines — move children before their parent.

### Task statuses

Besides `- [ ]` (to do) and `- [x]` (done), GTD Flow recognizes:

- `- [/]` **in progress** — still available/actionable, highlighted yellow in the note.
- `- [-]` **dropped / cancelled** — resolved but not completed (records a `❌` date). Treated like done: removed from Next Actions and the sequence advances past it, struck through in the note, and archivable.

Change a task's status from the **Edit task** modal (Status dropdown), the **Drop (cancel) task under cursor** command, or just by editing the checkbox character. Completing a task from the views still records `✅` and handles 🔁 recurrence.

### Project status block

Run **Insert / update project status block** on a project note to add an auto-maintained summary at the top:

```
%% gtd:status %%
**Next action:** Buy paint and supplies
**Progress:** ▓▓▓░░░░░░░ 4/9 · 3 available
**Review:** due (last reviewed 8d ago)
%% /gtd:status %%
```

It's opt-in (nothing is written until you run the command) and delimited by `%%` comment markers, so the markers stay hidden in reading view and everything outside them is yours — the plugin only rewrites between the markers. An existing block refreshes automatically when you open the project note (and only writes if something changed). Enable **Status block: include timeline** in settings to also embed a per-project Mermaid gantt of the project's dated tasks inside the block.

### Someday / Maybe

Park things you're not committing to yet, at two levels:

- **Whole project** — set `status: someday` (properties modal or frontmatter). Excluded from Next Actions/Forecast/Timeline like on-hold.
- **Single task** — tag it `#someday` (tag configurable in settings; or use the **Toggle someday** command / the Someday toggle in the Edit modal). The task drops out of Next Actions and is *skipped without blocking* its sequence — the next action becomes available instead. Shown dimmed/italic in the note.

Either way, the built-in **Someday** perspective gathers them all — open tasks in someday projects plus every `#someday`-tagged task — so you can review and promote them when ready.

### Contexts (hierarchical tags)

Tags are your contexts, and they nest with `/`: `#home/plumbing`, `#office/sales`. A tag filter in a perspective is hierarchy-aware — filtering on `home` matches `home`, `home/plumbing`, and `home/garden`; filtering on `home/plumbing` matches only that. Grouping a perspective "by tag" lists each full context as its own group.

### Flags

Tag a task with `#flag` (configurable in settings) to flag it: it gets an orange flag icon in all views and appears in a **Flagged** section at the top of Next Actions (flagged *and available* tasks across projects). The flag tag is hidden from the tag list in rows.

## Task auto-suggest

On task lines in project notes and the inbox, typing at the end of the line opens an inline menu (Tasks-style):

- type a word start → insert **🛫 defer / 📅 due / 🔁 repeat / ⏳ scheduled / ⏱ duration**. Each accepts aliases: defer = `start`/`hide`/`available`, due = `deadline`/`by`, repeat = `recur`/`every`, scheduled = `plan`/`planned`, duration = `time`/`estimate`/`est`
- after 🛫/📅/⏳ → date choices with the resolved date shown: `today`, `tomorrow`, weekday names (`Thursday`, `Monday`, …, next occurrence), `end of week` (Sunday), `next week` (Monday), `in 2 weeks`, `end of month`, `in a month`; type to filter (e.g. "thu"), or just type `YYYY-MM-DD`. The stored value is always a plain ISO date.
- after 🔁 → recurrence presets (every day/week/2 weeks/month/3 months/year)
- after ⏱ → duration presets (15m … 4h); after ⏰ → time-of-day presets. In the Day timeline, tasks with a ⏰ time are pinned at that clock position and untimed tasks flow around them.

Picking a field marker immediately re-opens the menu in date mode, so `due → tomorrow` is two selections.

In the Next Actions, Forecast, and Perspectives views, `[[wikilinks]]` in task text render as clickable internal links (alias shown when present). Clicking a link opens the linked note; clicking elsewhere on the task still opens the task's own note at its line.

## In-note availability

In project notes, GTD Flow decorates task lines in both Live Preview and reading mode:

- **Next action** — accent left border and tint
- **Available** — normal
- **Active group** (container with available children) — subtle left border
- **Deferred** (🛫/⏳ in the future) — dimmed, italic
- **Blocked** (sequential order, or project not active) — dimmed
- **Overdue** — red left border

Decorations follow your edits live (they re-parse the buffer, not the saved file) and update when frontmatter like `status:` or `flow:` changes. This is availability state Tasks queries can't show — visible exactly where you edit.

## Archiving

- **Archive done tasks in this note / in all projects** — moves fully-done root subtrees (groups move whole, never partially) under a `## Archive` heading at the bottom of the same note, preserving ✅ dates. Only items completed at least *N* days ago move (**Archive tasks done for (days)** setting, default 7; 0 = everything; tasks without a ✅ date always qualify). Done children inside still-open groups stay put. Keep `## Archive` as the last section of the note.
- **Archive current project (complete + move)** — sets `status: completed` (dropped projects keep `dropped`) and moves the note to the **Archive folder** (default `GTD/Archive`), which removes it from the index and all pickers.

## Using with the Tasks plugin

The Tasks plugin is **optional**. GTD Flow works standalone; nothing in it depends on Tasks.

**Recommended: run both** if you want, in addition to GTD Flow's views:
- pretty in-note rendering and a date-picker edit modal for task lines
- `tasks` query blocks
- 🔁 recurrence: Tasks creates the next occurrence when you complete a repeating task **in the editor**

**Caveats when both are loaded:**
- Repeating (🔁) tasks recur whichever side completes them — complete them in the note (Tasks handles it) or in GTD Flow's views (GTD Flow inserts the next occurrence). Don't worry about which.
- If you use Tasks' **global filter** (e.g. only `#task` lines count), GTD Flow ignores it: every checklist line in a project note is a task to GTD Flow. Either don't set a global filter, or accept that the two plugins see different task sets.
- Sequential/parallel availability is GTD Flow's concept only — Tasks queries will happily show tasks GTD Flow considers blocked or deferred.

## Usage

- **Ribbon icon (list-checks)** or command **Open next actions** — sidebar view of available tasks grouped by project. Checking a box writes `[x]` + ✅ date into the note; in sequential projects the next task appears automatically. Click a task to jump to its line; due badges turn orange (today) or red (overdue).
- **Ribbon icon (plus-circle)** or command **Capture task** — modal with task text (Enter submits), optional defer/due dates, and a target dropdown (Inbox or any active project). Appends the formatted task line without leaving your current note; the inbox note is created on demand.
- **Inbox section** (top of the sidebar when non-empty) — folder icon on each task opens a project picker and moves the task line, metadata intact, to the end of the chosen project note.
- **Move task under cursor to project** — same picker for the task line under the cursor in any note; also works project → project. Captured/moved tasks land at the top or bottom of the list per the **Insert captured/moved tasks at** setting, always above `## Archive`.
- **Edit task** — pencil icon on rows in Next Actions (incl. inbox), or command **Edit task under cursor**: modal for text, defer/due dates, ⏱ duration, 🔁 rule, and flag. Rewrites the line in place, preserving indent, other tags, and completion state.
- **New project** — command opening a name + flow modal; creates the note with the complete frontmatter (every key present, `last-reviewed` empty), so Obsidian's Properties panel shows all fields ready to fill, and opens it.
- **Right-click the projects folder** in the file explorer → **New GTD project** (same modal). Right-click any non-project note → **Convert to GTD project**: adds the full frontmatter (keeping existing keys) and moves the note into the projects folder. Also available as the command **Convert current note to project**.
- **Edit project properties** — command on a project note (also a "Properties" button on Review cards): modal with status and flow dropdowns, review-interval, a last-reviewed date picker, a **page color** picker, and a **banner image** (vault path or URL).

### Project page styling

`color:` tints the project page background (14% mix with the theme background); `banner:` sets a cover background image. Both live in frontmatter, so they sync like everything else and can be edited by hand. For anything fancier, Obsidian's native `cssclasses:` frontmatter key applies your own CSS snippet classes to the note — it composes freely with GTD Flow's styling.
- **Toggle project on hold / active** — command on the current project note; on-hold projects vanish from Next Actions/Forecast/Timeline until reactivated.
- **Ribbon icon (calendar-clock)** or command **Open forecast** — day-by-day view over the configured horizon: due tasks (checkbox, red when overdue and surfaced under Today) and deferred tasks becoming available (play icon).
- **Ribbon icon (telescope)** or command **Open perspectives** — saved filtered views. Each perspective combines filters (available-only, flagged, tag, project-name substring, due within N days) with a grouping (by project, tag, or due date); a dropdown switches between them. Define perspectives in settings (each has a "someday" toggle to draw from someday projects, and the tag filter is hierarchy-aware); each also has a "someday" toggle and a "done" toggle (list completed/dropped tasks instead of open ones). Defaults are "Due soon", "Flagged", "Someday", and "Done".
- **Completing a 🔁 repeating task from any GTD Flow view** inserts the next occurrence above the completed line: all dates advance by the interval (`every day/week/month/year`, optional count: `every 2 weeks`); with `when done` the next due date is completion + interval and other dates keep their relative offsets. Recurrence requires at least one date on the task.
- **Capture from outside Obsidian** via URI: `obsidian://gtd-capture?vault=<name>&text=Buy+milk&due=2026-06-20&defer=2026-06-15` appends to the inbox; without `text` it opens the capture modal.
- **Ribbon icon (gantt-chart)** or command **Open timeline** — Mermaid Gantt charts with a Day/Week/Month switcher. Week/month: one bar per open task spanning defer → due (single date = 1-day bar; overdue bars surface red on today; available tasks highlighted), one section per project. Day: only the tasks that actually belong to today — overdue, due today, or deferred-until-today — stacked from **Day starts at** (default 09:00) in that order, each sized by its ⏱ duration (or the **Default task duration** setting, 30 min), with the project in parentheses. Available-but-undated backlog tasks are *not* shown (that's what Next Actions is for). All three charts always span their full window (day = **Day starts/ends at**, 09:00–22:00 by default), with ticks every 3 h / day / week respectively. Wikilinks in task text are shown as their display text and long labels are truncated.
- **Ribbon icon (eye)** or command **Open review** — queue of active projects whose `last-reviewed + review-interval` has passed (never-reviewed projects with an interval are always due). Each card shows open/available counts, the next action, a stalled warning when no tasks remain, and a **Mark reviewed** button that writes today's date into `last-reviewed`.

Moves append to the target before deleting from the source and verify the source line is unchanged before deleting, so a race can at worst duplicate a task (with a notice), never lose one.

## Architecture

```
src/
  parser.ts          pure: markdown line / frontmatter → Task, Project
  engine.ts          pure: availability, next action, forecast, review-due, intervals
  taskIndex.ts       in-memory index of project notes + inbox, refreshed on vault events
  completeTask.ts    checkbox → file write via vault.process, with stale-line guard
  moveTask.ts        move between notes + fuzzy project picker modal
  nextActionsView.ts sidebar ItemView (next actions + inbox), re-renders on index "changed" events
  forecastView.ts    sidebar ItemView, day-grouped due / becoming-available items
  reviewView.ts      sidebar ItemView, projects due for review + mark-reviewed
  perspectives.ts    pure: perspective filters + grouping
  perspectiveView.ts sidebar ItemView with perspective dropdown
  repeat.ts          pure: 🔁 rule parsing + next-occurrence line
  gantt.ts           pure: projects → mermaid gantt source (day/week/month)
  timelineView.ts    ItemView rendering the mermaid chart with mode switcher
  captureModal.ts    quick-capture modal (text, defer/due, target picker)
  taskSuggest.ts     EditorSuggest popup: field markers, dates, repeat presets
  archive.ts         pure: move aged done subtrees under a ## Archive heading
  insertLine.ts      pure: position-aware task insertion (archive-safe)
  serialize.ts       pure: task fields → line; duration parsing/formatting
  editTaskModal.ts   edit modal rewriting a task line in place
  newProjectModal.ts name+flow modal creating a project note
  projectPropertiesModal.ts status/flow/review editor writing frontmatter
  inNote.ts          pure: doc lines → per-line availability CSS classes
  editorDecorations.ts CM6 line decorations for Live Preview (reading mode via post-processor in main)
  settings.ts        settings tab
  dates.ts           local-timezone today
  main.ts            wiring: index lifecycle, view, ribbon, commands
```

`parser.ts` and `engine.ts` have no Obsidian imports and are unit-tested (`npm test`, vitest). Dates are compared as ISO strings throughout.

## Development

```bash
npm install
npm run dev      # esbuild watch → main.js
npm test         # vitest
npm run build    # type-check + production bundle
```

Obsidian doesn't auto-reload plugins; use the community **Hot Reload** plugin or Cmd+R after a rebuild. Inspect the live index in the dev console: `app.plugins.plugins["gtd-flow"].index.all()`.

`npm run deploy` builds and copies `main.js`, `manifest.json`, `styles.css` into the vault's plugin folder (override the vault with `OBSIDIAN_VAULT=/path/to/vault npm run deploy`). **Do not symlink** the plugin into a cloud-synced vault (iCloud, Synology Drive, Dropbox): file-provider folders break symlinks and the plugin silently disappears.

An **overdue badge** in the status bar shows "N overdue" in red whenever any active project has an open task past its due date; clicking it opens the Forecast.

With **Notify about due tasks** enabled (default on), a system notification announces overdue / due-today tasks on startup and every 30 minutes while Obsidian is open — once per item per day, so it nudges rather than nags. Clicking it opens the Forecast. (Obsidian must be running; this does not fire when the app is closed or on mobile in the background.)

## Roadmap

1. Mobile verification
