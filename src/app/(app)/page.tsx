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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScheduleUploadModal, useScheduleUploadModal } from '@/components/ScheduleUploadModal';
import { GenerateVideoDropdown } from '@/components/GenerateVideoDropdown';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
  validationPassed: boolean | null;
  validationAttempts: number | null;
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
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
  }
> = {
  PENDING: { label: 'Pending', variant: 'secondary' },
  GENERATING_SCRIPT: { label: 'Generating Script', variant: 'info' },
  VALIDATING_SCRIPT: { label: 'Validating Script', variant: 'info' },
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
  { key: 'validation', label: 'Validation', icon: CheckCircle2, status: 'VALIDATING_SCRIPT' },
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
    'VALIDATING_SCRIPT',
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
    'VALIDATING_SCRIPT',
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
    if (step.key === 'validation' && video.script) return 'completed';
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
  const router = useRouter();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingVideo, setPlayingVideo] = useState<VideoItem | null>(null);
  const [uploadingVideoId, setUploadingVideoId] = useState<string | null>(null);
  const { modalState: scheduleModal, openModal: openScheduleModal, setModalOpen: setScheduleModalOpen } = useScheduleUploadModal();

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
        <DialogContent className="flex h-[90dvh] max-w-md flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 p-4 pb-2">
            <DialogTitle>
              {playingVideo?.title || playingVideo?.topicRelation?.name || playingVideo?.topic}
            </DialogTitle>
            {playingVideo?.title && (
              <p className="text-muted-foreground text-sm">
                {playingVideo?.topicRelation?.name || playingVideo?.topic}
              </p>
            )}
          </DialogHeader>
          <div className="relative min-h-0 flex-1 bg-black">
            {playingVideo && (
              <video controls autoPlay className="h-full w-full object-contain">
                <source src={`/api/videos/${playingVideo.id}/stream`} type="video/mp4" />
              </video>
            )}
          </div>
          <div className="flex shrink-0 gap-2 p-4 pt-2">
            <Button size="sm" variant="outline" asChild className="flex-1 gap-1">
              <a href={playingVideo ? `/api/videos/${playingVideo.id}/download` : '#'}>
                <Download className="h-4 w-4" />
                Download
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule Upload Modal */}
      <ScheduleUploadModal
        open={scheduleModal.open}
        onOpenChange={setScheduleModalOpen}
        videoId={scheduleModal.videoId}
        videoTitle={scheduleModal.videoTitle}
        onSuccess={fetchVideos}
      />

      {/* Header */}
      <header className="bg-background/95 sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur md:h-16 md:px-6">
        <h1 className="text-lg font-semibold md:text-xl">Dashboard</h1>
        <GenerateVideoDropdown onRefresh={fetchVideos} />
      </header>

      {/* Page Content */}
      <div className="overflow-x-hidden p-4 md:p-6 w-full max-w-full">
        <div className="space-y-4 md:space-y-6 w-full max-w-full">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:gap-4">
            <Card className="border-primary/20 from-primary/5 to-primary/10 bg-gradient-to-br">
              <CardContent className="flex flex-col items-center justify-center p-3 md:flex-row md:gap-4 md:p-6">
                <div className="bg-primary/20 flex h-8 w-8 items-center justify-center rounded-full md:h-12 md:w-12">
                  <Video className="text-primary h-4 w-4 md:h-6 md:w-6" />
                </div>
                <div className="mt-1 text-center md:mt-0 md:text-left">
                  <p className="text-lg font-bold md:text-2xl">{videos.length}</p>
                  <p className="text-muted-foreground text-[10px] md:text-sm">Total</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10">
              <CardContent className="flex flex-col items-center justify-center p-3 md:flex-row md:gap-4 md:p-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 md:h-12 md:w-12">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 md:h-6 md:w-6" />
                </div>
                <div className="mt-1 text-center md:mt-0 md:text-left">
                  <p className="text-lg font-bold md:text-2xl">{completedVideos}</p>
                  <p className="text-muted-foreground text-[10px] md:text-sm">Done</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-orange-500/10">
              <CardContent className="flex flex-col items-center justify-center p-3 md:flex-row md:gap-4 md:p-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/20 md:h-12 md:w-12">
                  {processingVideos > 0 ? (
                    <Loader2 className="h-4 w-4 animate-spin text-orange-500 md:h-6 md:w-6" />
                  ) : (
                    <Clock className="h-4 w-4 text-orange-500 md:h-6 md:w-6" />
                  )}
                </div>
                <div className="mt-1 text-center md:mt-0 md:text-left">
                  <p className="text-lg font-bold md:text-2xl">{processingVideos}</p>
                  <p className="text-muted-foreground text-[10px] md:text-sm">Active</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-500/20 bg-gradient-to-br from-red-500/5 to-red-500/10">
              <CardContent className="flex flex-col items-center justify-center p-3 md:flex-row md:gap-4 md:p-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 md:h-12 md:w-12">
                  <XCircle className="h-4 w-4 text-red-500 md:h-6 md:w-6" />
                </div>
                <div className="mt-1 text-center md:mt-0 md:text-left">
                  <p className="text-lg font-bold md:text-2xl">{failedVideos}</p>
                  <p className="text-muted-foreground text-[10px] md:text-sm">Failed</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Video List */}
          <Card className="overflow-hidden max-w-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Generated Videos
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/videos">View All</Link>
              </Button>
            </CardHeader>
            <CardContent className="overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
                </div>
              ) : videos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Video className="text-muted-foreground/50 mb-4 h-12 w-12" />
                  <p className="text-lg font-medium">No videos yet</p>
                  <p className="text-muted-foreground text-sm">
                    Create your first video above to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-3 md:space-y-4 min-w-0">
                  {videos.map((video) => (
                    <div
                      key={video.id}
                      onClick={() => router.push(`/videos/${video.id}`)}
                      className={cn(
                        'rounded-lg border p-3 transition-colors md:p-4 cursor-pointer hover:bg-muted/50 overflow-hidden min-w-0 w-full',
                        video.status === 'FAILED' && 'border-red-500/50 bg-red-500/5'
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4 min-w-0 w-full">
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <h3 className="mb-1 truncate font-semibold">
                            {video.title || video.topicRelation?.name || video.topic}
                          </h3>
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="text-muted-foreground text-xs">
                              {video.topicRelation?.name || video.topic}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                            <Badge
                              variant={statusConfig[video.status]?.variant || 'secondary'}
                              className={cn('gap-1 text-[10px] md:text-xs', isProcessing(video.status) && 'animate-pulse')}
                            >
                              {isProcessing(video.status) && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                              {statusConfig[video.status]?.label || video.status}
                            </Badge>
                            {video.validationPassed !== null && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge
                                    variant={video.validationPassed ? 'success' : 'destructive'}
                                    className="gap-1 text-[10px] md:text-xs"
                                  >
                                    {video.validationPassed ? (
                                      <CheckCircle2 className="h-3 w-3" />
                                    ) : (
                                      <XCircle className="h-3 w-3" />
                                    )}
                                    Validation
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {video.validationPassed
                                    ? 'Script validation passed'
                                    : `Script has issues (${video.validationAttempts} attempts)`}
                                </TooltipContent>
                              </Tooltip>
                            )}
                            <span className="text-muted-foreground flex items-center gap-1 text-[10px] md:text-xs">
                              <Clock className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[100px] md:max-w-none">{formatDate(video.createdAt)}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Pipeline Progress */}
                      <div className="bg-muted/50 mt-3 flex items-center overflow-hidden rounded-lg p-1.5 md:mt-4 md:p-3">
                        {pipelineSteps.map((step, index, arr) => {
                          const state = getStepState(video, step);
                          const nextState =
                            index < arr.length - 1 ? getStepState(video, arr[index + 1]) : null;
                          const Icon = step.icon;
                          return (
                            <div key={step.key} className="flex flex-1 items-center min-w-0">
                              <Tooltip>
                                <TooltipTrigger>
                                  <div
                                    className={cn(
                                      'flex flex-col items-center rounded-md px-1 py-1 transition-colors md:px-2 md:py-1.5 min-w-0',
                                      state === 'active' &&
                                        'bg-primary text-primary-foreground animate-pulse',
                                      state === 'completed' &&
                                        'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
                                      state === 'pending' && 'text-muted-foreground'
                                    )}
                                  >
                                    {state === 'completed' ? (
                                      <CheckCircle2 className="h-3.5 w-3.5 md:h-5 md:w-5" />
                                    ) : state === 'active' ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin md:h-5 md:w-5" />
                                    ) : (
                                      <Icon className="h-3.5 w-3.5 md:h-5 md:w-5" />
                                    )}
                                    <span className="mt-0.5 hidden text-[10px] font-medium sm:block">
                                      {step.label}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>{step.label}</TooltipContent>
                              </Tooltip>
                              {index < arr.length - 1 && (
                                <div
                                  className={cn(
                                    'mx-0.5 h-0.5 flex-1 min-w-0 rounded-full md:mx-2',
                                    state === 'completed' && nextState === 'completed'
                                      ? 'bg-emerald-500'
                                      : state === 'completed'
                                        ? 'to-muted bg-gradient-to-r from-emerald-500'
                                        : 'bg-muted'
                                  )}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Error Message */}
                      {video.errorMessage && (
                        <div className="mt-2 rounded-lg border border-red-500/50 bg-red-500/10 p-2 md:mt-3 md:p-3">
                          <p className="text-xs text-red-600 md:text-sm dark:text-red-400">
                            {video.errorMessage}
                          </p>
                        </div>
                      )}

                      {/* Video Actions */}
                      {video.outputPath && (
                        <div className="mt-3 flex flex-wrap items-center gap-1.5 md:mt-4 md:gap-2">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlayingVideo(video);
                            }}
                            className="h-8 gap-1.5 px-3 text-xs md:gap-2 md:text-sm"
                          >
                            <Play className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            Play
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 px-3 text-xs md:gap-2 md:text-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = `/api/videos/${video.id}/download`;
                            }}
                          >
                            <Download className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            <span className="hidden sm:inline">Download</span>
                          </Button>
                          {video.uploadedToYouTube ? (
                            <Badge variant="success" className="h-8 gap-1 px-2.5 text-xs">
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
                                className="h-8 gap-1 px-2.5 text-xs"
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
                                  className="h-8 gap-1.5 px-3 text-xs md:gap-2 md:text-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerUploadNow(video.uploadSchedule!.id);
                                  }}
                                  disabled={uploadingVideoId === video.uploadSchedule.id}
                                >
                                  {uploadingVideoId === video.uploadSchedule.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin md:h-4 md:w-4" />
                                  ) : (
                                    <Youtube className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                  )}
                                  <span className="hidden sm:inline">
                                    {video.uploadSchedule.status === 'FAILED' ? 'Retry' : 'Upload Now'}
                                  </span>
                                </Button>
                              )}
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5 px-3 text-xs md:gap-2 md:text-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openScheduleModal(
                                  video.id,
                                  video.title || video.topicRelation?.name || video.topic
                                );
                              }}
                            >
                              <Youtube className="h-3.5 w-3.5 md:h-4 md:w-4" />
                              <span className="hidden sm:inline">Upload</span>
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
