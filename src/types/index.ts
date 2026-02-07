export type VideoStatus =
  | 'PENDING'
  | 'GENERATING_SCRIPT'
  | 'VALIDATING_SCRIPT'
  | 'GENERATING_IMAGE_PROMPTS'
  | 'GENERATING_IMAGES'
  | 'GENERATING_AUDIO'
  | 'GENERATING_SRT'
  | 'RENDERING'
  | 'COMPLETED'
  | 'FAILED';

export type RenderMode = 'BACKGROUND_VIDEO' | 'AI_IMAGES';

export type JobType =
  | 'generate-script'
  | 'generate-image-prompts'
  | 'generate-images'
  | 'generate-tts'
  | 'generate-srt'
  | 'render-video';

export interface VideoJobData {
  videoId: string;
  step: JobType;
}

export interface CreateVideoRequest {
  topic: string;
  style?: string;
  backgroundId?: string;
  renderMode?: RenderMode;
}

export interface ImagePromptData {
  prompt: string;
  timing: 'full' | 'start' | 'middle' | 'end';
  description: string;
}

export interface BatchCreateRequest {
  videos: CreateVideoRequest[];
}

export interface ScriptGenerationResult {
  title: string;
  description: string;
  script: string;
  wordCount: number;
  model: string;
}

export interface WordAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface TtsResult {
  audioPath: string;
  alignment: WordAlignment;
  durationMs: number;
}
