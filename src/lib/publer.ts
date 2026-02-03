import { readFile } from 'fs/promises';
import path from 'path';

export interface YouTubeChannel {
  id: string;
  name: string;
  platform: string;
  avatar?: string;
}

export interface JobStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  result?: {
    url?: string;
    post_id?: string;
  };
  error?: string;
}

export interface CreatePostParams {
  accountId: string;
  mediaIds: string[];
  title: string;
  description: string;
  tags?: string[];
  scheduleAt?: Date;
  isShort?: boolean;
  isDraft?: boolean; // For testing - creates draft instead of scheduled
}

/**
 * Publer API Service for YouTube uploads
 * Documentation: https://publer.com/docs
 */
export class PublerService {
  private apiKey: string;
  private workspaceId: string;
  private baseUrl = 'https://app.publer.com/api/v1';

  constructor(apiKey: string, workspaceId: string) {
    this.apiKey = apiKey;
    this.workspaceId = workspaceId;
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer-API ${this.apiKey}`,
      'Publer-Workspace-Id': this.workspaceId,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/workspaces`, {
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get connected YouTube channels
   */
  async getYouTubeChannels(): Promise<YouTubeChannel[]> {
    const response = await fetch(`${this.baseUrl}/accounts`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch accounts: ${error}`);
    }

    const accounts = await response.json();

    // Filter for YouTube accounts only
    return accounts
      .filter((a: { provider: string }) => a.provider === 'youtube')
      .map((a: { id: string; name: string; provider: string; avatar?: string }) => ({
        id: a.id,
        name: a.name,
        platform: a.provider,
        avatar: a.avatar,
      }));
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Upload media file to Publer
   * Returns the media ID for use in posts
   */
  async uploadMedia(filePath: string): Promise<string> {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);

    const fileBuffer = await readFile(absolutePath);
    const fileName = path.basename(filePath);
    const mimeType = this.getMimeType(filePath);

    // Use native FormData and Blob (Node.js 18+)
    const blob = new Blob([fileBuffer], { type: mimeType });
    const formData = new FormData();
    formData.append('file', blob, fileName);

    console.log(`[Publer] Uploading media: ${fileName} (${fileBuffer.length} bytes)`);

    const response = await fetch(`${this.baseUrl}/media`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer-API ${this.apiKey}`,
        'Publer-Workspace-Id': this.workspaceId,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Publer] Media upload failed: ${error}`);
      throw new Error(`Media upload failed: ${error}`);
    }

    const result = await response.json();
    console.log('[Publer] Media upload response:', JSON.stringify(result));
    return result.id || result.media_id;
  }

  /**
   * Create a YouTube Short post
   */
  async createYouTubeShort(params: CreatePostParams): Promise<{ jobId: string }> {
    // Always include channel tags
    const baseTags = [
      '#sohibulhikayat',
      '#renunganmakrifat',
      '#renungansufi',
      '#hakikatmakrifat',
      '#jalaluddinrumi',
      '#shorts',
    ];
    const allTags = [...baseTags, ...(params.tags || [])];
    const uniqueTags = Array.from(new Set(allTags));

    // Build description with tags
    const descriptionWithTags = `${params.description}\n\n${uniqueTags.join(' ')}`;

    // Determine post state and endpoint:
    // - draft_private: for testing (saves as draft), uses /posts/schedule
    // - scheduled: for publishing, uses /posts/schedule/publish (immediate) or /posts/schedule (future)
    const useDraft = params.isDraft ?? (process.env.PUBLER_DRAFT_MODE === 'true');
    const state = useDraft ? 'draft_private' : 'scheduled';

    // Determine if we're doing immediate or future scheduled publishing
    const minFutureTime = new Date(Date.now() + 60 * 1000); // 1 minute from now
    const isFutureScheduled = params.scheduleAt && params.scheduleAt.getTime() > minFutureTime.getTime();

    // Use /publish endpoint for immediate publishing, /schedule for drafts and future scheduled
    const usePublishEndpoint = !useDraft && !isFutureScheduled;

    // Build account object - only include scheduled_at for future scheduled posts
    const accountObj: { id: string; scheduled_at?: string } = { id: params.accountId };
    if (isFutureScheduled && params.scheduleAt) {
      accountObj.scheduled_at = params.scheduleAt.toISOString();
    }

    // Build request body using Publer's correct format for YouTube Shorts
    // - type must be "video", not "short"
    // - isShort: true marks it as a YouTube Short
    // - media array with {id, type} objects instead of media_ids
    // - text field at post level for description fallback
    const body = {
      bulk: {
        state,
        posts: [
          {
            accounts: [accountObj],
            text: descriptionWithTags,
            networks: {
              youtube: {
                type: params.isShort !== false ? 'short' : 'video',
                media: params.mediaIds.map((id) => ({ id, type: 'video' })),
                title: params.title,
                description: descriptionWithTags,
                privacy: 'public',
                tags: uniqueTags.map((t) => t.replace('#', '')),
              },
            },
          },
        ],
      },
    };

    const endpoint = usePublishEndpoint ? '/posts/schedule/publish' : '/posts/schedule';
    console.log('[Publer] Creating YouTube post:', JSON.stringify(body, null, 2));
    console.log(`[Publer] Mode: ${state}, Endpoint: ${endpoint}${isFutureScheduled ? ` (scheduled for ${params.scheduleAt?.toISOString()})` : ' (immediate)'}, Tags: ${uniqueTags.join(', ')}`);

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Post creation failed: ${error}`);
    }

    const result = await response.json();
    return { jobId: result.job_id || result.id };
  }

