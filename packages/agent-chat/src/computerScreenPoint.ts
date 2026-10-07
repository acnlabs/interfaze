/** Map a click on the shown picture onto the 1024×768 desktop. */

const SCREEN_WIDTH = 1024;
const SCREEN_HEIGHT = 768;

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
