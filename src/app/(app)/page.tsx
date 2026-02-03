'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Play,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  FileText,
  Volume2,
  Subtitles,
  Film,
  Sparkles,
  X,
  Clock,
  Video,
  Lightbulb,
  ImageIcon,
  Upload,
  Youtube,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { GenerateModal, type GenerateConfig } from '@/components/GenerateModal';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface VideoItem {
  id: string;
  topic: string;
  title: string | null;
  description: string | null;
  style: string;
  status: string;
  script: string | null;
  audioPath: string | null;
  srtPath: string | null;
  outputPath: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  renderMode: 'BACKGROUND_VIDEO' | 'AI_IMAGES';
  uploadedToYouTube: boolean;
  background: {
    name: string;
    filename: string;
  } | null;
  topicRelation: {
    name: string;
  } | null;
  uploadSchedule: {
    id: string;
    status: string;
    scheduledAt: string;
    youtubeUrl: string | null;
    progress: number;
  } | null;
}

const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' }
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

const pipelineSteps = [
  { key: 'script', label: 'Script', icon: FileText, status: 'GENERATING_SCRIPT' },
  { key: 'imagePrompts', label: 'Prompts', icon: Lightbulb, status: 'GENERATING_IMAGE_PROMPTS' },
  { key: 'images', label: 'Images', icon: ImageIcon, status: 'GENERATING_IMAGES' },
  { key: 'audio', label: 'Audio', icon: Volume2, status: 'GENERATING_AUDIO' },
  { key: 'srt', label: 'Subtitles', icon: Subtitles, status: 'GENERATING_SRT' },
  { key: 'render', label: 'Render', icon: Film, status: 'RENDERING' },
];

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

function getStepState(
  video: VideoItem,
  step: { key: string; status: string }
): 'completed' | 'active' | 'pending' {
  const statusOrder = [
    'PENDING',
    'GENERATING_SCRIPT',
    'GENERATING_IMAGE_PROMPTS',
    'GENERATING_IMAGES',
    'GENERATING_AUDIO',
    'GENERATING_SRT',
    'RENDERING',
    'COMPLETED',
  ];

  const currentIndex = statusOrder.indexOf(video.status);
  const stepIndex = statusOrder.indexOf(step.status);

  if (video.status === 'FAILED') {
    if (step.key === 'script' && video.script) return 'completed';
    if (step.key === 'audio' && video.audioPath) return 'completed';
    if (step.key === 'srt' && video.srtPath) return 'completed';
    if (step.key === 'render' && video.outputPath) return 'completed';
    return 'pending';
  }

  if (video.status === 'COMPLETED') return 'completed';
  if (currentIndex > stepIndex) return 'completed';
  if (currentIndex === stepIndex) return 'active';
  return 'pending';
}

