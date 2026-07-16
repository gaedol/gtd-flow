import { App, Modal, Setting } from "obsidian";

// one-field prompt for a closure reason; Enter confirms (empty = none), Esc skips
export class ReasonModal extends Modal {
  private reason = "";
  private submitted = false;

  constructor(app: App, private onDone: (reason: string | undefined) => void) {
    super(app);
  }

  onOpen() {
    this.setTitle("Why is this being dropped?");
    new Setting(this.contentEl).setName("Reason").addText((t) => {
      t.setPlaceholder("superseded / no longer relevant / …").onChange((v) => (this.reason = v));
      t.inputEl.addClass("gtd-capture-text");
      t.inputEl.focus();
      t.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.submitted = true;
          this.close();
        }
      });
    });
    new Setting(this.contentEl)
      .addButton((b) =>
        b.setButtonText("Drop task").setCta().onClick(() => {
          this.submitted = true;
          this.close();
        })
      )
      .addButton((b) => b.setButtonText("Skip reason").onClick(() => {
        this.reason = "";
        this.submitted = true;
        this.close();
      }));
  }

  onClose() {
    this.contentEl.empty();
    // Esc (not submitted) still drops, just without a reason
    this.onDone(this.submitted && this.reason.trim() ? this.reason.trim() : undefined);
  }
}
