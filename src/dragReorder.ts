// pointer-based drag reordering (mouse + touch). Each direct-child row of
// `container` must have class "gtd-task", a "gtd-grip" handle child, and a
// data-gtd-key. onDrop is called with the new key order when a drag finishes.
// Move/up are bound to `document` during the drag so tracking keeps working even
// when the pointer leaves the handle.
export function makeReorderable(container: HTMLElement, onDrop: (keys: string[]) => void): void {
  const rows = () => Array.from(container.querySelectorAll<HTMLElement>(":scope > .gtd-task"));

  container.querySelectorAll<HTMLElement>(":scope > .gtd-task > .gtd-grip").forEach((handle) => {
    const row = handle.parentElement as HTMLElement;

    handle.addEventListener("pointerdown", (e: PointerEvent) => {
      e.preventDefault();
      row.addClass("gtd-dragging");

      const onMove = (ev: PointerEvent) => {
        const y = ev.clientY;
        for (const sib of rows()) {
          if (sib === row) continue;
          const r = sib.getBoundingClientRect();
          if (y >= r.top && y <= r.bottom) {
            container.insertBefore(row, y < r.top + r.height / 2 ? sib : sib.nextElementSibling);
            break;
          }
        }
      };
      const onUp = () => {
        row.removeClass("gtd-dragging");
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        onDrop(rows().map((r) => r.dataset.gtdKey ?? ""));
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    });
  });
}
