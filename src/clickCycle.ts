export type ClickAction = "complete" | "in-progress" | "none";

// What a checkbox click should do, given the task's current status char and
// whether click-to-cycle is enabled. Pure so it can be unit-tested.
//   direct mode: [ ]/[/] → complete; done/dropped → nothing
//   cycle mode:  [ ] → in-progress; [/] → complete; done/dropped → nothing
export function checkboxClickAction(stateChar: string, clickCycles: boolean): ClickAction {
  const done = stateChar === "x" || stateChar === "X" || stateChar === "-";
  if (done) return "none";
  if (stateChar === "/") return "complete";
  // todo (" ") or any other open marker
  return clickCycles ? "in-progress" : "complete";
}
