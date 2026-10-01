import { Project, Task } from "./types";

// What the index knows about one note, before notes are joined into projects:
// a project hub (type: project), a member pointing at a hub through its
// `project:` frontmatter, or a plain note whose tasks are an inbox.
export type NoteRecord =
  | { kind: "project"; project: Project } // the hub's own tasks only
  // fallbackInbox: whether the note's tasks count as inbox if the link doesn't reach a hub
  | { kind: "member"; name: string; link: string; explicit: boolean; fallbackInbox: boolean; tasks: Task[] }
  | { kind: "inbox"; name: string; tasks: Task[] };

// a member whose `project:` link doesn't lead to a project hub
export interface BrokenLink {
  path: string;
  name: string;
  link: string;
  reason: string;
}

export interface Assembled {
  projects: Map<string, Project>; // hubs (with members' tasks) and inbox notes
  hubOf: Map<string, string>; // member path -> hub path
  broken: BrokenLink[];
}

function inbox(path: string, name: string, tasks: Task[]): Project {
  return { path, name, kind: "inbox", status: "active", flow: "parallel", tasks };
}

// Join members onto their hubs. A project's tasks are the hub's, then each
// member's in note-name order, which is the order sequential flow follows.
// `resolve` maps a link to the path of the note it points at, or null.
// A member whose link is a real link but doesn't reach a hub is reported as
// broken; one with a plain-text value (often an unrelated `project:` field)
// is quietly treated as an ordinary note. Either way, where ordinary notes
// are inboxes (fallbackInbox), its tasks stay visible there rather than vanishing.
export function assemble(notes: Map<string, NoteRecord>, resolve: (link: string, from: string) => string | null): Assembled {
  const projects = new Map<string, Project>();
  const hubOf = new Map<string, string>();
  const broken: BrokenLink[] = [];
  const members = new Map<string, { path: string; name: string; tasks: Task[] }[]>();

  for (const [path, r] of notes) {
    if (r.kind !== "member") continue;
    const target = resolve(r.link, path);
    if (target && notes.get(target)?.kind === "project") {
      hubOf.set(path, target);
      const list = members.get(target) ?? [];
      list.push({ path, name: r.name, tasks: r.tasks });
      members.set(target, list);
      continue;
    }
    if (r.explicit) {
      const reason = target ? `links to "${r.link}", which isn't a project` : `links to "${r.link}", which doesn't exist`;
      broken.push({ path, name: r.name, link: r.link, reason });
    }
    if (r.fallbackInbox && r.tasks.length) projects.set(path, inbox(path, r.name, r.tasks));
  }

  for (const [path, r] of notes) {
    if (r.kind === "inbox") {
      projects.set(path, inbox(path, r.name, r.tasks));
    } else if (r.kind === "project") {
      const ms = (members.get(path) ?? []).sort((a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path));
      projects.set(path, {
        ...r.project,
        members: ms.map((m) => m.path),
        tasks: [...r.project.tasks, ...ms.flatMap((m) => m.tasks)],
      });
    }
  }
  broken.sort((a, b) => a.path.localeCompare(b.path));
  return { projects, hubOf, broken };
}
