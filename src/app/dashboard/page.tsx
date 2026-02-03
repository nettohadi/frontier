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
  BookOpen,
  RefreshCw,
  Music,
  Layers,
  Palette,
  Settings,
  Calendar,
  Upload,
  Youtube,
  ExternalLink,
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

interface Topic {
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

interface PublerSettings {
  apiKey: string | null;
  workspaceId: string | null;
  defaultChannelId: string | null;
  autoUpload: boolean;
}

interface YouTubeChannel {
  id: string;
  name: string;
  picture: string | null;
}

interface ScheduleSlot {
  slot: number;
  hour: number;
  time: string;
  scheduledAt: string;
  schedule: {
    id: string;
    videoId: string;
    status: string;
    youtubeTitle: string | null;
  } | null;
  available: boolean;
  isPast: boolean;
}

type PageView = 'dashboard' | 'videos' | 'topics' | 'settings' | 'schedule';

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

  // Topic management state
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [newTopic, setNewTopic] = useState({ name: '', description: '' });
  const [topicSaving, setTopicSaving] = useState(false);

  // Settings state
  const [publerSettings, setPublerSettings] = useState<PublerSettings>({
    apiKey: null,
    workspaceId: null,
    defaultChannelId: null,
    autoUpload: false,
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [youtubeChannels, setYoutubeChannels] = useState<YouTubeChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);

  // Schedule state
  const [scheduleDate, setScheduleDate] = useState(new Date());
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([]);
  const [scheduleSlotsLoading, setScheduleSlotsLoading] = useState(true);

  // Upload state
  const [uploadingVideoId, setUploadingVideoId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ scheduleId: string; progress: number; status: string } | null>(null);

  const fetchTopics = async () => {
    try {
      const res = await fetch('/api/topics');
      const data = await res.json();
      setTopics(data.topics || []);
    } catch (err) {
      console.error('Failed to fetch topics:', err);
    } finally {
      setTopicsLoading(false);
    }
  };

  const createTopic = async () => {
    if (!newTopic.name.trim() || !newTopic.description.trim()) return;
    setTopicSaving(true);
    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTopic),
      });
      if (res.ok) {
        setNewTopic({ name: '', description: '' });
        fetchTopics();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create topic');
      }
    } catch (err) {
      console.error('Failed to create topic:', err);
    } finally {
      setTopicSaving(false);
    }
  };

  const updateTopic = async (topic: Topic) => {
    setTopicSaving(true);
    try {
      const res = await fetch(`/api/topics/${topic.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: topic.name,
          description: topic.description,
          isActive: topic.isActive,
        }),
      });
      if (res.ok) {
        setEditingTopic(null);
        fetchTopics();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update topic');
      }
    } catch (err) {
      console.error('Failed to update topic:', err);
    } finally {
      setTopicSaving(false);
    }
  };

  const toggleTopicActive = async (topic: Topic) => {
    try {
      await fetch(`/api/topics/${topic.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !topic.isActive }),
      });
      fetchTopics();
    } catch (err) {
      console.error('Failed to toggle topic:', err);
    }
  };

  const deleteTopic = async (topic: Topic) => {
    if (!confirm(`Delete topic "${topic.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/topics/${topic.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchTopics();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete topic');
      }
    } catch (err) {
      console.error('Failed to delete topic:', err);
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

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings/publer');
      const data = await res.json();
      setPublerSettings({
        apiKey: data.apiKey || null,
        workspaceId: data.workspaceId || null,
        defaultChannelId: data.defaultChannelId || null,
        autoUpload: data.autoUpload || false,
      });
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  };

  const fetchChannels = async () => {
    setChannelsLoading(true);
    try {
      const res = await fetch('/api/settings/publer/channels');
      const data = await res.json();
      if (data.channels) {
        setYoutubeChannels(data.channels);
      }
    } catch (err) {
      console.error('Failed to fetch channels:', err);
    } finally {
      setChannelsLoading(false);
    }
  };

  const saveSettings = async () => {
    setSettingsSaving(true);
    try {
      const res = await fetch('/api/settings/publer', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(publerSettings),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to save settings');
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSettingsSaving(false);
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('idle');
    try {
      const res = await fetch('/api/settings/publer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: publerSettings.apiKey,
          workspaceId: publerSettings.workspaceId,
        }),
      });
      if (res.ok) {
        setConnectionStatus('success');
        fetchChannels();
      } else {
        setConnectionStatus('error');
      }
    } catch (err) {
      setConnectionStatus('error');
    } finally {
      setTestingConnection(false);
    }
  };

  const fetchScheduleSlots = async (date: Date) => {
    setScheduleSlotsLoading(true);
    try {
      const dateStr = date.toISOString().split('T')[0];
      const res = await fetch(`/api/upload/schedules/date?date=${dateStr}`);
      const data = await res.json();
      if (data.slots) {
        setScheduleSlots(data.slots);
      }
    } catch (err) {
      console.error('Failed to fetch schedule slots:', err);
    } finally {
      setScheduleSlotsLoading(false);
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
      const data = await res.json();
      if (res.ok) {
        fetchVideos();
        if (currentPage === 'schedule') {
          fetchScheduleSlots(scheduleDate);
        }
      } else {
        alert(data.error || 'Failed to schedule upload');
      }
    } catch (err) {
      console.error('Failed to schedule upload:', err);
    } finally {
      setUploadingVideoId(null);
    }
  };

  const cancelSchedule = async (scheduleId: string) => {
    if (!confirm('Cancel this scheduled upload?')) return;
    try {
      const res = await fetch(`/api/upload/schedules/${scheduleId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchVideos();
        fetchScheduleSlots(scheduleDate);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to cancel schedule');
      }
    } catch (err) {
      console.error('Failed to cancel schedule:', err);
    }
  };

  useEffect(() => {
    fetchVideos();
    fetchTopics();
    fetchSettings();
    const interval = setInterval(fetchVideos, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (currentPage === 'schedule') {
      fetchScheduleSlots(scheduleDate);
    }
  }, [currentPage, scheduleDate]);

  useEffect(() => {
    if (currentPage === 'settings' && publerSettings.apiKey && publerSettings.workspaceId) {
      fetchChannels();
    }
  }, [currentPage]);

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

  const activeTopicCount = topics.filter((t) => t.isActive).length;
  const completedVideos = videos.filter((v) => v.status === 'COMPLETED').length;
  const processingVideos = videos.filter((v) => isProcessing(v.status)).length;
  const failedVideos = videos.filter((v) => v.status === 'FAILED').length;

  const menuItems = [
    { id: 'dashboard' as PageView, label: 'Dashboard', icon: Home },
    { id: 'videos' as PageView, label: 'All Videos', icon: LayoutGrid },
    { id: 'topics' as PageView, label: 'Manage Topics', icon: BookOpen },
    { id: 'schedule' as PageView, label: 'Upload Schedule', icon: Calendar },
    { id: 'settings' as PageView, label: 'Settings', icon: Settings },
  ];

  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-background">
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
                      {!sidebarCollapsed && item.id === 'topics' && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {activeTopicCount}
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
              {currentPage === 'topics' && 'Manage Topics'}
              {currentPage === 'schedule' && 'Upload Schedule'}
              {currentPage === 'settings' && 'Settings'}
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
                              {video.title || video.topicRelation?.name || video.topic}
                            </h3>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                              {video.topicRelation?.name || video.topic}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              {formatDate(video.createdAt)}
                            </p>

                            {/* Buttons for completed videos */}
                            {video.outputPath && (
                              <div className="space-y-1.5 mt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full h-7 text-xs gap-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.location.href = `/api/videos/${video.id}/download`;
                                  }}
                                >
                                  <Download className="h-3 w-3" />
                                  Download
                                </Button>
                                {video.uploadedToYouTube ? (
                                  <Badge variant="success" className="w-full justify-center gap-1 h-7">
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
                                    className="w-full justify-center gap-1 h-7"
                                  >
                                    <Upload className="h-3 w-3" />
                                    {video.uploadSchedule.status === 'SCHEDULED'
                                      ? 'Scheduled'
                                      : video.uploadSchedule.status === 'UPLOADING'
                                      ? `${video.uploadSchedule.progress}%`
                                      : video.uploadSchedule.status}
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full h-7 text-xs gap-1"
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
            )}

            {/* Topics View */}
            {currentPage === 'topics' && (
              <div className="space-y-6">
                {/* Add new topic */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Add New Topic
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      <Input
                        placeholder="Topic name (e.g., Mahabbah)"
                        value={newTopic.name}
                        onChange={(e) => setNewTopic({ ...newTopic, name: e.target.value })}
                        className="w-48"
                      />
                      <Input
                        placeholder="Description in Indonesian"
                        value={newTopic.description}
                        onChange={(e) => setNewTopic({ ...newTopic, description: e.target.value })}
                        className="min-w-[300px] flex-1"
                      />
                      <Button
                        onClick={createTopic}
                        disabled={topicSaving || !newTopic.name.trim() || !newTopic.description.trim()}
                        className="gap-2"
                      >
                        {topicSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        Add Topic
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Topic list */}
                <Card>
                  <CardHeader>
                    <CardTitle>All Topics ({topics.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {topicsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : topics.length === 0 ? (
                      <p className="py-8 text-center text-muted-foreground">
                        No topics yet. Add one above!
                      </p>
                    ) : (
                      <ScrollArea className="h-[600px] pr-4">
                        <div className="space-y-2">
                          {topics.map((topic) => (
                            <div
                              key={topic.id}
                              className={cn(
                                'rounded-lg border p-4 transition-colors',
                                topic.isActive
                                  ? 'border-emerald-500/50 bg-emerald-500/5'
                                  : 'border-border bg-muted/30 opacity-60'
                              )}
                            >
                              {editingTopic?.id === topic.id ? (
                                <div className="space-y-3">
                                  <Input
                                    value={editingTopic.name}
                                    onChange={(e) =>
                                      setEditingTopic({ ...editingTopic, name: e.target.value })
                                    }
                                    className="font-medium"
                                  />
                                  <Textarea
                                    value={editingTopic.description}
                                    onChange={(e) =>
                                      setEditingTopic({ ...editingTopic, description: e.target.value })
                                    }
                                    rows={3}
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => updateTopic(editingTopic)}
                                      disabled={topicSaving}
                                    >
                                      {topicSaving ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        'Save'
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setEditingTopic(null)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                      <span className="font-medium">{topic.name}</span>
                                      <Badge variant={topic.isActive ? 'success' : 'secondary'}>
                                        {topic.isActive ? 'Active' : 'Inactive'}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        Used: {topic.usageCount}x
                                      </span>
                                      {topic._count.videos > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                          • {topic._count.videos} video
                                          {topic._count.videos > 1 ? 's' : ''}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                      {topic.description}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8"
                                          onClick={() => toggleTopicActive(topic)}
                                        >
                                          {topic.isActive ? (
                                            <Pause className="h-4 w-4" />
                                          ) : (
                                            <PlayCircle className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {topic.isActive ? 'Deactivate' : 'Activate'}
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8"
                                          onClick={() => setEditingTopic(topic)}
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
                                          onClick={() => deleteTopic(topic)}
                                          disabled={topic._count.videos > 0}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {topic._count.videos > 0 ? 'Cannot delete (has videos)' : 'Delete'}
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

            {/* Settings View */}
            {currentPage === 'settings' && (
              <div className="space-y-6 max-w-2xl">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Publer API Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {settingsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">API Key</label>
                          <Input
                            type="password"
                            placeholder="Enter your Publer API key"
                            value={publerSettings.apiKey || ''}
                            onChange={(e) =>
                              setPublerSettings({ ...publerSettings, apiKey: e.target.value })
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            Get your API key from Publer Settings &gt; Integrations &gt; API
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Workspace ID</label>
                          <Input
                            placeholder="Enter your Workspace ID"
                            value={publerSettings.workspaceId || ''}
                            onChange={(e) =>
                              setPublerSettings({ ...publerSettings, workspaceId: e.target.value })
                            }
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={testConnection}
                            disabled={testingConnection || !publerSettings.apiKey || !publerSettings.workspaceId}
                            variant="outline"
                            className="gap-2"
                          >
                            {testingConnection ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : connectionStatus === 'success' ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : connectionStatus === 'error' ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                            Test Connection
                          </Button>
                          {connectionStatus === 'success' && (
                            <span className="text-sm text-emerald-500 flex items-center">Connected!</span>
                          )}
                          {connectionStatus === 'error' && (
                            <span className="text-sm text-red-500 flex items-center">Connection failed</span>
                          )}
                        </div>

                        <Separator />

                        <div className="space-y-2">
                          <label className="text-sm font-medium">YouTube Channel</label>
                          {channelsLoading ? (
                            <div className="flex items-center gap-2 py-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-sm text-muted-foreground">Loading channels...</span>
                            </div>
                          ) : youtubeChannels.length > 0 ? (
                            <Select
                              value={publerSettings.defaultChannelId || ''}
                              onValueChange={(value) =>
                                setPublerSettings({ ...publerSettings, defaultChannelId: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a YouTube channel" />
                              </SelectTrigger>
                              <SelectContent>
                                {youtubeChannels.map((channel) => (
                                  <SelectItem key={channel.id} value={channel.id}>
                                    {channel.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-sm text-muted-foreground py-2">
                              Test connection first to load channels
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <label className="text-sm font-medium">Auto-upload</label>
                            <p className="text-xs text-muted-foreground">
                              Automatically schedule uploads when videos are completed
                            </p>
                          </div>
                          <Switch
                            checked={publerSettings.autoUpload}
                            onCheckedChange={(checked) =>
                              setPublerSettings({ ...publerSettings, autoUpload: checked })
                            }
                          />
                        </div>

                        <Button
                          onClick={saveSettings}
                          disabled={settingsSaving}
                          className="w-full gap-2"
                        >
                          {settingsSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          Save Settings
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Schedule View */}
            {currentPage === 'schedule' && (
              <div className="space-y-6">
                {/* Date Navigation */}
                <Card>
                  <CardContent className="flex items-center justify-between p-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const newDate = new Date(scheduleDate);
                        newDate.setDate(newDate.getDate() - 1);
                        setScheduleDate(newDate);
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-4">
                      <h2 className="text-lg font-semibold">
                        {scheduleDate.toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </h2>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setScheduleDate(new Date())}
                      >
                        Today
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const newDate = new Date(scheduleDate);
                        newDate.setDate(newDate.getDate() + 1);
                        setScheduleDate(newDate);
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>

                {/* Time Slots */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Upload Slots (GMT+8)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {scheduleSlotsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {scheduleSlots.map((slot) => (
                          <div
                            key={slot.slot}
                            className={cn(
                              'rounded-lg border p-4 transition-colors',
                              slot.isPast && 'opacity-50',
                              slot.schedule?.status === 'COMPLETED' && 'border-emerald-500/50 bg-emerald-500/5',
                              slot.schedule?.status === 'UPLOADING' && 'border-orange-500/50 bg-orange-500/5',
                              slot.schedule?.status === 'SCHEDULED' && 'border-blue-500/50 bg-blue-500/5',
                              slot.schedule?.status === 'FAILED' && 'border-red-500/50 bg-red-500/5',
                              slot.available && 'border-dashed'
                            )}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                                  <Clock className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="font-semibold">{slot.time}</p>
                                  {slot.schedule ? (
                                    <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                                      {slot.schedule.youtubeTitle || 'Untitled'}
                                    </p>
                                  ) : slot.isPast ? (
                                    <p className="text-sm text-muted-foreground">Slot passed</p>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">Available</p>
                                  )}
                                </div>
                              </div>
                              {slot.schedule && (
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={
                                      slot.schedule.status === 'COMPLETED'
                                        ? 'success'
                                        : slot.schedule.status === 'UPLOADING'
                                        ? 'warning'
                                        : slot.schedule.status === 'FAILED'
                                        ? 'destructive'
                                        : 'info'
                                    }
                                  >
                                    {slot.schedule.status}
                                  </Badge>
                                  {slot.schedule.status === 'SCHEDULED' && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      onClick={() => cancelSchedule(slot.schedule!.id)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
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
