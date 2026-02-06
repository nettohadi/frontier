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

export interface CreateMultiPlatformPostParams {
  youtubeAccountId?: string;
  tiktokAccountId?: string;
  mediaIds: string[];
  title: string;
  description: string;
  tags?: string[];
  scheduleAt?: Date;
  isShort?: boolean;
  isDraft?: boolean;
}

/**
 * Publer API Service for social media uploads
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
   * Get all connected accounts (YouTube + TikTok) in a single API call
   */
  async getAllAccounts(): Promise<{ youtube: YouTubeChannel[]; tiktok: YouTubeChannel[] }> {
    const response = await fetch(`${this.baseUrl}/accounts`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch accounts: ${error}`);
    }

    const accounts = await response.json();

    const mapAccount = (a: { id: string; name: string; provider: string; avatar?: string }): YouTubeChannel => ({
      id: a.id,
      name: a.name,
      platform: a.provider,
      avatar: a.avatar,
    });

    return {
      youtube: accounts.filter((a: { provider: string }) => a.provider === 'youtube').map(mapAccount),
      tiktok: accounts.filter((a: { provider: string }) => a.provider === 'tiktok').map(mapAccount),
    };
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
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

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
    const useDraft = params.isDraft ?? process.env.PUBLER_DRAFT_MODE === 'true';
    const state = useDraft ? 'draft_private' : 'scheduled';

    // Determine if we're doing immediate or future scheduled publishing
    const minFutureTime = new Date(Date.now() + 60 * 1000); // 1 minute from now
    const isFutureScheduled =
      params.scheduleAt && params.scheduleAt.getTime() > minFutureTime.getTime();

    // Use /publish endpoint for immediate publishing, /schedule for drafts and future scheduled
    const usePublishEndpoint = !useDraft && !isFutureScheduled;

    // Build account object - only include scheduled_at for future scheduled posts
    const accountObj: { id: string; scheduled_at?: string } = { id: params.accountId };
    if (isFutureScheduled && params.scheduleAt) {
      accountObj.scheduled_at = params.scheduleAt.toISOString();
    }

    // Build request body using Publer's correct format for YouTube Shorts
    // Per Publer API docs: description goes inside youtube network object only
    const body = {
      bulk: {
        state,
        posts: [
          {
            accounts: [accountObj],
            networks: {
              youtube: {
                type: 'video',
                isShort: params.isShort !== false,
                media: params.mediaIds.map((id) => ({ id, type: 'video' })),
                title: params.title,
                text: descriptionWithTags,
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
    console.log(
      `[Publer] Mode: ${state}, Endpoint: ${endpoint}${isFutureScheduled ? ` (scheduled for ${params.scheduleAt?.toISOString()})` : ' (immediate)'}, Tags: ${uniqueTags.join(', ')}`
    );

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
   * Create a multi-platform post (YouTube + TikTok)
   * At least one platform account must be provided.
   */
  async createMultiPlatformPost(params: CreateMultiPlatformPostParams): Promise<{ jobId: string }> {
    if (!params.youtubeAccountId && !params.tiktokAccountId) {
      throw new Error('At least one platform account must be provided');
    }

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
    const descriptionWithTags = `${params.description}\n\n${uniqueTags.join(' ')}`;

    const useDraft = params.isDraft ?? process.env.PUBLER_DRAFT_MODE === 'true';
    const state = useDraft ? 'draft_private' : 'scheduled';

    const minFutureTime = new Date(Date.now() + 60 * 1000);
    const isFutureScheduled =
      params.scheduleAt && params.scheduleAt.getTime() > minFutureTime.getTime();
    const usePublishEndpoint = !useDraft && !isFutureScheduled;

    // Build accounts array (only include configured platforms)
    const accounts: Array<{ id: string; scheduled_at?: string }> = [];
    if (params.youtubeAccountId) {
      const acct: { id: string; scheduled_at?: string } = { id: params.youtubeAccountId };
      if (isFutureScheduled && params.scheduleAt) {
        acct.scheduled_at = params.scheduleAt.toISOString();
      }
      accounts.push(acct);
    }
    if (params.tiktokAccountId) {
      const acct: { id: string; scheduled_at?: string } = { id: params.tiktokAccountId };
      if (isFutureScheduled && params.scheduleAt) {
        acct.scheduled_at = params.scheduleAt.toISOString();
      }
      accounts.push(acct);
    }

    // Build networks object (only include configured platforms)
    const networks: Record<string, unknown> = {};
    if (params.youtubeAccountId) {
      networks.youtube = {
        type: 'video',
        isShort: params.isShort !== false,
        media: params.mediaIds.map((id) => ({ id, type: 'video' })),
        title: params.title,
        text: descriptionWithTags,
        privacy: 'public',
        tags: uniqueTags.map((t) => t.replace('#', '')),
      };
    }
    if (params.tiktokAccountId) {
      networks.tiktok = {
        type: 'video',
        media: params.mediaIds.map((id) => ({ id, type: 'video' })),
        text: descriptionWithTags,
        details: {
          privacy: 'PUBLIC_TO_EVERYONE',
          comment: true,
          duet: true,
          stitch: true,
        },
      };
    }

    const body = {
      bulk: {
        state,
        posts: [{ accounts, networks }],
      },
    };

    const endpoint = usePublishEndpoint ? '/posts/schedule/publish' : '/posts/schedule';
    const platforms = [params.youtubeAccountId && 'YouTube', params.tiktokAccountId && 'TikTok']
      .filter(Boolean)
      .join(' + ');
    console.log(`[Publer] Creating ${platforms} post:`, JSON.stringify(body, null, 2));
    console.log(
      `[Publer] Mode: ${state}, Endpoint: ${endpoint}${isFutureScheduled ? ` (scheduled for ${params.scheduleAt?.toISOString()})` : ' (immediate)'}`
    );

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
    const useDraft = params.isDraft ?? process.env.PUBLER_DRAFT_MODE === 'true';

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
                tags: uniqueTags.map((t) => t.replace('#', '')),
              },
            },
          },
        ],
      },
    };

    console.log(
      `[Publer] Scheduling post - Mode: ${useDraft ? 'draft' : 'scheduled'}, Tags: ${uniqueTags.join(', ')}`
    );

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
    } else if (
      result.status === 'complete' ||
      result.status === 'completed' ||
      result.state === 'published_posted'
    ) {
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
   * Delete a scheduled post from Publer
   * @param postId The Publer post/job ID to delete
   * @returns true if deleted successfully, false if not found or already deleted
   */
  async deletePost(postId: string): Promise<boolean> {
    try {
      console.log(`[Publer] Deleting post: ${postId}`);

      const response = await fetch(`${this.baseUrl}/posts/${postId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (response.ok) {
        console.log(`[Publer] Post ${postId} deleted successfully`);
        return true;
      }

      // 404 means post not found (already deleted or never existed)
      if (response.status === 404) {
        console.log(`[Publer] Post ${postId} not found (may already be deleted)`);
        return true;
      }

      const error = await response.text();
      console.error(`[Publer] Failed to delete post ${postId}: ${error}`);
      return false;
    } catch (error) {
      console.error(`[Publer] Error deleting post ${postId}:`, error);
      return false;
    }
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
    const useDraft = params.isDraft ?? process.env.PUBLER_DRAFT_MODE === 'true';

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
          tags: uniqueTags.map((t) => t.replace('#', '')),
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
 * Get Publer credentials from database settings
 */
export function getPublerCredentials(dbSettings?: {
  apiKey?: string | null;
  workspaceId?: string | null;
}): { apiKey: string; workspaceId: string } | null {
  const apiKey = dbSettings?.apiKey;
  const workspaceId = dbSettings?.workspaceId;

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
