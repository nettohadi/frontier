'use client';

import { useEffect, useState } from 'react';
import {
  Play,
  Download,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  FileText,
  Image,
  Volume2,
  Subtitles,
  Film,
  Sparkles,
  Moon,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Pause,
  PlayCircle,
  X,
  Clock,
  Video,
  Lightbulb,
  ImageIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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

const statusConfig: Record<
  string,
  { label: string; color: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' }
> = {
  PENDING: { label: 'Pending', color: 'bg-slate-500', variant: 'secondary' },
  GENERATING_SCRIPT: { label: 'Generating Script', color: 'bg-blue-500', variant: 'info' },
  GENERATING_IMAGE_PROMPTS: { label: 'Creating Prompts', color: 'bg-teal-500', variant: 'info' },
  GENERATING_IMAGES: { label: 'Generating Images', color: 'bg-cyan-500', variant: 'info' },
  GENERATING_AUDIO: { label: 'Generating Audio', color: 'bg-violet-500', variant: 'info' },
  GENERATING_SRT: { label: 'Generating Subtitles', color: 'bg-indigo-500', variant: 'info' },
  RENDERING: { label: 'Rendering Video', color: 'bg-orange-500', variant: 'warning' },
  COMPLETED: { label: 'Completed', color: 'bg-emerald-500', variant: 'success' },
  FAILED: { label: 'Failed', color: 'bg-red-500', variant: 'destructive' },
};

const backgroundVideoPipelineSteps = [
  { key: 'script', label: 'Script', icon: FileText, status: 'GENERATING_SCRIPT' },
  { key: 'audio', label: 'Audio', icon: Volume2, status: 'GENERATING_AUDIO' },
  { key: 'srt', label: 'Subtitles', icon: Subtitles, status: 'GENERATING_SRT' },
  { key: 'render', label: 'Render', icon: Film, status: 'RENDERING' },
];

const aiImagesPipelineSteps = [
  { key: 'script', label: 'Script', icon: FileText, status: 'GENERATING_SCRIPT' },
  { key: 'imagePrompts', label: 'Prompts', icon: Lightbulb, status: 'GENERATING_IMAGE_PROMPTS' },
  { key: 'images', label: 'Images', icon: ImageIcon, status: 'GENERATING_IMAGES' },
  { key: 'audio', label: 'Audio', icon: Volume2, status: 'GENERATING_AUDIO' },
  { key: 'srt', label: 'Subtitles', icon: Subtitles, status: 'GENERATING_SRT' },
  { key: 'render', label: 'Render', icon: Film, status: 'RENDERING' },
];

function getPipelineSteps(renderMode: 'BACKGROUND_VIDEO' | 'AI_IMAGES') {
  return renderMode === 'AI_IMAGES' ? aiImagesPipelineSteps : backgroundVideoPipelineSteps;
}

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
  const statusOrder =
    video.renderMode === 'AI_IMAGES'
      ? [
          'PENDING',
          'GENERATING_SCRIPT',
          'GENERATING_IMAGE_PROMPTS',
          'GENERATING_IMAGES',
          'GENERATING_AUDIO',
          'GENERATING_SRT',
          'RENDERING',
          'COMPLETED',
        ]
      : ['PENDING', 'GENERATING_SCRIPT', 'GENERATING_AUDIO', 'GENERATING_SRT', 'RENDERING', 'COMPLETED'];

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
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [renderMode, setRenderMode] = useState<'BACKGROUND_VIDEO' | 'AI_IMAGES'>('AI_IMAGES');
  const [creating, setCreating] = useState(false);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  // Theme management state
  const [themes, setThemes] = useState<Theme[]>([]);
  const [themesLoading, setThemesLoading] = useState(true);
  const [showThemeManager, setShowThemeManager] = useState(false);
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
        body: JSON.stringify({ renderMode }),
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

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-background to-background/95">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center justify-between px-4 md:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Frontier</h1>
                <p className="text-xs text-muted-foreground">Video Generator</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="container px-4 py-8 md:px-8">
          {/* Stats Cards */}
          <div className="mb-8 grid gap-4 md:grid-cols-4">
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
                  <p className="text-2xl font-bold">
                    {videos.filter((v) => v.status === 'COMPLETED').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-orange-500/10">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/20">
                  <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {videos.filter((v) => isProcessing(v.status)).length}
                  </p>
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
                  <p className="text-2xl font-bold">
                    {videos.filter((v) => v.status === 'FAILED').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Failed</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Create Video Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create New Video
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Visual Mode:</span>
                  <div className="flex gap-2">
                    <Button
                      variant={renderMode === 'BACKGROUND_VIDEO' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRenderMode('BACKGROUND_VIDEO')}
                      className="gap-2"
                    >
                      <Film className="h-4 w-4" />
                      Background Video
                    </Button>
                    <Button
                      variant={renderMode === 'AI_IMAGES' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRenderMode('AI_IMAGES')}
                      className="gap-2"
                    >
                      <Image className="h-4 w-4" />
                      AI Images
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={createVideo}
                  disabled={creating}
                  size="lg"
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
            </CardContent>
          </Card>

          {/* Theme Management */}
          <Collapsible open={showThemeManager} onOpenChange={setShowThemeManager} className="mb-8">
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer transition-colors hover:bg-muted/50">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Moon className="h-5 w-5" />
                      Manage Themes
                      <Badge variant="secondary" className="ml-2">
                        {activeThemeCount} active
                      </Badge>
                    </div>
                    {showThemeManager ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  {/* Add new theme */}
                  <div className="mb-6 rounded-lg border bg-muted/30 p-4">
                    <h4 className="mb-3 font-medium">Add New Theme</h4>
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
                  </div>

                  {/* Theme list */}
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">All Themes ({themes.length})</h4>
                  </div>

                  {themesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : themes.length === 0 ? (
                    <p className="py-8 text-center text-muted-foreground">
                      No themes yet. Add one above!
                    </p>
                  ) : (
                    <ScrollArea className="h-[400px] pr-4">
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
                                      {theme._count.videos > 0
                                        ? 'Cannot delete (has videos)'
                                        : 'Delete'}
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
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Video List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Generated Videos
              </CardTitle>
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
                          <h3 className="font-semibold mb-2 truncate">{video.topic}</h3>
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
                            <Badge variant="outline" className="gap-1">
                              {video.renderMode === 'AI_IMAGES' ? (
                                <>
                                  <Image className="h-3 w-3" />
                                  AI Images
                                </>
                              ) : (
                                <>
                                  <Film className="h-3 w-3" />
                                  Background Video
                                </>
                              )}
                            </Badge>
                            {video.theme && (
                              <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-600 dark:text-amber-400">
                                <Moon className="h-3 w-3" />
                                {video.theme.name}
                              </Badge>
                            )}
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatDate(video.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Pipeline Progress */}
                      <div className="mt-4 flex items-center gap-1 rounded-lg bg-muted/50 p-3">
                        {getPipelineSteps(video.renderMode).map((step, index, arr) => {
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

                      {/* Video Player & Actions */}
                      {video.outputPath && (
                        <div className="mt-4">
                          {playingVideoId === video.id ? (
                            <div className="space-y-3">
                              <div className="relative overflow-hidden rounded-lg bg-black">
                                <video
                                  controls
                                  autoPlay
                                  className="w-full max-w-md"
                                >
                                  <source
                                    src={`/api/videos/${video.id}/stream`}
                                    type="video/mp4"
                                  />
                                  Your browser does not support the video tag.
                                </video>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPlayingVideoId(null)}
                                className="gap-2"
                              >
                                <X className="h-4 w-4" />
                                Close Player
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => setPlayingVideoId(video.id)}
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
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </TooltipProvider>
  );
}
