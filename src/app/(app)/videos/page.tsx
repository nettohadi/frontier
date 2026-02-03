'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Play,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  X,
  Clock,
  Video,
  Upload,
  Youtube,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GenerateModal, type GenerateConfig } from '@/components/GenerateModal';
import { cn } from '@/lib/utils';

interface VideoItem {
  id: string;
  topic: string;
  title: string | null;
  status: string;
  outputPath: string | null;
  errorMessage: string | null;
  createdAt: string;
  uploadedToYouTube: boolean;
  topicRelation: { name: string } | null;
  uploadSchedule: {
    id: string;
    status: string;
    progress: number;
  } | null;
}

const statusConfig: Record<
  string,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
  }
> = {
  PENDING: { label: 'Pending', variant: 'secondary' },
  GENERATING_SCRIPT: { label: 'Generating Script', variant: 'info' },
  GENERATING_IMAGE_PROMPTS: { label: 'Creating Prompts', variant: 'info' },
  GENERATING_IMAGES: { label: 'Generating Images', variant: 'info' },
  GENERATING_AUDIO: { label: 'Generating Audio', variant: 'info' },
  GENERATING_SRT: { label: 'Generating Subtitles', variant: 'info' },
  RENDERING: { label: 'Rendering Video', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  FAILED: { label: 'Failed', variant: 'destructive' },
};

function isProcessing(status: string): boolean {
  return [
    'PENDING',
    'GENERATING_SCRIPT',
    'GENERATING_IMAGE_PROMPTS',
    'GENERATING_IMAGES',
    'GENERATING_AUDIO',
    'GENERATING_SRT',
    'RENDERING',
  ].includes(status);
}

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [inlinePlayingId, setInlinePlayingId] = useState<string | null>(null);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [uploadingVideoId, setUploadingVideoId] = useState<string | null>(null);
  const playStartedRef = useRef<string | null>(null);

  const fetchVideos = async () => {
    try {
      const res = await fetch('/api/videos?limit=20');
      const data = await res.json();
      setVideos(data.videos || []);
    } catch (err) {
      console.error('Failed to fetch videos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
    const interval = setInterval(fetchVideos, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleBatchGenerate = async (config: GenerateConfig) => {
    setGenerateModalOpen(false);
    setCreating(true);
    try {
      const res = await fetch('/api/videos/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: config.count,
          autoUpload: config.uploadMode !== 'none',
          uploadMode: config.uploadMode === 'none' ? null : config.uploadMode,
        }),
      });
      if (res.ok) {
        fetchVideos();
      }
    } catch (err) {
      console.error('Failed to create videos:', err);
    } finally {
      setCreating(false);
    }
  };

  const scheduleUpload = async (videoId: string) => {
    setUploadingVideoId(videoId);
    try {
      const res = await fetch('/api/upload/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });
      if (res.ok) {
        fetchVideos();
      }
    } catch (err) {
      console.error('Failed to schedule upload:', err);
    } finally {
      setUploadingVideoId(null);
    }
  };

  const triggerUploadNow = async (scheduleId: string) => {
    setUploadingVideoId(scheduleId);
    try {
      const res = await fetch('/api/upload/youtube/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId }),
      });
      if (res.ok) {
        fetchVideos();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to start upload');
      }
    } catch (err) {
      console.error('Failed to start upload:', err);
    } finally {
      setUploadingVideoId(null);
    }
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString();

  return (
    <>
      <GenerateModal
        open={generateModalOpen}
        onOpenChange={setGenerateModalOpen}
        onGenerate={handleBatchGenerate}
        isGenerating={creating}
      />

      <header className="bg-background/95 sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur md:h-16 md:px-6">
        <h1 className="text-lg font-semibold md:text-xl">All Videos</h1>
        <Button
          onClick={() => setGenerateModalOpen(true)}
          disabled={creating}
          size="sm"
          className="from-primary hover:from-primary/90 md:size-default gap-2 bg-gradient-to-r to-violet-600 hover:to-violet-600/90"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">{creating ? 'Generating...' : 'Generate Video'}</span>
          <span className="sm:hidden">{creating ? '...' : 'Generate'}</span>
        </Button>
      </header>

      <div className="p-4 md:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Video className="text-muted-foreground/50 mb-4 h-16 w-16" />
            <p className="text-lg font-medium">No videos yet</p>
            <p className="text-muted-foreground">
              Click "Generate Video" to create your first video
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {videos.map((video) => {
              const isPlaying = inlinePlayingId === video.id;
              return (
                <Card
                  key={video.id}
                  className={cn(
                    'group overflow-hidden transition-all hover:shadow-lg',
                    video.status === 'FAILED' && 'border-red-500/50',
                    isPlaying && 'ring-primary ring-2'
                  )}
                >
                  <div className="bg-muted relative aspect-[9/16] overflow-hidden">
                    {video.outputPath && (
                      <>
                        {/* Lazy-loaded thumbnail - only loads when scrolled into view */}
                        {!isPlaying && (
                          <img
                            src={`/api/videos/${video.id}/thumbnail`}
                            alt={video.title || 'Video thumbnail'}
                            loading="lazy"
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        )}
                        {/* Video element only rendered when playing */}
                        {isPlaying && (
                          <video
                            ref={(el) => {
                              if (el && playStartedRef.current !== video.id) {
                                playStartedRef.current = video.id;
                                el.currentTime = 0;
                                el.play().catch(() => {});
                              }
                            }}
                            src={`/api/videos/${video.id}/stream`}
                            className="absolute inset-0 h-full w-full object-cover"
                            controls
                            preload="none"
                            onEnded={() => {
                              playStartedRef.current = null;
                              setInlinePlayingId(null);
                            }}
                          />
                        )}
                      </>
                    )}

                    {!isPlaying && (
                      <div
                        className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/20 transition-colors group-hover:bg-black/40"
                        onClick={() => video.outputPath && setInlinePlayingId(video.id)}
                      >
                        {video.outputPath ? (
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 text-white opacity-70 transition-opacity group-hover:opacity-100">
                            <Play className="h-7 w-7" />
                          </div>
                        ) : isProcessing(video.status) ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="text-primary h-10 w-10 animate-spin" />
                            <span className="text-muted-foreground text-xs font-medium">
                              {statusConfig[video.status]?.label}
                            </span>
                          </div>
                        ) : video.status === 'FAILED' ? (
                          <XCircle className="h-10 w-10 text-red-500" />
                        ) : (
                          <Video className="text-muted-foreground h-10 w-10" />
                        )}
                      </div>
                    )}

                    {isPlaying && (
                      <button
                        className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-black/90"
                        onClick={() => {
                          playStartedRef.current = null;
                          setInlinePlayingId(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}

                    {!isPlaying && (
                      <div className="absolute top-2 left-2">
                        <Badge
                          variant={statusConfig[video.status]?.variant || 'secondary'}
                          className="px-1.5 py-0.5 text-[10px]"
                        >
                          {statusConfig[video.status]?.label || video.status}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <CardContent className="p-3">
                    <h3 className="truncate text-sm font-medium">
                      {video.title || video.topicRelation?.name || video.topic}
                    </h3>
                    <p className="text-muted-foreground mt-0.5 truncate text-[10px]">
                      {video.topicRelation?.name || video.topic}
                    </p>
                    <p className="text-muted-foreground mt-1 flex items-center gap-1 text-[10px]">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDate(video.createdAt)}
                    </p>

                    {video.outputPath && (
                      <div className="mt-2 space-y-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-full gap-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `/api/videos/${video.id}/download`;
                          }}
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </Button>
                        {video.uploadedToYouTube ? (
                          <Badge variant="success" className="h-7 w-full justify-center gap-1">
                            <Youtube className="h-3 w-3" />
                            Uploaded
                          </Badge>
                        ) : video.uploadSchedule ? (
                          <>
                            <Badge
                              variant={
                                video.uploadSchedule.status === 'UPLOADING'
                                  ? 'warning'
                                  : video.uploadSchedule.status === 'FAILED'
                                    ? 'destructive'
                                    : 'info'
                              }
                              className="h-7 w-full justify-center gap-1"
                            >
                              <Upload className="h-3 w-3" />
                              {video.uploadSchedule.status === 'SCHEDULED'
                                ? 'Scheduled'
                                : video.uploadSchedule.status === 'UPLOADING'
                                  ? `${video.uploadSchedule.progress}%`
                                  : video.uploadSchedule.status}
                            </Badge>
                            {(video.uploadSchedule.status === 'SCHEDULED' ||
                              video.uploadSchedule.status === 'FAILED') && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 w-full gap-1 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerUploadNow(video.uploadSchedule!.id);
                                }}
                                disabled={uploadingVideoId === video.uploadSchedule.id}
                              >
                                {uploadingVideoId === video.uploadSchedule.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Youtube className="h-3 w-3" />
                                )}
                                {video.uploadSchedule.status === 'FAILED' ? 'Retry' : 'Upload Now'}
                              </Button>
                            )}
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-full gap-1 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              scheduleUpload(video.id);
                            }}
                            disabled={uploadingVideoId === video.id}
                          >
                            {uploadingVideoId === video.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Youtube className="h-3 w-3" />
                            )}
                            YouTube
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
