/** Locate the actual attachment, not the centre of a potentially tall message.
 * Keep it anchored while preceding attachments are still loading. Stop on user
 * input, unmount, success, or the bounded deadline; never fight manual scrolling.
 */
export function anchorAttachment(
  list: HTMLElement,
  mailboxId: string,
  onFinish: (result: "visible" | "cancelled" | "timeout") => void,
): () => void {
  const escaped = mailboxId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  let stopped = false;
  let frame = 0;
  let stable = false;
  const resize = new ResizeObserver(() => schedule());
  const mutation = new MutationObserver(() => { observe(); schedule(); });
  const inputEvents = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
  const mediaEvents = ["load", "loadedmetadata", "error"] as const;
  function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    clearTimeout(deadline);
    resize.disconnect();
    mutation.disconnect();
    inputEvents.forEach(event => list.removeEventListener(event, cancel, true));
    mediaEvents.forEach(event => list.removeEventListener(event, schedule, true));
  }
  function finish(result: "visible" | "cancelled" | "timeout") {
    if (stopped) return;
    stop();
    onFinish(result);
  }
  function cancel(event: Event) {
    if (event.type === "keydown" && !["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes((event as KeyboardEvent).key)) return;
    finish("cancelled");
  }
  function observe() {
    Array.from(list.children).forEach(child => resize.observe(child));
  }
  function schedule() {
    if (stopped || frame) return;
    frame = requestAnimationFrame(check);
  }
  function check() {
    frame = 0;
    if (stopped) return;
    const target = list.querySelector<HTMLElement>(`[data-mailbox-id="${escaped}"]`);
    if (!target) { stable = false; return; }
    const rect = target.getBoundingClientRect();
    const area = list.getBoundingClientRect();
    const padding = Math.max(0, (list.clientHeight - Math.min(rect.height, list.clientHeight)) / 2);
    list.scrollTo({ top: list.scrollTop + rect.top - area.top - padding, behavior: "auto" });
    const aligned = target.getBoundingClientRect();
    const waiting = Array.from(list.querySelectorAll<HTMLElement>("[data-attachment-loading], img, video"))
      .some(element => {
        if (element.getBoundingClientRect().top > aligned.bottom) return false;
        if (element.hasAttribute("data-attachment-loading")) return true;
        if (element.tagName === "IMG") return !(element as HTMLImageElement).complete;
        return (element as HTMLVideoElement).readyState === 0;
      });
    const after = target.getBoundingClientRect();
    const visible = after.bottom > area.top && after.top < area.top + list.clientHeight;
    if (!waiting && visible) {
      if (stable) { finish("visible"); return; }
      stable = true;
      schedule();
    } else stable = false;
  }
  const deadline = setTimeout(() => finish("timeout"), 10_000);
  mutation.observe(list, { childList: true, subtree: true });
  observe();
  inputEvents.forEach(event => list.addEventListener(event, cancel, true));
  mediaEvents.forEach(event => list.addEventListener(event, schedule, true));
  schedule();
  return stop;
}
