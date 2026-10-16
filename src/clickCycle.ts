export type ClickAction = "complete" | "in-progress" | "reopen" | "none";

// What a checkbox click should do, given the task's current status char and
// whether click-to-cycle is enabled. Pure so it can be unit-tested.
//   direct mode: [ ]/[/] → complete
//   cycle mode:  [ ] → in-progress; [/] → complete
//   either:      done/dropped → reopen, clearing the ✅/❌ date (a plain toggle
//                would leave it behind on an open task)
export function checkboxClickAction(stateChar: string, clickCycles: boolean): ClickAction {
  if (stateChar === "x" || stateChar === "X" || stateChar === "-") return "reopen";
  if (stateChar === "/") return "complete";
  // todo (" ") or any other open marker
  return clickCycles ? "in-progress" : "complete";
}
