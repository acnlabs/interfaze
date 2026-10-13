/** Map a click on the shown picture onto the 1024×768 desktop. */

export const SCREEN_WIDTH = 1024;
export const SCREEN_HEIGHT = 768;

export function screenPoint(
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
): { x: number; y: number } | null {
  if (!(width > 0) || !(height > 0)) return null;
  if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) return null;
  const x = Math.min(SCREEN_WIDTH - 1, Math.max(0, Math.floor((offsetX / width) * SCREEN_WIDTH)));
  const y = Math.min(SCREEN_HEIGHT - 1, Math.max(0, Math.floor((offsetY / height) * SCREEN_HEIGHT)));
  return { x, y };
}

/** Size a 1024×768 live iframe inside the pane so noVNC does not letterbox in gray. */
export function screenFrameSize(
  paneW: number,
  paneH: number,
): { width: number; height: number; left: number; top: number } | null {
  if (!(paneW > 0) || !(paneH > 0) || !Number.isFinite(paneW) || !Number.isFinite(paneH)) return null;
  const scale = Math.min(paneW / SCREEN_WIDTH, paneH / SCREEN_HEIGHT);
  if (!(scale > 0) || !Number.isFinite(scale)) return null;
  const width = Math.max(1, Math.floor(SCREEN_WIDTH * scale));
  const height = Math.max(1, Math.floor(SCREEN_HEIGHT * scale));
  return {
    width,
    height,
    left: Math.floor((paneW - width) / 2),
    top: Math.floor((paneH - height) / 2),
  };
}

/** null means fill the pane — overseas after the desktop actually resized. */
export function screenLiveBox(
  pane: { width: number; height: number } | null | undefined,
  fillPane: boolean,
): { left: number; top: number; width: number; height: number } | null {
  if (fillPane || !pane) return null;
  return screenFrameSize(pane.width, pane.height);
}
