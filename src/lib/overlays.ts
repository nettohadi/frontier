import { readdirSync, existsSync } from 'fs';
import path from 'path';

// Track which overlay was used last for round-robin rotation
let lastOverlayIndex = -1;

/**
 * List all available overlay files in the overlays directory
 */
export function listOverlays(): string[] {
  const overlaysPath = process.env.OVERLAYS_PATH || 'assets/overlays';

  if (!existsSync(overlaysPath)) {
    console.warn(`[Overlays] Directory not found: ${overlaysPath}`);
    return [];
  }

  const files = readdirSync(overlaysPath).filter(
    (f) =>
      f.endsWith('.mp4') || f.endsWith('.mov') || f.endsWith('.webm')
  );

  return files.map((f) => path.join(overlaysPath, f));
}

/**
 * Get the next overlay using round-robin rotation
 * Returns null if no overlays are available
 */
export function getNextOverlay(): string | null {
  const overlays = listOverlays();

  if (overlays.length === 0) {
    return null;
  }

  lastOverlayIndex = (lastOverlayIndex + 1) % overlays.length;
  const overlay = overlays[lastOverlayIndex];

  console.log(`[Overlays] Selected: ${path.basename(overlay)}`);
  return overlay;
}

/**
 * Get a random overlay
 * Returns null if no overlays are available
 */
export function getRandomOverlay(): string | null {
  const overlays = listOverlays();

  if (overlays.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * overlays.length);
  const overlay = overlays[randomIndex];

  console.log(`[Overlays] Random selected: ${path.basename(overlay)}`);
  return overlay;
}
