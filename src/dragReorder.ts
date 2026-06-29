// pointer-based drag reordering (works for mouse and touch). Each direct-child
// row of `container` must have class "gtd-task", a "gtd-grip" handle child, and a
// data-gtd-key. onDrop is called with the new key order when a drag finishes.
export function makeReorderable(container: HTMLElement, onDrop: (keys: string[]) => void): void {
  let dragging: HTMLElement | null = null;
  const rows = () => Array.from(container.querySelectorAll<HTMLElement>(":scope > .gtd-task"));

  container.querySelectorAll<HTMLElement>(":scope > .gtd-task > .gtd-grip").forEach((handle) => {
    const row = handle.parentElement as HTMLElement;

    handle.addEventListener("pointerdown", (e: PointerEvent) => {
      e.preventDefault();
      dragging = row;
      row.addClass("gtd-dragging");
      handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener("pointermove", (e: PointerEvent) => {
      if (dragging !== row) return;
      const y = e.clientY;
      for (const sib of rows()) {
        if (sib === dragging) continue;
        const r = sib.getBoundingClientRect();
        if (y >= r.top && y <= r.bottom) {
          const before = y < r.top + r.height / 2;
          container.insertBefore(dragging, before ? sib : sib.nextElementSibling);
          break;
        }
      }
    });

    const end = (e: PointerEvent) => {
      if (dragging !== row) return;
      row.removeClass("gtd-dragging");
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch {
        /* capture may already be released */
      }
      dragging = null;
      onDrop(rows().map((r) => r.dataset.gtdKey ?? ""));
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  });
}
