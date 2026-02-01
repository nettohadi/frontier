'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Play,
  Download,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  FileText,
  Volume2,
  Subtitles,
  Film,
  Sparkles,
  Moon,
  Pencil,
  Trash2,
  Pause,
  PlayCircle,
  X,
  Clock,
  Video,
  Lightbulb,
  ImageIcon,
  LayoutGrid,
  Home,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

interface Theme {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  _count: {
    videos: number;
  };
}

interface VideoItem {
  id: string;
  topic: string;
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
  background: {
    name: string;
    filename: string;
  } | null;
  theme: {
    name: string;
  } | null;
}

type PageView = 'dashboard' | 'videos' | 'themes';

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

export default function Dashboard() {
  const [currentPage, setCurrentPage] = useState<PageView>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<VideoItem | null>(null);
  const [inlinePlayingId, setInlinePlayingId] = useState<string | null>(null);
  const playStartedRef = useRef<string | null>(null);

  // Theme management state
  const [themes, setThemes] = useState<Theme[]>([]);
  const [themesLoading, setThemesLoading] = useState(true);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [newTheme, setNewTheme] = useState({ name: '', description: '' });
  const [themeSaving, setThemeSaving] = useState(false);

  const fetchThemes = async () => {
    try {
      const res = await fetch('/api/themes');
      const data = await res.json();
      setThemes(data.themes || []);
    } catch (err) {
      console.error('Failed to fetch themes:', err);
    } finally {
      setThemesLoading(false);
    }
  };

  const createTheme = async () => {
    if (!newTheme.name.trim() || !newTheme.description.trim()) return;
    setThemeSaving(true);
    try {
      const res = await fetch('/api/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTheme),
      });
      if (res.ok) {
        setNewTheme({ name: '', description: '' });
        fetchThemes();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create theme');
      }
    } catch (err) {
      console.error('Failed to create theme:', err);
    } finally {
      setThemeSaving(false);
    }
  };

  const updateTheme = async (theme: Theme) => {
    setThemeSaving(true);
    try {
      const res = await fetch(`/api/themes/${theme.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: theme.name,
          description: theme.description,
          isActive: theme.isActive,
        }),
      });
      if (res.ok) {
        setEditingTheme(null);
        fetchThemes();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update theme');
      }
    } catch (err) {
      console.error('Failed to update theme:', err);
    } finally {
      setThemeSaving(false);
    }
  };

  const toggleThemeActive = async (theme: Theme) => {
    try {
      await fetch(`/api/themes/${theme.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !theme.isActive }),
      });
      fetchThemes();
    } catch (err) {
      console.error('Failed to toggle theme:', err);
    }
  };

  const deleteTheme = async (theme: Theme) => {
    if (!confirm(`Delete theme "${theme.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/themes/${theme.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchThemes();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete theme');
      }
    } catch (err) {
      console.error('Failed to delete theme:', err);
    }
  };

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
    fetchThemes();
    const interval = setInterval(fetchVideos, 3000);
    return () => clearInterval(interval);
  }, []);

  const createVideo = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ renderMode: 'AI_IMAGES' }),
      });
      if (res.ok) {
        fetchVideos();
      }
    } catch (err) {
      console.error('Failed to create video:', err);
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const activeThemeCount = themes.filter((t) => t.isActive).length;
  const completedVideos = videos.filter((v) => v.status === 'COMPLETED').length;
  const processingVideos = videos.filter((v) => isProcessing(v.status)).length;
  const failedVideos = videos.filter((v) => v.status === 'FAILED').length;

  const menuItems = [
    { id: 'dashboard' as PageView, label: 'Dashboard', icon: Home },
    { id: 'videos' as PageView, label: 'All Videos', icon: LayoutGrid },
    { id: 'themes' as PageView, label: 'Manage Themes', icon: Moon },
  ];

  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-background">
        {/* Video Player Modal */}
        <Dialog open={!!playingVideo} onOpenChange={() => setPlayingVideo(null)}>
          <DialogContent className="max-w-md p-0 overflow-hidden">
            <DialogHeader className="p-4 pb-0">
              <DialogTitle>{playingVideo?.theme?.name || playingVideo?.topic}</DialogTitle>
            </DialogHeader>
            <div className="relative aspect-[9/16] bg-black">
              {playingVideo && (
                <video
                  controls
                  autoPlay
                  className="h-full w-full"
                >
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

        {/* Sidebar */}
        <aside
          className={cn(
            'fixed left-0 top-0 z-40 h-screen border-r bg-card transition-all duration-300',
            sidebarCollapsed ? 'w-16' : 'w-64'
          )}
        >
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b px-4">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <span className="font-bold">Frontier</span>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-1 p-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <Tooltip key={item.id} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setCurrentPage(item.id)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {!sidebarCollapsed && <span>{item.label}</span>}
                      {!sidebarCollapsed && item.id === 'themes' && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {activeThemeCount}
                        </Badge>
                      )}
                      {!sidebarCollapsed && item.id === 'videos' && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {videos.length}
                        </Badge>
                      )}
                    </button>
                  </TooltipTrigger>
                  {sidebarCollapsed && (
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </nav>

          {/* Collapse button */}
          <div className="absolute bottom-4 left-0 right-0 px-2">
            <Separator className="mb-4" />
            <div className="flex items-center justify-between px-2">
              {!sidebarCollapsed && <ThemeToggle />}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className={cn('h-8 w-8', sidebarCollapsed && 'mx-auto')}
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main
          className={cn(
            'flex-1 transition-all duration-300',
            sidebarCollapsed ? 'ml-16' : 'ml-64'
          )}
        >
          {/* Header */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur">
            <h1 className="text-xl font-semibold">
              {currentPage === 'dashboard' && 'Dashboard'}
              {currentPage === 'videos' && 'All Videos'}
              {currentPage === 'themes' && 'Manage Themes'}
            </h1>
            <div className="flex items-center gap-3">
              {sidebarCollapsed && <ThemeToggle />}
              <Button
                onClick={createVideo}
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
            </div>
          </header>

          {/* Page Content */}
          <div className="p-6">
            {/* Dashboard View - List style with pipeline steps */}
            {currentPage === 'dashboard' && (
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

                {/* Video List with Pipeline Steps */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Video className="h-5 w-5" />
                      Generated Videos
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setCurrentPage('videos')}>
                      View All
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
                                <h3 className="font-semibold mb-2 truncate">{video.theme?.name || video.topic}</h3>
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

                            {/* Pipeline Progress with Icons */}
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
                              <div className="mt-4 flex gap-2">
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
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Videos View - Card grid with 9:16 aspect ratio */}
            {currentPage === 'videos' && (
              <div>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : videos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Video className="mb-4 h-16 w-16 text-muted-foreground/50" />
                    <p className="text-lg font-medium">No videos yet</p>
                    <p className="text-muted-foreground">
                      Click "Generate Video" to create your first video
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {videos.map((video) => {
                      const isPlaying = inlinePlayingId === video.id;
                      return (
                        <Card
                          key={video.id}
                          className={cn(
                            'overflow-hidden transition-all hover:shadow-lg group',
                            video.status === 'FAILED' && 'border-red-500/50',
                            isPlaying && 'ring-2 ring-primary'
                          )}
                        >
                          {/* 9:16 Aspect Ratio Container */}
                          <div className="relative aspect-[9/16] bg-muted overflow-hidden">
                            {/* Video Element - plays inline or shows thumbnail */}
                            {video.outputPath && (
                              <video
                                ref={(el) => {
                                  if (el && isPlaying && playStartedRef.current !== video.id) {
                                    playStartedRef.current = video.id;
                                    el.currentTime = 0;
                                    el.play().catch(() => {});
                                  }
                                }}
                                src={`/api/videos/${video.id}/stream`}
                                className="absolute inset-0 h-full w-full object-cover"
                                muted={!isPlaying}
                                controls={isPlaying}
                                preload="metadata"
                                onLoadedMetadata={(e) => {
                                  const videoEl = e.target as HTMLVideoElement;
                                  if (!isPlaying) {
                                    videoEl.currentTime = 1;
                                  }
                                }}
                                onEnded={() => {
                                  playStartedRef.current = null;
                                  setInlinePlayingId(null);
                                }}
                              />
                            )}

                            {/* Overlay for play button and processing states - hidden when playing */}
                            {!isPlaying && (
                              <div
                                className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors cursor-pointer"
                                onClick={() => video.outputPath && setInlinePlayingId(video.id)}
                              >
                                {video.outputPath ? (
                                  <div className="flex flex-col items-center gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 text-white">
                                      <Play className="h-7 w-7" />
                                    </div>
                                  </div>
                                ) : isProcessing(video.status) ? (
                                  <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                    <span className="text-xs text-muted-foreground font-medium">
                                      {statusConfig[video.status]?.label}
                                    </span>
                                  </div>
                                ) : video.status === 'FAILED' ? (
                                  <XCircle className="h-10 w-10 text-red-500" />
                                ) : (
                                  <Video className="h-10 w-10 text-muted-foreground" />
                                )}
                              </div>
                            )}

                            {/* Close button when playing */}
                            {isPlaying && (
                              <button
                                className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90 transition-colors z-10"
                                onClick={() => {
                                  playStartedRef.current = null;
                                  setInlinePlayingId(null);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}

                            {/* Status Badge - hidden when playing */}
                            {!isPlaying && (
                              <div className="absolute top-2 left-2">
                                <Badge
                                  variant={statusConfig[video.status]?.variant || 'secondary'}
                                  className="text-[10px] px-1.5 py-0.5"
                                >
                                  {statusConfig[video.status]?.label || video.status}
                                </Badge>
                              </div>
                            )}
                          </div>

                          <CardContent className="p-3">
                            <h3 className="font-medium text-sm truncate">
                              {video.theme?.name || video.topic}
                            </h3>
                            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              {formatDate(video.createdAt)}
                            </p>

                            {/* Download button for completed videos */}
                            {video.outputPath && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full mt-2 h-7 text-xs gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.href = `/api/videos/${video.id}/download`;
                                }}
                              >
                                <Download className="h-3 w-3" />
                                Download
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Themes View */}
            {currentPage === 'themes' && (
              <div className="space-y-6">
                {/* Add new theme */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Add New Theme
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      <Input
                        placeholder="Theme name (e.g., Mahabbah)"
                        value={newTheme.name}
                        onChange={(e) => setNewTheme({ ...newTheme, name: e.target.value })}
                        className="w-48"
                      />
                      <Input
                        placeholder="Description in Indonesian"
                        value={newTheme.description}
                        onChange={(e) => setNewTheme({ ...newTheme, description: e.target.value })}
                        className="min-w-[300px] flex-1"
                      />
                      <Button
                        onClick={createTheme}
                        disabled={themeSaving || !newTheme.name.trim() || !newTheme.description.trim()}
                        className="gap-2"
                      >
                        {themeSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        Add Theme
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Theme list */}
                <Card>
                  <CardHeader>
                    <CardTitle>All Themes ({themes.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {themesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : themes.length === 0 ? (
                      <p className="py-8 text-center text-muted-foreground">
                        No themes yet. Add one above!
                      </p>
                    ) : (
                      <ScrollArea className="h-[600px] pr-4">
                        <div className="space-y-2">
                          {themes.map((theme) => (
                            <div
                              key={theme.id}
                              className={cn(
                                'rounded-lg border p-4 transition-colors',
                                theme.isActive
                                  ? 'border-emerald-500/50 bg-emerald-500/5'
                                  : 'border-border bg-muted/30 opacity-60'
                              )}
                            >
                              {editingTheme?.id === theme.id ? (
                                <div className="space-y-3">
                                  <Input
                                    value={editingTheme.name}
                                    onChange={(e) =>
                                      setEditingTheme({ ...editingTheme, name: e.target.value })
                                    }
                                    className="font-medium"
                                  />
                                  <Textarea
                                    value={editingTheme.description}
                                    onChange={(e) =>
                                      setEditingTheme({ ...editingTheme, description: e.target.value })
                                    }
                                    rows={3}
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => updateTheme(editingTheme)}
                                      disabled={themeSaving}
                                    >
                                      {themeSaving ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        'Save'
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setEditingTheme(null)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                      <span className="font-medium">{theme.name}</span>
                                      <Badge variant={theme.isActive ? 'success' : 'secondary'}>
                                        {theme.isActive ? 'Active' : 'Inactive'}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        Used: {theme.usageCount}x
                                      </span>
                                      {theme._count.videos > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                          • {theme._count.videos} video
                                          {theme._count.videos > 1 ? 's' : ''}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                      {theme.description}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8"
                                          onClick={() => toggleThemeActive(theme)}
                                        >
                                          {theme.isActive ? (
                                            <Pause className="h-4 w-4" />
                                          ) : (
                                            <PlayCircle className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {theme.isActive ? 'Deactivate' : 'Activate'}
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8"
                                          onClick={() => setEditingTheme(theme)}
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Edit</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8 text-destructive hover:text-destructive"
                                          onClick={() => deleteTheme(theme)}
                                          disabled={theme._count.videos > 0}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {theme._count.videos > 0 ? 'Cannot delete (has videos)' : 'Delete'}
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