export default function DashboardPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<VideoItem | null>(null);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [uploadingVideoId, setUploadingVideoId] = useState<string | null>(null);

  const fetchVideos = async () => {
    try {
      const res = await fetch('/api/videos?limit=50');
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
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create videos');
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
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to schedule upload');
      }
    } catch (err) {
      console.error('Failed to schedule upload:', err);
    } finally {
      setUploadingVideoId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const completedVideos = videos.filter((v) => v.status === 'COMPLETED').length;
  const processingVideos = videos.filter((v) => isProcessing(v.status)).length;
  const failedVideos = videos.filter((v) => v.status === 'FAILED').length;

  return (
    <>
      {/* Video Player Modal */}
      <Dialog open={!!playingVideo} onOpenChange={() => setPlayingVideo(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>{playingVideo?.title || playingVideo?.topicRelation?.name || playingVideo?.topic}</DialogTitle>
            {playingVideo?.title && (
              <p className="text-sm text-muted-foreground">{playingVideo?.topicRelation?.name || playingVideo?.topic}</p>
            )}
          </DialogHeader>
          <div className="relative aspect-[9/16] bg-black">
            {playingVideo && (
              <video controls autoPlay className="h-full w-full">
                <source src={`/api/videos/${playingVideo.id}/stream`} type="video/mp4" />
              </video>
            )}
          </div>
          <div className="p-4 pt-2 flex gap-2">
            <Button size="sm" variant="outline" asChild className="flex-1 gap-1">
              <a href={playingVideo ? `/api/videos/${playingVideo.id}/download` : '#'}>
                <Download className="h-4 w-4" />
                Download
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate Video Modal */}
      <GenerateModal
        open={generateModalOpen}
        onOpenChange={setGenerateModalOpen}
        onGenerate={handleBatchGenerate}
        isGenerating={creating}
      />

      {/* Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Button
          onClick={() => setGenerateModalOpen(true)}
          disabled={creating}
          className="gap-2 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90"
        >
          {creating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Video
            </>
          )}
        </Button>
      </header>

      {/* Page Content */}
      <div className="p-6">
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                  <Video className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{videos.length}</p>
                  <p className="text-sm text-muted-foreground">Total Videos</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{completedVideos}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-orange-500/10">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/20">
                  {processingVideos > 0 ? (
                    <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                  ) : (
                    <Clock className="h-6 w-6 text-orange-500" />
                  )}
                </div>
                <div>
                  <p className="text-2xl font-bold">{processingVideos}</p>
                  <p className="text-sm text-muted-foreground">Processing</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-500/20 bg-gradient-to-br from-red-500/5 to-red-500/10">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
                  <XCircle className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{failedVideos}</p>
                  <p className="text-sm text-muted-foreground">Failed</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Video List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Generated Videos
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/videos">View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : videos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Video className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-lg font-medium">No videos yet</p>
                  <p className="text-sm text-muted-foreground">
                    Create your first video above to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {videos.map((video) => (
                    <div
                      key={video.id}
                      className={cn(
                        'rounded-lg border p-4 transition-colors',
                        video.status === 'FAILED' && 'border-red-500/50 bg-red-500/5'
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold mb-1 truncate">{video.title || video.topicRelation?.name || video.topic}</h3>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="text-xs text-muted-foreground">
                              {video.topicRelation?.name || video.topic}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={statusConfig[video.status]?.variant || 'secondary'}
                              className={cn(
                                'gap-1',
                                isProcessing(video.status) && 'animate-pulse'
                              )}
                            >
                              {isProcessing(video.status) && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                              {statusConfig[video.status]?.label || video.status}
                            </Badge>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatDate(video.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Pipeline Progress */}
                      <div className="mt-4 flex items-center gap-1 rounded-lg bg-muted/50 p-3">
                        {pipelineSteps.map((step, index, arr) => {
                          const state = getStepState(video, step);
                          const Icon = step.icon;
                          return (
                            <div key={step.key} className="flex items-center">
                              <Tooltip>
                                <TooltipTrigger>
                                  <div
                                    className={cn(
                                      'flex flex-col items-center rounded-md px-2 py-1.5 transition-colors',
                                      state === 'active' &&
                                        'bg-primary text-primary-foreground animate-pulse',
                                      state === 'completed' &&
                                        'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
                                      state === 'pending' && 'text-muted-foreground'
                                    )}
                                  >
                                    {state === 'completed' ? (
                                      <CheckCircle2 className="h-5 w-5" />
                                    ) : state === 'active' ? (
                                      <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                      <Icon className="h-5 w-5" />
                                    )}
                                    <span className="mt-0.5 text-[10px] font-medium">
                                      {step.label}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>{step.label}</TooltipContent>
                              </Tooltip>
                              {index < arr.length - 1 && (
                                <div
                                  className={cn(
                                    'mx-0.5 h-0.5 w-4 rounded-full',
                                    state === 'completed' ? 'bg-emerald-500' : 'bg-muted'
                                  )}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Error Message */}
                      {video.errorMessage && (
                        <div className="mt-3 rounded-lg border border-red-500/50 bg-red-500/10 p-3">
                          <p className="text-sm text-red-600 dark:text-red-400">
                            {video.errorMessage}
                          </p>
                        </div>
                      )}

                      {/* Video Actions */}
                      {video.outputPath && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => setPlayingVideo(video)}
                            className="gap-2"
                          >
                            <Play className="h-4 w-4" />
                            Play Video
                          </Button>
                          <Button size="sm" variant="outline" asChild className="gap-2">
                            <a href={`/api/videos/${video.id}/download`}>
                              <Download className="h-4 w-4" />
                              Download
                            </a>
                          </Button>
                          {video.uploadedToYouTube ? (
                            <Badge variant="success" className="gap-1 h-8 px-3">
                              <Youtube className="h-3 w-3" />
                              Uploaded
                            </Badge>
                          ) : video.uploadSchedule ? (
                            <Badge
                              variant={
                                video.uploadSchedule.status === 'UPLOADING'
                                  ? 'warning'
                                  : video.uploadSchedule.status === 'FAILED'
                                  ? 'destructive'
                                  : 'info'
                              }
                              className="gap-1 h-8 px-3"
                            >
                              <Upload className="h-3 w-3" />
                              {video.uploadSchedule.status === 'SCHEDULED'
                                ? 'Scheduled'
                                : video.uploadSchedule.status === 'UPLOADING'
                                ? `Uploading ${video.uploadSchedule.progress}%`
                                : video.uploadSchedule.status}
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={() => scheduleUpload(video.id)}
                              disabled={uploadingVideoId === video.id}
                            >
                              {uploadingVideoId === video.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Youtube className="h-4 w-4" />
                              )}
                              Upload to YouTube
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
