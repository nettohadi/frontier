import { generateASSHeader, SUFI_STYLE } from "./ass-template";
import type { WordAlignment } from "@/types";

// Regex pattern for bracketed tags: [whispers], [pause], etc.
const AUDIO_TAG_PATTERN = "\\[[^\\]]+\\]";

function stripAudioTags(text: string): string {
  const regex = new RegExp(AUDIO_TAG_PATTERN, "gi");
  return text
    .replace(regex, "")
    .replace(/\.{2,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isAudioTagOrEllipsis(word: string): boolean {
  if (/^\.+$/.test(word)) return true;
  const regex = new RegExp(`^${AUDIO_TAG_PATTERN}$`, "i");
  return regex.test(word);
}

// ─── Interfaces ──────────────────────────────────────────────

interface KaraokeWord {
  word: string;
  start: number;
  end: number;
}

interface SubtitleLine {
  words: KaraokeWord[];
  lineStart: number;
  lineEnd: number;
}

interface GenerateASSOptions {
  wordsPerLine?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  lineGapMs?: number;
  blurAmount?: number;
  videoWidth?: number;
  videoHeight?: number;
}

// ─── Time Formatting ─────────────────────────────────────────

function secondsToASSTime(seconds: number): string {
  const totalCs = Math.round(seconds * 100);
  const h = Math.floor(totalCs / 360000);
  const m = Math.floor((totalCs % 360000) / 6000);
  const s = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function secondsToCs(seconds: number): number {
  return Math.max(1, Math.round(seconds * 100));
}

// ─── Step 1: Characters → Words ──────────────────────────────

function elevenLabsToWords(alignment: WordAlignment): KaraokeWord[] {
  const words: KaraokeWord[] = [];
  let currentWord = "";
  let wordStart: number | null = null;
  let wordEnd: number | null = null;
  let insideBracket = false;

  for (let i = 0; i < alignment.characters.length; i++) {
    const char = alignment.characters[i];

    // Skip bracketed audio tags
    if (char === "[") {
      insideBracket = true;
      continue;
    }
    if (char === "]") {
      insideBracket = false;
      continue;
    }
    if (insideBracket) continue;

    if (char === " " || char === "\n" || char === "\r") {
      if (currentWord.length > 0 && wordStart !== null && wordEnd !== null) {
        if (!isAudioTagOrEllipsis(currentWord)) {
          const cleanWord = stripAudioTags(currentWord);
          if (cleanWord.length > 0) {
            words.push({ word: cleanWord, start: wordStart, end: wordEnd });
          }
        }
      }
      currentWord = "";
      wordStart = null;
      wordEnd = null;
    } else {
      if (wordStart === null) {
        wordStart = alignment.character_start_times_seconds[i];
      }
      wordEnd = alignment.character_end_times_seconds[i];
      currentWord += char;
    }
  }

  // Emit final word
  if (currentWord.length > 0 && wordStart !== null && wordEnd !== null) {
    if (!isAudioTagOrEllipsis(currentWord)) {
      const cleanWord = stripAudioTags(currentWord);
      if (cleanWord.length > 0) {
        words.push({ word: cleanWord, start: wordStart, end: wordEnd });
      }
    }
  }

  return words;
}

// ─── Step 2: Words → Lines ───────────────────────────────────

function groupIntoLines(
  words: KaraokeWord[],
  wordsPerLine: number,
  fadeInMs: number,
  fadeOutMs: number,
  lineGapMs: number
): SubtitleLine[] {
  const lines: SubtitleLine[] = [];
  const fadeInSec = fadeInMs / 1000;
  const fadeOutSec = fadeOutMs / 1000;
  const lineGapSec = lineGapMs / 1000;

  for (let i = 0; i < words.length; i += wordsPerLine) {
    const chunk = words.slice(i, i + wordsPerLine);
    const firstWord = chunk[0];
    const lastWord = chunk[chunk.length - 1];

    lines.push({
      words: chunk,
      lineStart: Math.max(0, firstWord.start - fadeInSec),
      lineEnd: lastWord.end + fadeOutSec,
    });
  }

  // Ensure no overlap between consecutive lines
  for (let i = 0; i < lines.length - 1; i++) {
    const minNextStart = lines[i + 1].words[0].start - fadeInSec;
    if (lines[i].lineEnd > minNextStart - lineGapSec) {
      lines[i].lineEnd = minNextStart - lineGapSec;
    }
    // Ensure lineEnd never cuts before last word ends
    const lastWordEnd = lines[i].words[lines[i].words.length - 1].end;
    if (lines[i].lineEnd < lastWordEnd + 0.05) {
      lines[i].lineEnd = lastWordEnd + 0.05;
    }
  }

  return lines;
}

// ─── Step 3: Lines → ASS Dialogue Events ─────────────────────

function generateDialogueLine(
  line: SubtitleLine,
  fadeInMs: number,
  fadeOutMs: number,
  blurAmount: number
): string {
  const start = secondsToASSTime(line.lineStart);
  const end = secondsToASSTime(line.lineEnd);
  const styleName = SUFI_STYLE.name;

  let karaokeText = "";
  let prevEnd = line.words[0].start;

  // Opening tags: fixed position (center of 1080x1920) + fade + blur
  karaokeText += `{\\pos(540,960)\\fad(${fadeInMs},${fadeOutMs})\\blur${blurAmount}}`;

  for (let i = 0; i < line.words.length; i++) {
    const word = line.words[i];

    if (i === 0) {
      const kfDuration = secondsToCs(word.end - word.start);

      // If there's a gap between lineStart and first word, add silent \kf
      const gapBefore = word.start - line.lineStart;
      if (gapBefore > 0.05) {
        karaokeText += `{\\kf${secondsToCs(gapBefore)}}`;
      }

      karaokeText += `{\\kf${kfDuration}}${word.word}`;
    } else {
      const gapFromPrev = word.start - prevEnd;
      const kfDuration = secondsToCs(word.end - word.start);

      if (gapFromPrev > 0.05) {
        // Add gap as a space with its own \kf duration
        karaokeText += `{\\kf${secondsToCs(gapFromPrev)}} `;
        karaokeText += `{\\kf${kfDuration}}${word.word}`;
      } else {
        karaokeText += ` {\\kf${kfDuration}}${word.word}`;
      }
    }

    prevEnd = word.end;
  }

  return `Dialogue: 0,${start},${end},${styleName},,0,0,0,,${karaokeText}`;
}

// ─── Main Export ─────────────────────────────────────────────

/**
 * Generate a complete ASS subtitle file from ElevenLabs alignment data.
 * Returns the ASS file content as a string — write to disk with fs.writeFile().
 */
export function generateASSFromElevenLabs(
  alignment: WordAlignment,
  options: GenerateASSOptions = {}
): string {
  const {
    wordsPerLine = 6,
    fadeInMs = 300,
    fadeOutMs = 400,
    lineGapMs = 100,
    blurAmount = 1.5,
    videoWidth = 1080,
    videoHeight = 1920,
  } = options;

  const words = elevenLabsToWords(alignment);

  if (words.length === 0) {
    return generateASSHeader(videoWidth, videoHeight);
  }

  const lines = groupIntoLines(words, wordsPerLine, fadeInMs, fadeOutMs, lineGapMs);

  let ass = generateASSHeader(videoWidth, videoHeight);

  for (const line of lines) {
    ass += generateDialogueLine(line, fadeInMs, fadeOutMs, blurAmount) + "\n";
  }

  return ass;
}
