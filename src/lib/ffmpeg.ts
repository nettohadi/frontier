import { spawn } from 'child_process';
import { readdirSync, existsSync } from 'fs';
import path from 'path';
import { generateKenBurnsFilter, getVariedEffects } from './kenBurns';
import { getNextMusicIndex } from './rotation';

// Use local FFmpeg binary with libass support if available
const PROJECT_ROOT = process.cwd();
const LOCAL_FFMPEG = path.join(PROJECT_ROOT, 'bin', 'ffmpeg');
const LOCAL_FFPROBE = path.join(PROJECT_ROOT, 'bin', 'ffprobe');

function getFFmpegPath(): string {
  if (existsSync(LOCAL_FFMPEG)) {
    return LOCAL_FFMPEG;
  }
  return 'ffmpeg'; // Fall back to system FFmpeg
}

function getFFprobePath(): string {
  if (existsSync(LOCAL_FFPROBE)) {
    return LOCAL_FFPROBE;
  }
  return 'ffprobe'; // Fall back to system ffprobe
}

export interface RenderOptions {
  videoId: string;
  backgroundPath: string;
  audioPath: string;
  srtPath: string; // Can be .srt or .ass file
  outputPath: string;
  musicPath?: string; // Optional background music
  musicVolume?: number; // Music volume (0.0 to 1.0), default 0.15
  burnSubtitles?: boolean; // Whether to burn subtitles (default: true)
}

// List all available music files (sorted alphabetically for consistent ordering)
export function listMusic(): string[] {
  const musicsPath = process.env.MUSICS_PATH || 'assets/musics';
  try {
    const files = readdirSync(musicsPath)
      .filter((f) => f.endsWith('.mp3') || f.endsWith('.m4a') || f.endsWith('.wav'))
      .sort();
    return files.map((f) => path.join(musicsPath, f));
  } catch {
    return [];
  }
}

// Get the next music file using database-persisted round-robin rotation
export async function getNextMusic(): Promise<string | null> {
  const musicFiles = listMusic();
  if (musicFiles.length === 0) return null;

  const index = await getNextMusicIndex(musicFiles.length);
  const music = musicFiles[index];

  console.log(`[Music] Selected (${index + 1}/${musicFiles.length}): ${path.basename(music)}`);
  return music;
}

export async function renderVideo(options: RenderOptions): Promise<void> {
  const {
    backgroundPath,
    audioPath,
    srtPath,
    outputPath,
    musicPath,
    musicVolume = 0.15, // Background music at 15% volume by default
    burnSubtitles = true, // Burn subtitles by default
  } = options;

  const ffmpegPath = getFFmpegPath();
  console.log(`[FFmpeg] Using binary: ${ffmpegPath}`);

  // Get audio duration for the video
  const audioDuration = await getAudioDuration(audioPath);

  // Build FFmpeg arguments
  const args: string[] = [];

  // Input: background video (looped infinitely)
  args.push('-stream_loop', '-1', '-i', backgroundPath);

  // Input: voiceover audio
  args.push('-i', audioPath);

  // Input: background music (looped) - if provided
  if (musicPath) {
    args.push('-stream_loop', '-1', '-i', musicPath);
  }

  // Duration (based on audio length + 0.5s padding)
  args.push('-t', String(audioDuration + 0.5));

  // Build video filter with optional subtitles
  let videoFilter = '';
  if (burnSubtitles && srtPath && existsSync(srtPath)) {
    videoFilter = buildSubtitleFilter(srtPath);
    console.log(`[FFmpeg] Subtitle filter: ${videoFilter}`);
  }

  // Audio filter: mix voiceover with background music
  if (musicPath) {
    // Mix voiceover with music (reduced volume)
    // [1:a] = voiceover, [2:a] = music
    // normalize=0 prevents amix from auto-normalizing
    const voiceVol = 1.0;
    const musicVol = musicVolume;

    if (videoFilter) {
      // Both video filter (subtitles) and audio mixing
      args.push(
        '-filter_complex',
        `[0:v]${videoFilter}[vout];[1:a]volume=${voiceVol}[voice];[2:a]volume=${musicVol}[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[aout]`,
        '-map', '[vout]',
        '-map', '[aout]'
      );
    } else {
      // Audio mixing only
      args.push(
        '-filter_complex',
        `[1:a]volume=${voiceVol}[voice];[2:a]volume=${musicVol}[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[aout]`,
        '-map', '0:v',
        '-map', '[aout]'
      );
    }
  } else {
    // No music
    if (videoFilter) {
      args.push('-vf', videoFilter);
    }
    args.push('-map', '0:v', '-map', '1:a');
  }

  // Video codec: H.264 with software encoding (for compatibility with static FFmpeg)
  // Note: VideoToolbox may not work with static builds
  args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23');

  // Audio codec: AAC
  args.push('-c:a', 'aac', '-b:a', '192k');

  // Output settings
  args.push('-movflags', '+faststart', '-y', outputPath);

  return new Promise((resolve, reject) => {
    console.log(`[FFmpeg] Starting render: ${outputPath}`);
    console.log(`[FFmpeg] Args: ${args.join(' ')}`);
    const ffmpeg = spawn(ffmpegPath, args);

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`[FFmpeg] Render complete: ${outputPath}`);
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`FFmpeg spawn error: ${err.message}`));
    });
  });
}