  /**
   * Schedule a post for publishing
   */
  async schedulePost(params: {
    accountIds: string[];
    mediaIds: string[];
    title: string;
    description: string;
    tags?: string[];
    scheduledAt: Date;
    isDraft?: boolean;
  }): Promise<{ jobId: string }> {
    // Always include channel tags
    const baseTags = [
      '#sohibulhikayat',
      '#renunganmakrifat',
      '#renungansufi',
      '#hakikatmakrifat',
      '#jalaluddinrumi',
      '#shorts',
    ];
    const allTags = [...baseTags, ...(params.tags || [])];
    const uniqueTags = Array.from(new Set(allTags));

    // Build description with tags
    const descriptionWithTags = `${params.description}\n\n${uniqueTags.join(' ')}`;

    // Determine post state: draft for testing, scheduled for production
    const useDraft = params.isDraft ?? (process.env.PUBLER_DRAFT_MODE === 'true');

    const body = {
      bulk: {
        state: useDraft ? 'draft' : 'scheduled',
        posts: [
          {
            account_ids: params.accountIds,
            media_ids: params.mediaIds,
            text: descriptionWithTags,
            scheduled_at: useDraft ? undefined : params.scheduledAt.toISOString(),
            platforms: {
              youtube: {
                title: params.title,
                description: descriptionWithTags,
                privacy: 'public',
                type: 'short',
                tags: uniqueTags.map(t => t.replace('#', '')),
              },
            },
          },
        ],
      },
    };

    console.log(`[Publer] Scheduling post - Mode: ${useDraft ? 'draft' : 'scheduled'}, Tags: ${uniqueTags.join(', ')}`);

    const response = await fetch(`${this.baseUrl}/posts/schedule`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Schedule failed: ${error}`);
    }

    const result = await response.json();
    return { jobId: result.job_id };
  }

  /**
   * Poll job status
   */
  async getJobStatus(jobId: string): Promise<JobStatus> {
    const response = await fetch(`${this.baseUrl}/job_status/${jobId}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Job status check failed: ${error}`);
    }

    const result = await response.json();
    console.log('[Publer] Job status response:', JSON.stringify(result));

    // Check for failures in the payload (Publer returns failures this way)
    let errorMessage: string | undefined;
    if (result.payload?.failures) {
      const failures = Object.values(result.payload.failures).flat() as Array<{
        message?: string;
        provider?: string;
      }>;
      if (failures.length > 0) {
        errorMessage = failures.map((f) => f.message || 'Unknown error').join('; ');
      }
    }

    // Map Publer status to our status
    let status: JobStatus['status'] = 'pending';
    if (errorMessage) {
      // If there are failures, mark as failed even if status is "complete"
      status = 'failed';
    } else if (result.status === 'complete' || result.status === 'completed' || result.state === 'published_posted') {
      status = 'completed';
    } else if (result.status === 'failed' || result.state?.includes('failed')) {
      status = 'failed';
    } else if (result.status === 'processing' || result.state?.includes('pending')) {
      status = 'processing';
    }

    return {
      status,
      progress: result.progress,
      result: {
        url: result.social_link || result.url,
        post_id: result.post_id,
      },
      error: errorMessage || result.error || result.message,
    };
  }

  /**
   * Publish a post immediately
   */
  async publishNow(params: CreatePostParams): Promise<{ jobId: string }> {
    // Always include channel tags
    const baseTags = [
      '#sohibulhikayat',
      '#renunganmakrifat',
      '#renungansufi',
      '#hakikatmakrifat',
      '#jalaluddinrumi',
      '#shorts',
    ];
    const allTags = [...baseTags, ...(params.tags || [])];
    const uniqueTags = Array.from(new Set(allTags));

    // Build description with tags
    const descriptionWithTags = `${params.description}\n\n${uniqueTags.join(' ')}`;

    // Check if draft mode is enabled
    const useDraft = params.isDraft ?? (process.env.PUBLER_DRAFT_MODE === 'true');

    if (useDraft) {
      // In draft mode, create a draft instead of publishing
      return this.createYouTubeShort({ ...params, isDraft: true });
    }

    const body = {
      account_ids: [params.accountId],
      media_ids: params.mediaIds,
      text: descriptionWithTags,
      platforms: {
        youtube: {
          title: params.title,
          description: descriptionWithTags,
          privacy: 'public',
          type: 'short',
          tags: uniqueTags.map(t => t.replace('#', '')),
        },
      },
    };

    console.log(`[Publer] Publishing now - Tags: ${uniqueTags.join(', ')}`);

    const response = await fetch(`${this.baseUrl}/posts/schedule/publish`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Publish failed: ${error}`);
    }

    const result = await response.json();
    return { jobId: result.job_id || result.id };
  }
}

/**
 * Create a PublerService instance from settings
 */
export async function createPublerService(
  apiKey: string,
  workspaceId: string
): Promise<PublerService> {
  return new PublerService(apiKey, workspaceId);
}

/**
 * Get Publer credentials from environment variables or database settings
 */
export function getPublerCredentials(dbSettings?: {
  apiKey?: string | null;
  workspaceId?: string | null;
}): { apiKey: string; workspaceId: string } | null {
  // Priority: env vars > database settings
  const apiKey = process.env.PUBLER_KEY || dbSettings?.apiKey;
  const workspaceId = process.env.PUBLER_WORKSPACE_ID || dbSettings?.workspaceId;

  if (!apiKey || !workspaceId) {
    return null;
  }

  return { apiKey, workspaceId };
}

/**
 * Create a PublerService instance using env vars with database fallback
 */
export async function createPublerServiceFromEnv(dbSettings?: {
  apiKey?: string | null;
  workspaceId?: string | null;
}): Promise<PublerService | null> {
  const credentials = getPublerCredentials(dbSettings);
  if (!credentials) {
    return null;
  }
  return new PublerService(credentials.apiKey, credentials.workspaceId);
}
