import { addDays } from "./dateParse";

export interface StarterFile {
  path: string;
  content: string;
}

const projectFm = (flow: "sequential" | "parallel", review: string) =>
  ["---", "type: project", "status: active", `flow: ${flow}`, `review-interval: ${review}`, "last-reviewed: ", "---", ""].join("\n");

// a small example setup for a first run: an inbox to process and two projects
// that show order, defer, deadlines, waiting-for and someday at work
export function starterFiles(projectsFolder: string, inboxPath: string, today: string, review = "1w"): StarterFile[] {
  return [
    {
      path: inboxPath,
      content: [
        "- [ ] Call the dentist",
        "- [ ] Idea: learn to make fresh pasta",
        "- [ ] Wifi password for the cabin is on the back of the router",
        "",
      ].join("\n"),
    },
    {
      path: `${projectsFolder}/Example - Weekend trip.md`,
      content:
        projectFm("sequential", review) +
        [
          "An example project. It's sequential, so only the first open step is a next action; tick it and the next one appears. Delete this note whenever you like.",
          "",
          "- [ ] Pick a destination",
          `- [ ] Book the train 📅 ${addDays(today, 7)}`,
          "- [ ] Book a place to stay",
          "- [ ] Pack ⏱ 30m",
          "",
        ].join("\n"),
    },
    {
      path: `${projectsFolder}/Example - Home.md`,
      content:
        projectFm("parallel", review) +
        [
          "An example project. It's parallel, so every open task is available at once, except those deferred, waiting on someone or parked as someday.",
          "",
          "- [ ] Fix the dripping tap #home ⏱ 20m",
          `- [ ] Renew the home insurance #flag 📅 ${addDays(today, 3)}`,
          `- [ ] Quote for new windows #wait/builder 🛫 ${addDays(today, 5)} ➕ ${today}`,
          `- [ ] Clean the gutters 🛫 ${addDays(today, 10)}`,
          "- [ ] Clear out the garage #someday",
          "",
        ].join("\n"),
    },
  ];
}