function buildSubtitleFilter(subtitlePath: string): string {
  // Get absolute path
  const absolutePath = path.resolve(subtitlePath);

  // Escape special characters for FFmpeg filter graph
  // On macOS, we need to escape : and ' in the path
  const escapedPath = absolutePath
    .split('')
    .map((char) => {
      if (char === ':') return '\\:';
      if (char === "'") return "\\'";
      if (char === '[') return '\\[';
      if (char === ']') return '\\]';
      return char;
    })
    .join('');

  // Check if it's an ASS file (with embedded karaoke styling)
  if (subtitlePath.endsWith('.ass')) {
    // Use ass filter - it respects the embedded styling
    return `ass='${escapedPath}'`;
  }

  // SRT file - apply default styling
  // Subtitle styling for short-form vertical videos
  // - Large font for mobile viewing
  // - White text with black outline for readability
  // - Positioned in lower third of screen
  const style =
    'FontName=Arial,FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,MarginV=60';

  return `subtitles='${escapedPath}':force_style='${style}'`;
}

async function getAudioDuration(audioPath: string): Promise<number> {
  const ffprobePath = getFFprobePath();
  return new Promise((resolve, reject) => {
    const ffprobe = spawn(ffprobePath, [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'csv=p=0',
      audioPath,
    ]);

    let output = '';
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(output.trim());
        if (isNaN(duration)) {
          reject(new Error('Failed to parse audio duration'));
        } else {
          resolve(duration);
        }
      } else {
        reject(new Error('ffprobe failed to get audio duration'));
      }
    });

    ffprobe.on('error', (err) => {
      reject(new Error(`ffprobe spawn error: ${err.message}`));
    });
  });
}

export interface ImageBasedRenderOptions {
  videoId: string;
  imagePaths: string[]; // image paths
  audioPath: string;
  srtPath: string;
  outputPath: string;
  overlayPath?: string; // MP4 with black background
  musicPath?: string;
  musicVolume?: number;
  enableLightRays?: boolean; // Enable animated light rays effect
  enableKenBurns?: boolean; // Enable Ken Burns zoom/pan effect (default: false)
  musicOnlyEndingSec?: number; // Seconds of music-only ending (default: 3)
}

/**
 * Generate FFmpeg filter for animated light rays effect
 * Creates diagonal light streaks that slowly animate across the frame
 */
function generateLightRaysFilter(fps: number = 30): string {
  // Create animated diagonal light rays using geq filter
  // This creates subtle diagonal bright bands that move slowly
  // The effect is similar to light streaming through a window

  // Animation: light rays move slowly from top-right to bottom-left
  // Using sin wave for smooth movement, divided by FPS for time-based animation
  // Intensity varies based on position and time

  // Parameters:
  // - 0.15 = max brightness increase (subtle)
  // - 100 = stripe width in pixels
  // - 0.02 = animation speed
  const stripeWidth = 150;
  const animSpeed = 0.015;
  const intensity = 0.12;

  // geq filter modifies each pixel based on position and frame number (N)
  // Creates diagonal stripes that animate over time
  // The formula creates bright diagonal bands moving across the frame
  return `geq=lum='lum(X,Y)*(1+${intensity}*pow(sin((X+Y-N*${animSpeed}*${fps})/${stripeWidth}*3.14159),2))':cb='cb(X,Y)':cr='cr(X,Y)'`;
}

/**
 * Render video from AI-generated images with Ken Burns effects
 * Visual stack:
 * - Layer 1: AI Generated Images with Ken Burns motion
 * - Layer 2: Animated Overlay (optional, blended with screen mode)
 * - Layer 3: Subtitles
 */
