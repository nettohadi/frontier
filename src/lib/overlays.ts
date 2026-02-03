import { readdirSync, existsSync } from 'fs';
import path from 'path';
import { getNextOverlayIndex } from './rotation';

/**
 * List all available overlay files in the overlays directory (sorted for consistent ordering)
 */
export function listOverlays(): string[] {
  const overlaysPath = process.env.OVERLAYS_PATH || 'assets/overlays';

  if (!existsSync(overlaysPath)) {
    console.warn(`[Overlays] Directory not found: ${overlaysPath}`);
    return [];
  }

  const files = readdirSync(overlaysPath)
    .filter((f) => f.endsWith('.mp4') || f.endsWith('.mov') || f.endsWith('.webm'))
    .sort();

  return files.map((f) => path.join(overlaysPath, f));
}

/**
 * Get the next overlay using database-persisted round-robin rotation
 * Returns null if no overlays are available
 */
export async function getNextOverlay(): Promise<string | null> {
  const overlays = listOverlays();

  if (overlays.length === 0) {
    return null;
  }

  const index = await getNextOverlayIndex(overlays.length);
  const overlay = overlays[index];

  console.log(`[Overlays] Selected (${index + 1}/${overlays.length}): ${path.basename(overlay)}`);
  return overlay;
}
