/**
 * Ken Burns effect types for image animation
 */
export type KenBurnsEffect =
  | 'zoom-in'
  | 'zoom-out'
  | 'pan-left'
  | 'pan-right'
  | 'pan-up'
  | 'pan-down'
  | 'zoom-in-pan-left'
  | 'zoom-in-pan-right';

const EFFECTS: KenBurnsEffect[] = [
  'zoom-in',
  'zoom-out',
  'pan-left',
  'pan-right',
  'pan-up',
  'zoom-in-pan-left',
  'zoom-in-pan-right',
];

/**
 * Get a random Ken Burns effect
 */
export function getRandomEffect(): KenBurnsEffect {
  const randomIndex = Math.floor(Math.random() * EFFECTS.length);
  return EFFECTS[randomIndex];
}

/**
 * Get varied effects for multiple images (avoids repeating same effect)
 */
export function getVariedEffects(count: number): KenBurnsEffect[] {
  const effects: KenBurnsEffect[] = [];
  const availableEffects = [...EFFECTS];

  for (let i = 0; i < count; i++) {
    if (availableEffects.length === 0) {
      // Reset if we've used all effects
      availableEffects.push(...EFFECTS);
    }

    const randomIndex = Math.floor(Math.random() * availableEffects.length);
    effects.push(availableEffects[randomIndex]);
    availableEffects.splice(randomIndex, 1);
  }

  return effects;
}

/**
 * Generate FFmpeg zoompan filter for Ken Burns effect
 *
 * @param effect - The Ken Burns effect to apply
 * @param durationSec - Duration of the effect in seconds
 * @param fps - Frames per second (default 30)
 * @param width - Output width (default 1080)
 * @param height - Output height (default 1920)
 */
export function generateKenBurnsFilter(
  effect: KenBurnsEffect,
  durationSec: number,
  fps: number = 30,
  width: number = 1080,
  height: number = 1920
): string {
  const totalFrames = Math.floor(durationSec * fps);

  // Base parameters for zoompan filter
  // z = zoom level (1.0 = original, >1.0 = zoomed in)
  // x, y = pan position
  // d = duration in frames
  // s = output size
  // fps = output framerate

  switch (effect) {
    case 'zoom-in':
      // Start at 1.0, slowly zoom to 1.15
      return `zoompan=z='1+0.15*on/${totalFrames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;

    case 'zoom-out':
      // Start at 1.15, slowly zoom out to 1.0
      return `zoompan=z='1.15-0.15*on/${totalFrames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;

    case 'pan-left':
      // Pan from right to left with slight zoom
      return `zoompan=z='1.1':x='iw*0.1-on/${totalFrames}*iw*0.1':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;

    case 'pan-right':
      // Pan from left to right with slight zoom
      return `zoompan=z='1.1':x='on/${totalFrames}*iw*0.1':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;

    case 'pan-up':
      // Pan from bottom to top with slight zoom
      return `zoompan=z='1.1':x='iw/2-(iw/zoom/2)':y='ih*0.1-on/${totalFrames}*ih*0.1':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;

    case 'pan-down':
      // Pan from top to bottom with slight zoom
      return `zoompan=z='1.1':x='iw/2-(iw/zoom/2)':y='on/${totalFrames}*ih*0.1':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;

    case 'zoom-in-pan-left':
      // Zoom in while panning left
      return `zoompan=z='1+0.12*on/${totalFrames}':x='iw*0.1-on/${totalFrames}*iw*0.05':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;

    case 'zoom-in-pan-right':
      // Zoom in while panning right
      return `zoompan=z='1+0.12*on/${totalFrames}':x='on/${totalFrames}*iw*0.05':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;

    default:
      // Default to simple zoom-in
      return `zoompan=z='1+0.15*on/${totalFrames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;
  }
}