export async function renderImageBasedVideo(
  options: ImageBasedRenderOptions
): Promise<void> {
  const {
    imagePaths,
    audioPath,
    srtPath,
    outputPath,
    overlayPath,
    musicPath,
    musicVolume = 0.15,
  } = options;

  const ffmpegPath = getFFmpegPath();
  console.log(`[FFmpeg] Using binary: ${ffmpegPath}`);
  console.log(`[FFmpeg] Rendering image-based video with ${imagePaths.length} images`);

  // Get audio duration
  const audioDuration = await getAudioDuration(audioPath);
  const fps = 30;

  // Music-only ending duration (default 3 seconds)
  const musicOnlyEnding = options.musicOnlyEndingSec ?? 3;
  const totalDuration = audioDuration + musicOnlyEnding + 0.5; // voice + music-only + small padding

  // Calculate duration per image (evenly split across total duration)
  const durationPerImage = totalDuration / imagePaths.length;

  // Get varied Ken Burns effects for each image
  const effects = getVariedEffects(imagePaths.length);

  // Build FFmpeg arguments
  const args: string[] = [];

  // Inputs: all images
  for (const imagePath of imagePaths) {
    args.push('-loop', '1', '-i', imagePath);
  }

  // Input: voiceover audio
  args.push('-i', audioPath);
  const audioInputIndex = imagePaths.length;

  // Input: overlay (if provided)
  let overlayInputIndex = -1;
  if (overlayPath && existsSync(overlayPath)) {
    args.push('-stream_loop', '-1', '-i', overlayPath);
    overlayInputIndex = imagePaths.length + 1;
  }

  // Input: background music (if provided)
  let musicInputIndex = -1;
  if (musicPath && existsSync(musicPath)) {
    args.push('-stream_loop', '-1', '-i', musicPath);
    musicInputIndex = overlayInputIndex > 0 ? overlayInputIndex + 1 : imagePaths.length + 1;
  }

  // Duration (voice + music-only ending + padding)
  args.push('-t', String(totalDuration));

  // Build complex filter graph
  const filterParts: string[] = [];

  // Process each image - either with Ken Burns effect or static scale
  for (let i = 0; i < imagePaths.length; i++) {
    const totalFrames = Math.floor(durationPerImage * fps);

    if (options.enableKenBurns) {
      // Ken Burns effect (zoom/pan animation)
      const effect = effects[i];
      const kenBurnsFilter = generateKenBurnsFilter(effect, durationPerImage, fps, 1080, 1920);
      filterParts.push(`[${i}:v]${kenBurnsFilter},setpts=PTS-STARTPTS[img${i}]`);
    } else {
      // Static image - just scale and crop to fit 1080x1920, hold for duration
      filterParts.push(
        `[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,loop=loop=${totalFrames}:size=1:start=0,setpts=PTS-STARTPTS[img${i}]`
      );
    }
  }

  // Concatenate all images
  const concatInputs = imagePaths.map((_, i) => `[img${i}]`).join('');
  filterParts.push(`${concatInputs}concat=n=${imagePaths.length}:v=1:a=0[video]`);

  // Apply light rays effect (if enabled)
  let currentVideoLabel = 'video';
  if (options.enableLightRays) {
    const lightRaysFilter = generateLightRaysFilter(fps);
    filterParts.push(`[${currentVideoLabel}]${lightRaysFilter}[withrays]`);
    currentVideoLabel = 'withrays';
    console.log(`[FFmpeg] Light rays effect enabled`);
  }

  // Apply overlay with lighten blend (if provided)
  if (overlayInputIndex > 0) {
    // Scale overlay to match video size, loop it, and blend
    filterParts.push(
      `[${overlayInputIndex}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=PTS-STARTPTS[overlay]`
    );
    filterParts.push(
      `[${currentVideoLabel}][overlay]blend=all_mode=lighten:all_opacity=0.5[blended]`
    );
    currentVideoLabel = 'blended';
  }

  // Apply subtitles
  if (srtPath && existsSync(srtPath)) {
    const subtitleFilter = buildSubtitleFilter(srtPath);
    filterParts.push(`[${currentVideoLabel}]${subtitleFilter}[final]`);
    currentVideoLabel = 'final';
  }

  // Audio mixing
  // normalize=0 prevents amix from auto-normalizing
  // apad pads voiceover with silence for music-only ending
  if (musicInputIndex > 0) {
    const padDuration = musicOnlyEnding + 0.5; // Pad voice with silence for music-only ending
    filterParts.push(
      `[${audioInputIndex}:a]volume=1.0,apad=pad_dur=${padDuration}[voice];[${musicInputIndex}:a]volume=${musicVolume}[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[aout]`
    );
    args.push('-filter_complex', filterParts.join(';'));
    args.push('-map', `[${currentVideoLabel}]`, '-map', '[aout]');
  } else {
    args.push('-filter_complex', filterParts.join(';'));
    args.push('-map', `[${currentVideoLabel}]`, '-map', `${audioInputIndex}:a`);
  }

  // Video codec
  args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23');

  // Audio codec
  args.push('-c:a', 'aac', '-b:a', '192k');

  // Output settings
  args.push('-movflags', '+faststart', '-y', outputPath);

  return new Promise((resolve, reject) => {
    console.log(`[FFmpeg] Starting image-based render: ${outputPath}`);
    console.log(`[FFmpeg] Args: ${args.join(' ')}`);
    const ffmpeg = spawn(ffmpegPath, args);

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`[FFmpeg] Render complete: ${outputPath}`);
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`FFmpeg spawn error: ${err.message}`));
    });
  });
}
