# Changelog

What changed in each release of GTD Flow. Newest first.

## 0.9.8 — 2026-10-20

### Added
- Clicking the *Inbox* heading in Next actions opens the inbox note. (Thanks @peteringram0.)

### Fixed
- Archiving done tasks left their indented notes and sub-bullets behind, and could archive a done task while an open child below a note stayed put. (Thanks @peteringram0.)
- **Move task up/down** left a task's indented notes behind, and couldn't move a task down past a sibling with notes.

### Changed
- The settings tab no longer calls a method Obsidian deprecated in 1.13; nothing changes on screen.

## 0.9.7 — 2026-10-17

### Added
- **Task dependencies**, using the Tasks plugin's own markers: `🆔 name` names a task, `⛔ name` makes another wait on it — across projects, with several blockers separated by commas. A waiting task is unavailable everywhere until every blocker is done or dropped, and shows *⛔ waiting on …*. The suggester inserts fresh ids and completes them by id or task text.
- **Deadline warnings**: tasks due today or within a configurable window (default 3 days) get amber badges, a *Deadline approaching* section in Next actions, and an `N due soon` count in the status bar.
- **Areas in project names**: projects in subfolders of the projects folder show as `Work/Q4 Planning` in every view.

### Fixed
- Saving a task in the Edit task modal dropped its `^block-id`, losing its drag-reordered position.
- Forecast could show a repeating task's next occurrence on a date in the past.
- Un-ticking a completed task in a note left its `✅` date behind, so done queries counted it as finished. Un-ticking now clears the date, and done queries and staleness only count closed tasks.
- Completing a task that still carried an old `✅` added a second one.
- Completing, dropping or tagging a drag-reordered task broke its `^block-id`.
- A repeating task's next occurrence copied its `^block-id` and `🆔`.
- Two projects with the same name in different folders were merged into one group in perspectives and done queries.
- `🆔` and `⛔` markers showed up as part of the task text.

## 0.9.6 — 2026-10-06

### Changed
- Removed unused code flagged by the plugin review; the build now fails on unused code.

## 0.9.5 — 2026-10-06

### Added
- Perspectives: **someday** is now three-way — *exclude*, *include* (normal results plus parked work), *only*.
- Perspectives: a **folder** filter.
- The documentation is now `MANUAL.md`, reorganised around a *How do I…?* table and a full settings reference.

### Fixed
- *Available only* was silently ignored when *someday* or *done* was on.
- On-hold projects appeared in perspectives, unlike every other view.
- On a *done* perspective, *due within N days* filtered by due date instead of completion date.
- Grouping by tag listed `#home/plumbing` and `#home/garden` separately; they now roll up into `#home`.
- Two perspectives could share a name, making one unreachable.

## 0.9.4 — 2026-10-04

### Added
- **Move up / Move down** buttons to reorder perspectives.
- **Archive all done projects** moves every completed or dropped project to the archive folder.
- Archiving a project that still has open tasks warns first, and offers to drop them with a reason.

### Fixed
- **Archive current project** was hidden from the command palette unless a project note was open.

## 0.9.3 — 2026-08-24

### Added
- **Stalled and stale projects**: a *Stalled* section in Next actions and reasons on Review cards, plus **Update stalled project markers**, which tags affected projects `#stalled` in their frontmatter (optionally automatic).
- **Move task up / down** commands that move a task with its subtasks, for reordering next actions from the note.

## 0.9.2 — 2026-07-25

### Fixed
- The task context menu could act on the line where the cursor was rather than the line you right-clicked.

### Changed
- Reworded the plugin listing description.

## 0.9.1 — 2026-07-24

### Changed
- Internal restructuring; no change in behaviour.

## 0.9.0 — 2026-07-24

### Added
- **`#important`**: a star in every view and an *Important* perspective.
- Inbox tasks with a due date now appear in the Forecast, perspectives, the overdue badge and notifications.

## 0.8.2 — 2026-07-22

### Fixed
- Ticking a checkbox in Live Preview fell back to Obsidian's plain toggle, without the `✅` date or the next `🔁` occurrence.
- After a complete `🔁` rule, the suggester no longer offered other fields.

## 0.8.1 — 2026-07-20

### Added
- **Done queries**: a live `gtd-done` block listing what was closed in a period, and **Export done report** for a static note.

## 0.8.0 — 2026-07-19

### Added
- A context menu on task lines: edit, complete, drop, mark important or someday.
- Ticking a checkbox in a note completes the task through GTD Flow (`✅` date and next `🔁` occurrence).
- Optional click-to-cycle: to-do → in-progress → done.
- Forecast previews a repeating task's next occurrence.

## 0.7.0 — 2026-07-18

### Added
- **Sort projects in Next Actions**: alphabetical, by folder, or manual drag.

## 0.6.7 — 2026-07-18

### Changed
- Settings are findable through Obsidian's settings search (1.13+).

## 0.6.6 — 2026-07-18

### Changed
- Styling changes requested by the plugin review.

## 0.6.1 – 0.6.5 — 2026-07-16 to 2026-07-18

### Changed
- Signed build provenance for release files. No functional changes.

## 0.6.0 — 2026-07-16

### Added
- Project names render as pills in your *Color Folders and Files* explorer colours.

## 0.5.0 — 2026-07-16

### Added
- **`💬` closure reasons** for completed or dropped tasks.

## 0.4.4 — 2026-07-02

### Changed
- The Day timeline ranks urgency like the list views (flags count); saved orders for past days are cleaned up.

## 0.4.1 – 0.4.3 — 2026-06-29 to 2026-07-02

### Fixed
- Drag-to-reorder tracking, pop-out window support, and a corrupted saved-order key.

## 0.4.0 — 2026-06-29

### Added
- **Drag-to-reorder** in Forecast and Perspectives, defaulting to overdue → flagged → the rest.

## 0.3.1 — 2026-06-18

### Fixed
- Issues flagged by the plugin review.

## 0.3.0 — 2026-06-17

### Added
- **`⏰` time of day** for timed placement in the Day timeline.
- A **Done** perspective.

### Changed
- Forecast and Timeline show blocked tasks dimmed instead of hiding them.

## 0.2.0 — 2026-06-15

### Added
- Task statuses **in progress** `[/]` and **dropped** `[-]`.
- **Someday/maybe** for projects (`status: someday`) and single tasks (`#someday`), with a *Someday* perspective.
- Hierarchical contexts (`#home/plumbing`).
- An opt-in **project status block**.

## 0.1.0 – 0.1.2 — 2026-06-15

First release: sequential and parallel projects with action groups, defer and due dates, Next actions, Forecast, Timeline, Review and Perspectives views, quick capture and the `obsidian://gtd-capture` URI, repeat-on-complete, durations, natural-language dates in the suggester, due-task notifications, clickable wikilinks, per-project page styling, and file-explorer integration.
