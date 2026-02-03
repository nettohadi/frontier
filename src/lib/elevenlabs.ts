import { writeFile } from 'fs/promises';
import path from 'path';
import type { WordAlignment, TtsResult } from '@/types';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Regex to strip audio tags that aren't supported by /with-timestamps endpoint
// Also replaces [pause], [short pause], [long pause] with ellipses for natural pauses
const AUDIO_TAG_PATTERN =
  /\[(?:whispers?|laughs?|thoughtful|sighs?|clears?\s*throat|gasps?|sobs?|giggles?|cries|yells?|shouts?|screams?|curious|sad|excited|angry|happy)\]/gi;
const PAUSE_TAG_PATTERN = /\[(?:pause|short\s*pause|long\s*pause)\]/gi;

/**
 * Strip audio tags from text before sending to ElevenLabs
 * The /with-timestamps endpoint doesn't interpret audio tags properly
 */
function prepareTextForTTS(text: string): string {
  // Replace pause tags with ellipses for natural pauses
  let cleaned = text.replace(PAUSE_TAG_PATTERN, '...');
  // Remove other audio tags
  cleaned = cleaned.replace(AUDIO_TAG_PATTERN, '');
  // Clean up multiple spaces and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

export async function generateSpeechWithTimestamps(
  text: string,
  videoId: string
): Promise<TtsResult> {
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';
  const tempPath = process.env.TEMP_PATH || 'temp';

  // Strip audio tags since /with-timestamps endpoint doesn't support them
  const cleanedText = prepareTextForTTS(text);
  console.log(`[ElevenLabs] Original text length: ${text.length}, Cleaned: ${cleanedText.length}`);

  const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}/with-timestamps`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: cleanedText,
      model_id: 'eleven_v3',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.5,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // data.audio_base64 contains the MP3 audio
  // data.alignment contains character-level timing
  const audioBuffer = Buffer.from(data.audio_base64, 'base64');
  const audioPath = path.join(tempPath, `${videoId}.mp3`);
  await writeFile(audioPath, audioBuffer);

  const alignment = data.alignment as WordAlignment;

  // Calculate duration from last character end time
  const lastEndTime =
    alignment.character_end_times_seconds[alignment.character_end_times_seconds.length - 1];
  const durationMs = Math.ceil(lastEndTime * 1000);

  // Save alignment data for SRT generation
  const alignmentPath = path.join(tempPath, `${videoId}.alignment.json`);
  await writeFile(alignmentPath, JSON.stringify(alignment), 'utf-8');

  return {
    audioPath,
    alignment,
    durationMs,
  };
}
