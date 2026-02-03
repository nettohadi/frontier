'use client';

import { useEffect, useState } from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Settings,
  Sparkles,
  Eye,
  EyeOff,
  Youtube,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GenerateModal, type GenerateConfig } from '@/components/GenerateModal';
import { toast } from 'sonner';

interface PublerSettings {
  apiKey: string | null;
  workspaceId: string | null;
  defaultChannelId: string | null;
}

interface YouTubeChannel {
  id: string;
  name: string;
  avatar?: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<PublerSettings>({
    apiKey: null,
    workspaceId: null,
    defaultChannelId: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings/publer');
      const data = await res.json();
      setSettings({
        apiKey: data.apiKey || null,
        workspaceId: data.workspaceId || null,
        defaultChannelId: data.defaultChannelId || null,
      });
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    setChannelsLoading(true);
    try {
      const res = await fetch('/api/settings/publer/channels');
      const data = await res.json();
      if (data.channels) {
        setChannels(data.channels);
      }
    } catch (err) {
      console.error('Failed to fetch channels:', err);
    } finally {
      setChannelsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (!loading && settings.apiKey && settings.workspaceId) {
      fetchChannels();
    }
  }, [loading, settings.apiKey, settings.workspaceId]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/publer', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast.success('Settings saved successfully');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save settings');
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('idle');
    try {
      const res = await fetch('/api/settings/publer', { method: 'POST' });
      if (res.ok) {
        setConnectionStatus('success');
        fetchChannels();
      } else {
        setConnectionStatus('error');
      }
    } catch {
      setConnectionStatus('error');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleBatchGenerate = async (config: GenerateConfig) => {
    setGenerateModalOpen(false);
    setCreating(true);
    try {
      await fetch('/api/videos/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: config.count,
          autoUpload: config.uploadMode !== 'none',
          uploadMode: config.uploadMode === 'none' ? null : config.uploadMode,
        }),
      });
    } catch (err) {
      console.error('Failed to create videos:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <GenerateModal
        open={generateModalOpen}
        onOpenChange={setGenerateModalOpen}
        onGenerate={handleBatchGenerate}
        isGenerating={creating}
      />

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur">
        <h1 className="text-xl font-semibold">Settings</h1>
        <Button
          onClick={() => setGenerateModalOpen(true)}
          disabled={creating}
          className="gap-2 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {creating ? 'Generating...' : 'Generate Video'}
        </Button>
      </header>

      <div className="p-6 space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Publer API Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Key</label>
                  <div className="relative">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      placeholder="Enter your Publer API key"
                      value={settings.apiKey || ''}
                      onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Get your API key from Publer Settings &gt; Integrations &gt; API
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Workspace ID</label>
                  <Input
                    placeholder="Enter your Workspace ID"
                    value={settings.workspaceId || ''}
                    onChange={(e) => setSettings({ ...settings, workspaceId: e.target.value })}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={testConnection}
                    disabled={testingConnection || !settings.apiKey || !settings.workspaceId}
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

                <div className="space-y-3">
                  <label className="text-sm font-medium">YouTube Channel</label>
                  {channelsLoading ? (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading channels...</span>
                    </div>
                  ) : channels.length > 0 ? (
                    <>
                      {settings.defaultChannelId && (
                        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/50 bg-emerald-500/5 p-3">
                          {(() => {
                            const selectedChannel = channels.find(c => c.id === settings.defaultChannelId);
                            return selectedChannel ? (
                              <>
                                {selectedChannel.avatar ? (
                                  <img
                                    src={selectedChannel.avatar}
                                    alt={selectedChannel.name}
                                    className="h-10 w-10 rounded-full"
                                  />
                                ) : (
                                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500">
                                    <Youtube className="h-5 w-5 text-white" />
                                  </div>
                                )}
                                <div className="flex-1">
                                  <p className="font-medium">{selectedChannel.name}</p>
                                  <p className="text-xs text-muted-foreground">Active channel</p>
                                </div>
                                <Badge variant="success" className="gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Connected
                                </Badge>
                              </>
                            ) : null;
                          })()}
                        </div>
                      )}
                      <Select
                        value={settings.defaultChannelId || ''}
                        onValueChange={(value) => setSettings({ ...settings, defaultChannelId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a YouTube channel" />
                        </SelectTrigger>
                        <SelectContent>
                          {channels.map((channel) => (
                            <SelectItem key={channel.id} value={channel.id}>
                              <div className="flex items-center gap-2">
                                {channel.avatar ? (
                                  <img src={channel.avatar} alt={channel.name} className="h-5 w-5 rounded-full" />
                                ) : (
                                  <Youtube className="h-5 w-5 text-red-500" />
                                )}
                                {channel.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">Test connection first to load channels</p>
                  )}
                </div>

                <Button onClick={saveSettings} disabled={saving} className="w-full gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Save Settings
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
