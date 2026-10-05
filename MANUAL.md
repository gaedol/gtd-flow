# GTD Flow — manual

GTD for Obsidian: projects with real next-action logic, defer dates, forecast and review. Your Markdown is the source of truth — the plugin only indexes and edits your own notes, and everything stays readable with it disabled.

- [Quick start](#quick-start)
- [How do I…?](#how-do-i) — task-oriented index of every feature
- [Concepts](#concepts) · [Writing tasks](#writing-tasks) · [The views](#the-views)
- [Capture and triage](#capture-and-triage) · [Keeping it tidy](#keeping-it-tidy) · [Reporting](#reporting)
- [Settings reference](#settings-reference) · [With the Tasks plugin](#with-the-tasks-plugin) · [Appearance](#appearance)
- [Under the hood](#under-the-hood) · [Development](#development)

## Quick start

1. Install **GTD Flow** from *Settings → Community plugins*, and enable it.
2. Open its settings and check **Projects folder** (default `GTD/Projects`) and **Inbox note** (default `GTD/Inbox.md`). Everything else has a sane default.
3. Run **New project**, or right-click your projects folder → **New GTD project**.
4. Add task lines: `- [ ] Measure the space 📅 2026-06-16`. Typing at the end of a task line opens a suggester for dates, repeats and durations.
5. Open **Next actions** from the ribbon (list-checks icon) and start working.

## How do I…?

| I want to… | Do this |
|---|---|
| **Add a task without losing my place** | **Capture task** (ribbon `+`, or the command) — goes to the inbox or any project |
| Capture from outside Obsidian | The `obsidian://gtd-capture?vault=…&text=…` [URI](#capture-and-triage) |
| File an inbox item into a project | Folder icon on the inbox row in Next Actions, or **Move task under cursor to project** |
| **See what to work on** | **Next actions** view — the available task(s) of each active project |
| Work in a fixed order | Set `flow: sequential` on the project; only the first open task is available |
| Let several tasks run at once | `flow: parallel` (the default) |
| Group subtasks under one item | Indent them — see [action groups](#action-groups) |
| Mix orders in one project | Tag a parent line `#sequential` or `#parallel` |
| **Hide a task until later** | `🛫 2026-08-01` (defer). It reappears by itself |
| Give a task a deadline | `📅 2026-08-10` |
| Put a task at a clock time | `⏰ 14:30`, and `⏱ 45m` for how long — used by the Day timeline |
| Repeat a task | `🔁 every week` (or `every 2 weeks`, `every month when done`) |
| **See the next few days** | **Forecast** view |
| Reorder items within a day | Drag the grip handle in Forecast |
| Reorder tasks in Next Actions | Reorder the lines: **Move task up** / **Move task down** (take a hotkey) |
| Reorder projects in Next Actions | **Sort projects in Next Actions** → *Manual*, then drag project headers |
| Reorder the perspective list | **Move up / Move down** on each row in settings |
| **Mark something important** | `#important`, the context menu, or **Toggle important on task under cursor** → star + the Important perspective |
| Mark something urgent-ish | `#flag` → flag icon and a Flagged section in Next actions |
| Say "not now, maybe later" | `#someday` on the task, or `status: someday` on the project |
| Say "paused for now" | `status: on-hold` — out of every view until you reactivate |
| Record that a task is underway | `- [/]` (or enable [click-to-cycle](#completing-tasks)) |
| Abandon a task and say why | **Drop (cancel) task under cursor** → records `[-]`, `❌` date and a `💬` reason |
| **Complete a task** | Tick it anywhere: a view, or its checkbox in the note (writes `✅` and the next `🔁` occurrence) |
| Edit a task's fields | **Edit task under cursor**, the pencil icon, or right-click → **Edit task** |
| Build my own filtered list | A [perspective](#perspectives) in settings |
| Use contexts like `@home` | Nested tags: `#home/plumbing`. Tag filters match the whole subtree |
| **Review my projects** | **Review** view; set `review-interval: 1w` per project |
| Find projects that are stuck | The **Stalled** section in Next actions, or **Update stalled project markers** to tag them `#stalled` |
| See a project's state in the note | **Insert / update project status block** |
| **See what I finished** | A [`gtd-done` block](#reporting) in any note, or **Export done report** |
| Tidy finished tasks away | **Archive done tasks in this note** (or *in all projects*) |
| Put a finished project away | **Archive current project**, or **Archive all done projects** in bulk |
| **See it all on a timeline** | **Timeline** view (Day / Week / Month) |
| Know if something is overdue | The status-bar badge, and optional system notifications |

## Concepts

| Concept | In GTD Flow |
|---|---|
| Project | A note in the projects folder with `type: project` frontmatter |
| Sequential / parallel | `flow:` frontmatter, overridable per action group |
| Defer / due | `🛫` / `📅` on the task line (Tasks-plugin syntax) |
| Next action | The first *available* task of each active project |
| Context | A tag, nestable: `#home/plumbing` |
| Someday / on-hold | Parked work — `status:` on a project, `#someday` on a task |
| Review | `review-interval` + `last-reviewed` frontmatter, plus the Review view |

A task is **available** when its project is `active`, its defer date has arrived, and — in a sequential project — every earlier sibling is done. A parent with open children is a *container*, not an action.

### Project note format

```markdown
---
type: project          # required — marks the note as a project
status: active         # active | on-hold | someday | completed | dropped
flow: sequential       # sequential | parallel (default parallel)
review-interval: 1w    # optional: Nd / Nw / Nm / Ny
last-reviewed: 2026-06-10
---
- [ ] Measure space 📅 2026-06-16
- [ ] Get quotes 🛫 2026-06-20 #errand
- [x] Browse ideas ✅ 2026-06-01
```

Only `type: project` is required; the rest default sensibly. **New project** writes every key so Obsidian's Properties panel shows them all ready to fill.

## Writing tasks

Task lines use [Tasks plugin](https://publish.obsidian.md/tasks) syntax, so both plugins read the same files.

| Marker | Meaning | Notes |
|---|---|---|
| `🛫 2026-08-01` | Defer / start | Hidden from Next actions until then |
| `📅 2026-08-10` | Due | Drives Forecast, badges, notifications |
| `⏳ 2026-08-05` | Scheduled | Counts as the defer date when there's no `🛫` |
| `✅ 2026-08-02` | Completed on | Written for you when you tick a task |
| `❌ 2026-08-02` | Dropped on | Written by **Drop task** |
| `🔁 every 2 weeks` | Repeat | `day`/`week`/`month`/`year`, optional count, optional `when done` |
| `⏱ 1h30m` | Estimated duration | GTD Flow only; sizes Day-timeline bars |
| `⏰ 14:30` | Time of day | GTD Flow only; pins the task in the Day timeline |
| `💬 superseded` | Closure reason | Runs until the next marker or end of line |
| `#tag` | Context / flag / important / someday | See the settings for the special tag names |

`➕` created dates and priority emojis are recognised and ignored.

### Task statuses

`- [ ]` to do · `- [x]` done · `- [/]` **in progress** (still actionable, shown italic/yellow) · `- [-]` **dropped** (resolved but not completed; the sequence advances past it, shown struck through).

### Action groups

Indent to nest:

```markdown
- [ ] Plan party #parallel
  - [ ] Book venue
  - [ ] Send invites
- [ ] Buy supplies
```

- A parent with open children is a container; its children are the actions. The parent becomes available once they're done.
- Sibling order follows the project `flow`, unless the parent line carries `#sequential` or `#parallel`.
- Deferring a parent defers its whole subtree.
- **Move task up/down** moves a task *with* its children; "move task to project" moves single lines, so move children before their parent.

### Auto-suggest

On a task line in a project note or the inbox, type at the end of the line:

- A word start → `🛫 defer` / `📅 due` / `🔁 repeat` / `⏳ scheduled` / `⏱ duration` / `⏰ time` / `💬 reason`. Aliases work: defer = `start`/`hide`, due = `deadline`/`by`, repeat = `recur`/`every`, duration = `estimate`/`est`.
- After a date marker → `today`, `tomorrow`, weekday names, `end of week`, `next week`, `in 2 weeks`, `end of month`, `in a month` — or type `YYYY-MM-DD`. Stored as a plain ISO date.
- After `🔁` → recurrence presets; after `⏱`/`⏰` → duration and clock presets.

Picking a marker re-opens the menu in date mode, so *due → tomorrow* is two keystrokes. Once a `🔁` rule is complete, typing another word hands back to the field menu, so you can add `📅` after it.

### Completing tasks

Ticking a checkbox **in your note** (Live Preview or Reading view) goes through GTD Flow: it writes `✅` and inserts the next `🔁` occurrence, exactly like completing from a view — no Tasks plugin needed. Disable with **Handle checkbox clicks in notes**. With **Click cycles to-do → in-progress → done**, the first click sets `[/]` and the second completes.

Right-click a task line (long-press on mobile) for **Edit task**, **Complete task**, **Drop task…**, **Move task up/down**, **Mark important**, **Mark someday**.

### In-note availability

Project notes are decorated live in both Live Preview and Reading view: **next action** (accent border and tint), **available** (plain), **active group** (subtle border), **deferred** (dimmed italic), **blocked** (dimmed), **overdue** (red border). Decorations re-parse the buffer as you type and follow frontmatter changes — availability state a Tasks query can't show, right where you edit.

## The views

Each has a ribbon icon and an `Open …` command.

### Next actions

The available task(s) of every active project, grouped by project.

Sections run in this order, above the project list: **Inbox** (when non-empty, with a folder icon per row to file an item into a project), **Flagged** (flagged available tasks across all projects), then **Stalled** (projects that offer nothing to do, and why).
- Project sections follow **Sort projects in Next Actions**: *Alphabetical*, *By folder* (explorer-like path order), or *Manual* (drag the project headers; new projects slot into their default position).
- Tasks appear in note order — reorder with **Move task up/down**.
- Due badges turn orange today, red when overdue. Click a task to jump to its line.

### Forecast

Day by day over the **Forecast horizon**: due tasks (overdue ones surface under *Today*) and tasks becoming available on their defer date (play icon).

- Within a day: **overdue → flagged → the rest**, and you can drag the grip to any order. The arrangement is saved per day; moved tasks get an invisible `^id` so their place survives edits.
- To move a task to another day, change its due date.
- Fixed-schedule `🔁` tasks show a dimmed, non-actionable **next-occurrence hint** on the upcoming day, so you can see the rhythm ahead.

### Perspectives

Saved filtered lists, chosen from a dropdown and defined in settings. Built-ins: *Due soon*, *Flagged*, *Important*, *Someday*, *Done*.

Each perspective combines filters with a grouping (by project, tag, or due date):

- **available-only** filters the *actionable* results. Parked work you explicitly asked for is exempt, so the two settings compose instead of cancelling out.
- **someday** is three-way: **exclude** (default), **include** (normal results *plus* parked work), **only** (parked work alone — what the built-in *Someday* uses). Parked = a `#someday` task, or any open task in a `status: someday` project.
- **done** lists closed tasks (`[x]` and `[-]`) from projects in **any** status — finished work counts wherever the project ended up. With **done** on, *due within N days* means **closed** within N days.
- **tag** is hierarchy-aware (`home` matches `home/plumbing`). Tag *grouping* rolls up to the same roots, so `#home/plumbing` and `#home/garden` share one `#home` group; a task with genuinely different contexts still appears under each.
- **project** matches a substring of the project name; **folder** limits the perspective to projects under a folder.
- Only **active** projects contribute actionable results — `on-hold` is parked, as everywhere else.
- The **inbox** participates, so an unfiled task can't hide from a tag or due filter.

Names must be unique (the dropdown and saved orders key on them); a duplicate gets a numeric suffix. **Move up / Move down** on each row sets the dropdown order. Within a group, items sort overdue → flagged → rest and can be drag-reordered.

### Timeline

Mermaid Gantt charts with a Day / Week / Month switcher.

- **Week / month** — one bar per open task spanning defer → due (a single date gives a one-day bar), one section per project; overdue bars go red, available ones are highlighted.
- **Day** — only what belongs to today (overdue, due today, or deferred until today), stacked from **Day starts at**, each sized by its `⏱` duration or the **Default task duration**. A task with `⏰` is pinned at that clock position and the rest flow around it.
- Undated backlog tasks aren't shown — that's what Next actions is for.

### Review

Active projects whose `last-reviewed + review-interval` has passed (a project with an interval that's never been reviewed is always due). Each card shows open/available counts, the next action or the reason it's stalled, a **Properties** button, and **Mark reviewed**, which writes today's date into `last-reviewed`.

## Capture and triage

- **Capture task** — text (Enter submits), optional defer/due, and a target: the inbox or any active project. The inbox note is created on demand.
- **From outside Obsidian** — `obsidian://gtd-capture?vault=<name>&text=Buy+milk&due=2026-06-20&defer=2026-06-15` appends to the inbox; without `text` it opens the capture modal.
- **Triage** — the folder icon on an inbox row, or **Move task under cursor to project** for the line under the cursor (works project → project too). Captured and moved tasks land per **Insert captured/moved tasks at**, always above `## Archive`.
- Inbox tasks with a due date also appear in Forecast, perspectives, the badge and notifications — the inbox counts as an always-active project for dates, so a due-but-unfiled task can't hide.

Moves append to the target *before* deleting from the source, and verify the source line is unchanged first, so a race can at worst duplicate a task (with a notice) — never lose one.

## Keeping it tidy

### Archiving tasks

**Archive done tasks in this note** / **in all projects** moves fully-done root subtrees under a `## Archive` heading at the bottom of the same note, keeping `✅` dates. Groups move whole or not at all; done children inside still-open groups stay put. Only items closed at least *N* days ago move (**Archive tasks done for (days)**, default 7; `0` = everything; tasks with no date always qualify). Keep `## Archive` as the last section.

### Archiving projects

- **Archive current project** — sets `status: completed` (a dropped project stays `dropped`) and moves the note to the **Archive folder**, created on demand. That removes it from the index and all pickers.
- **Archive all done projects** — files away every project already `completed` or `dropped`, without touching statuses. Handy at the end of a review. A name collision gets a numeric suffix rather than overwriting.
- **Unfinished tasks are never buried silently.** Archiving a project with open tasks asks first, lists them, and offers to **drop them** (recorded as `[-]` with `❌` and `💬 project archived`, so they stay auditable in a done query) or to archive anyway. The bulk command doesn't prompt: it skips such projects and names them.

### Stalled and stale projects

A project is **stalled** when it's active but offers nothing you could do now, and **stale** when nothing in it has closed for a while — the things a weekly review is meant to catch, and otherwise invisible, since Next actions hides a project with no available task.

- The **Stalled** section in Next actions, and Review cards, give the reason: *no tasks yet*, *every task closed — finish or drop the project?*, *every task parked as someday*, *nothing starts until 2026-08-14*, or *open tasks are all blocked*.
- **Update stalled project markers** writes `#stalled` and a `stalled-reason:` line into the affected projects' frontmatter, and clears it from recovered ones — so stuck work shows up in search, Dataview, the graph and the explorer, not only here. Only notes that actually change are touched.
- **Staleness** counts from the most recent `✅`/`❌` date — real progress, not file edits. A project that has never closed anything counts from its creation date, so a new project isn't flagged on day one. Window: **Call a project stale after (days)** (default 30, `0` disables).
- **Keep stalled tags up to date automatically** re-marks as the vault changes. **Off by default**, because it writes to your notes.

Parked states are never marked: on-hold, someday, completed and dropped are deliberate choices, not stalls.

### Project status block

**Insert / update project status block** adds a self-maintaining summary to a project note:

```
%% gtd:status %%
**Next action:** Buy paint and supplies
**Progress:** ▓▓▓░░░░░░░ 4/9 · 3 available
**Review:** due (last reviewed 8d ago)
%% /gtd:status %%
```

Opt-in, and delimited by `%%` comments so the markers stay hidden in Reading view. Only the text between them is ever rewritten. An existing block refreshes when you open the note (and only if something changed). **Status block: include timeline** also embeds a per-project Gantt.

## Reporting

### Done queries

Put a `gtd-done` block in any note — a weekly-review note is the natural home — and it lists everything closed in a period, re-rendering as your vault changes:

````
```gtd-done
range: last-week
group: project
```
````

| Key | Values |
|---|---|
| `range` | `today`, `yesterday`, `this-week`, `last-week`, `this-month`, `last-month`, `last-7-days`, `last-30-days`, `this-year`, `last-year`, `all` (weeks start Monday; default `last-7-days`) |
| `from` / `to` | `YYYY-MM-DD`; either alone leaves that end open, and both override `range` |
| `project` | case-insensitive substring of the project name |
| `folder` | only projects under this folder, e.g. `Work` |
| `include` | `dropped`, `archived` (or `dropped: true` / `archived: true` on their own lines) |
| `group` | `project` (default), `day`, `none` |
| `limit` | maximum items |

**Insert done query block** drops a starter block at the cursor.

How items are matched:

- A task counts on its `✅` date, or its `❌` date when dropped — not when you edited the line. A closed task with no date never appears, so if something is missing, check the line carries one (ticking it anywhere in GTD Flow always writes it; a hand-typed `[x]` may not).
- The range includes both ends, and dates compare as plain ISO strings — no timezone surprises.
- Tasks count from projects in **any** status. `include: archived` additionally scans the archive folder, so projects you've archived still count — without it, a long-range total under-reports.
- Sub-tasks count individually. Dropped items appear struck through with their `💬` reason. Clicking a row opens the task's line.
- Unknown keys are ignored, so a typo silently *widens* the query — check spelling if you get more than you expect.

Useful shapes:

````
```gtd-done
range: last-30-days
project: Kitchen
group: day
```
````

````
```gtd-done
from: 2026-04-01
to: 2026-06-30
include: archived
group: project
```
````

````
```gtd-done
range: this-year
include: dropped
group: none
limit: 50
```
````

### Exported report

**Export done report** opens a modal (period, project filter, grouping, dropped/archived toggles) and writes a static note next to your inbox, e.g. `Done 2026-07-06 to 2026-07-12.md`. Plain checklist Markdown, readable with the plugin disabled — good for sharing "what I shipped" or freezing a record after a review.

## Settings reference

| Setting | Default | What it does |
|---|---|---|
| Projects folder | `GTD/Projects` | Where project notes live (indexed) |
| Inbox note | `GTD/Inbox.md` | Quick-capture target; created on demand |
| Flag tag | `flag` | Flag icon + Flagged section |
| Important tag | `important` | Star icon + Important perspective |
| Someday tag | `someday` | Parks a single task |
| Stalled tag | `stalled` | Written into frontmatter by the marker command |
| Call a project stale after (days) | `30` | No progress for this long = stale; `0` disables |
| Keep stalled tags up to date automatically | off | Re-mark on vault changes (writes to notes) |
| Forecast horizon (days) | `7` | How far Forecast looks ahead |
| Archive tasks done for (days) | `7` | Minimum age before a done task is archived; `0` = all |
| Archive folder | `GTD/Archive` | Where archived project notes go |
| Insert captured/moved tasks at | bottom | Top or bottom of the list, always above `## Archive` |
| Sort projects in Next Actions | Alphabetical | Alphabetical / By folder / Manual |
| Default review interval | `1w` | Pre-filled for new projects |
| Match file-explorer colors | on | Project pills from *Color Folders and Files* (only shown when installed) |
| Ask for a reason when dropping a task | on | Prompt for `💬` on **Drop task** |
| Handle checkbox clicks in notes | on | In-note ticking writes `✅` + `🔁` |
| Click cycles to-do → in-progress → done | off | First click sets `[/]` |
| Notify about due tasks | on | System notification for overdue / due today |
| Status block: include timeline | off | Embed a Gantt in the status block |
| Day starts at / Day ends at | `09:00` / `22:00` | Day-timeline window |
| Default task duration (minutes) | `30` | Used when a task has no `⏱` |
| Perspectives | 5 built-ins | The perspective editor |

On Obsidian 1.13+ all of these are findable through the built-in settings search.

An **overdue badge** in the status bar shows "N overdue" whenever an active project (or the inbox) has an open task past its due date; click it to open the Forecast. With **Notify about due tasks** on, a system notification announces overdue / due-today items at startup and every 30 minutes — once per item per day, so it nudges rather than nags, and only while Obsidian is running.

## With the Tasks plugin

Tasks is **optional** — nothing in GTD Flow depends on it. Running both gets you Tasks' in-note rendering, its edit modal and `tasks` query blocks alongside GTD Flow's views.

- **Recurrence** works from either side: complete in the note or in a GTD Flow view and the next occurrence appears. Don't worry about which.
- **Tasks' global filter** (e.g. only `#task` lines count) is ignored by GTD Flow — every checklist line in a project note is a task here. Either don't set one, or accept that the two see different task sets.
- **Availability** (sequential order, defer, parking) is a GTD Flow concept; Tasks queries will happily list tasks GTD Flow considers blocked.

## Appearance

- **Explorer-matched colors** — with *Color Folders and Files* installed, project names render as pills using your explorer colors (exact file styles win, then folder styles per their apply-to rules). Toggle with **Match file-explorer colors**.
- **Project page styling** — `color:` in frontmatter tints the note's background (14% mix with the theme); `banner:` sets a cover image (vault path or URL). Both are plain frontmatter, so they sync and can be hand-edited. For anything fancier, Obsidian's own `cssclasses:` composes freely with this.
- `[[wikilinks]]` in task text render as clickable links in the views (alias shown when present). Clicking the link opens the linked note; clicking elsewhere opens the task's own note at its line.

## Under the hood

Markdown is the source of truth. A pure, Obsidian-free core does the thinking; views and modals are thin wrappers over it, which is why the behaviour is testable without a vault.

```
src/
  types.ts           the shared Task / Project shapes
  parser.ts          pure: markdown line / frontmatter → Task, Project
  engine.ts          pure: availability, next action, forecast, review-due, intervals
  selectors.ts       pure: which containers each surface sees (with or without the inbox)
  taskWrite.ts       pure: the one place task-line surgery lives
  moveTaskLine.ts    pure: move a task + its subtree past a sibling, within its group
  serialize.ts       pure: task fields → line; duration parsing/formatting
  ordering.ts        pure: default sort (overdue→flagged→rest) + manual-order merge
  perspectives.ts    pure: perspective filters + grouping
  repeat.ts          pure: 🔁 rule parsing + next-occurrence line
  repeatSuggest.ts   pure: hand off from 🔁 presets to field mode once a rule is complete
  clickCycle.ts      pure: what a checkbox click does
  stalled.ts         pure: why a project is stalled, and time since real progress
  doneQuery.ts       pure: gtd-done parsing, date presets, filtering, markdown output
  archive.ts         pure: move aged done subtrees under a ## Archive heading
  insertLine.ts      pure: position-aware task insertion (archive-safe)
  gantt.ts           pure: projects → mermaid gantt source (day/week/month)
  statusBlock.ts     pure: %% gtd:status %% summary text + upsert
  dateParse.ts       pure: natural-language date choices for the suggester
  inNote.ts          pure: doc lines → per-line availability CSS classes
  projectColors.ts   pure: resolve Color-Folders-and-Files styles into project pills
  settingsData.ts    pure: the settings shape and their defaults
  taskIndex.ts       in-memory index of project notes + the inbox (held as a synthesized
                     project), refreshed on vault events; exposes snapshot()
  completeTask.ts    task-line writes to disk via vault.process, with a stale-line guard
  moveTask.ts        move a task between notes + fuzzy project picker
  blockId.ts         assigns ^block-ids used as stable identity for manual order
  nextActionsView.ts · forecastView.ts · perspectiveView.ts · reviewView.ts · timelineView.ts
  taskRow.ts         shared row pieces: open-at-line, flag/important markers, due badge
  captureModal.ts · editTaskModal.ts · newProjectModal.ts · projectPropertiesModal.ts
  reasonModal.ts     one-field 💬 prompt used by the drop command
  archiveProjectModal.ts warns about unfinished tasks before archiving a project
  doneBlock.ts       gtd-done code-block render child (live, re-renders on index change)
  doneReportModal.ts period/filter modal writing a static done-report note
  taskSuggest.ts     EditorSuggest popup: field markers, dates, presets
  editorDecorations.ts CM6 line decorations for Live Preview
  checkboxClicks.ts  CM6 capture-phase handler routing in-note checkbox clicks
  contextClick.ts    records the right-clicked line for the task menu
  dragReorder.ts     pointer-based drag handles for Forecast/Perspectives rows
  linkText.ts        renders [[wikilinks]] in task text as clickable links
  commands.ts · menus.ts · integrations.ts   registration, kept out of main
  settings.ts        settings tab (declarative getSettingDefinitions + display fallback)
  dates.ts           local-timezone today
  main.ts            thin wiring: settings, index lifecycle, views + shared helpers
```

Every module marked *pure* has no Obsidian imports and is unit-tested — **262 tests across 26 files** (`npm test`). Beyond per-module tests the suite covers a parse → serialize round-trip (lossless and idempotent for every task shape), the write paths, archive/insert edges, action-group semantics, and an integration fixture: a small vault run end to end through selectors, next actions, forecast, every built-in perspective, done queries and stalled detection. Dates are compared as ISO strings throughout.

## Development

```bash
npm install
npm run dev      # esbuild watch → main.js
npm test         # vitest
npm run build    # type-check + production bundle
npm run deploy   # build + copy into a vault (set OBSIDIAN_VAULT)
```

Obsidian doesn't auto-reload plugins: use the community **Hot Reload** plugin, or Cmd+R after a rebuild. Inspect the live index in the dev console with `app.plugins.plugins["gtd-flow"].index.snapshot()`.

**Don't symlink** the plugin into a cloud-synced vault (iCloud, Synology Drive, Dropbox) — file-provider folders break symlinks and the plugin silently disappears. `npm run deploy` copies instead.
