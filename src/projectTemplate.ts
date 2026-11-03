import { projectBody } from "./inboxProcess";

export const DEFAULT_PROJECT_TEMPLATE = [
  "---",
  "type: project",
  "status: active",
  "flow: parallel",
  "review-interval: {{reviewInterval}}",
  "last-reviewed: ",
  "---",
  "{{tasks}}",
].join("\n");

export function renderProjectTemplate(template: string, block: string[], reviewInterval: string): string {
  const source = template.trim() ? template : DEFAULT_PROJECT_TEMPLATE;
  const tasks = projectBody(block);
  const content = source.replace(/\{\{(reviewInterval|tasks)\}\}/g, (_, key: string) =>
    key === "tasks" ? tasks : reviewInterval
  );
  if (source.includes("{{tasks}}")) return content;
  return content + (content.endsWith("\n") ? "" : "\n") + tasks;
}
