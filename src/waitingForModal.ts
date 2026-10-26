import { App, Modal, Setting } from "obsidian";
import { addDays, startOfNextWeek } from "./dateParse";
import { todayISO } from "./dates";

export interface WaitingChoice {
  who: string;
  followUp?: string;
}

// asks who a task waits on and when to chase; names already in use are suggested
export class WaitingForModal extends Modal {
  private who: string;
  private followUp: string;

  constructor(
    app: App,
    private people: string[],
    current: WaitingChoice,
    private onDone: (choice: WaitingChoice) => void
  ) {
    super(app);
    this.who = current.who;
    this.followUp = current.followUp ?? "";
  }

  onOpen() {
    const { contentEl } = this;
    this.setTitle("Waiting for…");
    const submit = () => {
      this.close();
      this.onDone({ who: this.who.trim(), followUp: this.followUp || undefined });
    };

    const listId = "gtd-waiting-people";
    const list = contentEl.createEl("datalist", { attr: { id: listId } });
    for (const p of this.people) list.createEl("option", { attr: { value: p } });
    new Setting(contentEl)
      .setName("Waiting on")
      .setDesc("Who has the next move. Leave empty if it's no one in particular.")
      .addText((t) => {
        t.setPlaceholder("Anna").setValue(this.who).onChange((v) => (this.who = v));
        t.inputEl.setAttr("list", listId);
        t.inputEl.focus();
        t.inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        });
      });

    let dateInput: HTMLInputElement;
    const today = todayISO();
    new Setting(contentEl)
      .setName("Follow up on (🛫)")
      .setDesc("When to chase if nothing has arrived. Optional.")
      .addText((t) => {
        t.inputEl.type = "date";
        t.setValue(this.followUp).onChange((v) => (this.followUp = v));
        dateInput = t.inputEl;
      });
    const quick = new Setting(contentEl);
    for (const [label, date] of [
      ["In 3 days", addDays(today, 3)],
      ["Next week", startOfNextWeek(today)],
      ["In 2 weeks", addDays(today, 14)],
    ] as const) {
      quick.addButton((b) =>
        b.setButtonText(label).onClick(() => {
          this.followUp = date;
          dateInput.value = date;
        })
      );
    }

    new Setting(contentEl).addButton((b) => b.setButtonText("Mark waiting").setCta().onClick(submit));
  }

  onClose() {
    this.contentEl.empty();
  }
}
