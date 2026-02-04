import { writeFile } from 'fs/promises';
import path from 'path';
import type { WordAlignment } from '@/types';

// Regex pattern for all bracketed tags (audio tags, tone tags, mood tags, etc.)
// Matches any text in square brackets: [whispers], [Contemplative], [soft], [pause], etc.
// This ensures no tags appear in subtitles regardless of what the LLM generates
const AUDIO_TAG_PATTERN = '\\[[^\\]]+\\]';

/**
 * Strip ElevenLabs v3 audio tags and ellipses from text
 */
function stripAudioTags(text: string): string {
  const regex = new RegExp(AUDIO_TAG_PATTERN, 'gi');
  return text
    .replace(regex, '')
    .replace(/\.{2,}/g, '') // Remove ellipses (.. or ...)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if a word is entirely an audio tag or just ellipses
 * Uses fresh regex instance to avoid lastIndex issues with global flag
 */
function isAudioTagOrEllipsis(word: string): boolean {
  // Check if it's just dots/ellipses
  if (/^\.+$/.test(word)) return true;
  // Check if it's an audio tag
  const regex = new RegExp(`^${AUDIO_TAG_PATTERN}$`, 'i');
  return regex.test(word);
}

interface SrtEntry {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
}

function formatSrtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

// ASS time format: h:mm:ss.cc (centiseconds)
function formatAssTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100); // centiseconds

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
}

function reconstructWordsFromCharacters(alignment: WordAlignment): WordTiming[] {
  const words: WordTiming[] = [];
  let currentWord = '';
  let wordStartTime = 0;
  let wordEndTime = 0;

  for (let i = 0; i < alignment.characters.length; i++) {
    const char = alignment.characters[i];
    const startTime = alignment.character_start_times_seconds[i];
    const endTime = alignment.character_end_times_seconds[i];

    if (char === ' ' || char === '\n') {
      if (currentWord.length > 0) {
        // Skip words that are entirely audio tags like [thoughtful]
        if (!isAudioTagOrEllipsis(currentWord)) {
          // Strip any audio tags from within the word
          const cleanWord = stripAudioTags(currentWord);
          if (cleanWord.length > 0) {
            words.push({
              word: cleanWord,
              startTime: wordStartTime,
              endTime: wordEndTime,
            });
          }
        }
        currentWord = '';
      }
    } else {
      if (currentWord.length === 0) {
        wordStartTime = startTime;
      }
      currentWord += char;
      wordEndTime = endTime;
    }
  }

  // Don't forget the last word
  if (currentWord.length > 0) {
    // Skip words that are entirely audio tags
    if (!isAudioTagOrEllipsis(currentWord)) {
      const cleanWord = stripAudioTags(currentWord);
      if (cleanWord.length > 0) {
        words.push({
          word: cleanWord,
          startTime: wordStartTime,
          endTime: wordEndTime,
        });
      }
    }
  }

  return words;
}

export async function generateSrt(
  alignment: WordAlignment,
  videoId: string,
  wordsPerChunk: number = 5
): Promise<string> {
  const tempPath = process.env.TEMP_PATH || 'temp';
  const words = reconstructWordsFromCharacters(alignment);
  const entries: SrtEntry[] = [];

  let chunkWords: WordTiming[] = [];
  let entryIndex = 1;

  for (const word of words) {
    chunkWords.push(word);

    // Create chunk when we hit target size or encounter natural breaks
    const endsWithPunctuation =
      word.word.endsWith('.') ||
      word.word.endsWith('!') ||
      word.word.endsWith('?') ||
      word.word.endsWith(',');

    const shouldBreak = chunkWords.length >= wordsPerChunk || endsWithPunctuation;

    if (shouldBreak && chunkWords.length > 0) {
      entries.push({
        index: entryIndex++,
        startTime: formatSrtTime(chunkWords[0].startTime),
        endTime: formatSrtTime(chunkWords[chunkWords.length - 1].endTime),
        text: chunkWords.map((w) => w.word).join(' '),
      });
      chunkWords = [];
    }
  }

  // Handle remaining words
  if (chunkWords.length > 0) {
    entries.push({
      index: entryIndex,
      startTime: formatSrtTime(chunkWords[0].startTime),
      endTime: formatSrtTime(chunkWords[chunkWords.length - 1].endTime),
      text: chunkWords.map((w) => w.word).join(' '),
    });
  }

  // Format SRT content
  const srtContent = entries
    .map((e) => `${e.index}\n${e.startTime} --> ${e.endTime}\n${e.text}\n`)
    .join('\n');

  const srtPath = path.join(tempPath, `${videoId}.srt`);
  await writeFile(srtPath, srtContent, 'utf-8');

  return srtPath;
}

/**
 * Generate ASS subtitles with karaoke-style word highlighting
 * Uses proper ASS karaoke tags (\kf) for smooth word-by-word highlighting
 * - Words start white and turn yellow when spoken
 * - Text is centered on screen
 * - Single subtitle entry per line (no flickering)
 */
export async function generateAssWithHighlight(
  alignment: WordAlignment,
  videoId: string,
  wordsPerLine: number = 4
): Promise<string> {
  const tempPath = process.env.TEMP_PATH || 'temp';
  const words = reconstructWordsFromCharacters(alignment);

  // ASS header with styles
  // PrimaryColour = white, OutlineColour = black for visibility
  const assHeader = `[Script Info]
Title: Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Impact,100,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,6,2,5,20,20,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const dialogueLines: string[] = [];

  // Group words into lines
  const lines: WordTiming[][] = [];
  let currentLine: WordTiming[] = [];

  for (const word of words) {
    // Clean markdown before adding
    const cleanWord = word.word.replace(/\*+/g, '');
    if (cleanWord.length === 0) continue;

    currentLine.push({ ...word, word: cleanWord });

    const endsWithPunctuation =
      cleanWord.endsWith('.') || cleanWord.endsWith('!') || cleanWord.endsWith('?');

    if (currentLine.length >= wordsPerLine || endsWithPunctuation) {
      lines.push(currentLine);
      currentLine = [];
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  // Generate ONE dialogue entry per line
  // Show subtitle slightly before it's spoken so viewers can read ahead
  const leadTime = 0.3; // seconds before the first word is spoken

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length === 0) continue;

    const lineStart = Math.max(0, line[0].startTime - leadTime);

    // End this subtitle before the next one starts (accounting for lead time)
    // This prevents overlapping subtitles
    let lineEnd = line[line.length - 1].endTime;
    if (i < lines.length - 1) {
      const nextLineStart = Math.max(0, lines[i + 1][0].startTime - leadTime);
      lineEnd = Math.min(lineEnd, nextLineStart - 0.01); // End just before next starts
    }

    const startTime = formatAssTime(lineStart);
    const endTime = formatAssTime(lineEnd);

    // Build plain text (no karaoke effect)
    const lineText = line.map((w) => w.word).join(' ');
    dialogueLines.push(`Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${lineText}`);
  }

  const assContent = assHeader + dialogueLines.join('\n') + '\n';
  const assPath = path.join(tempPath, `${videoId}.ass`);
  await writeFile(assPath, assContent, 'utf-8');

  return assPath;
}
