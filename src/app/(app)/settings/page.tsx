'use client';

import { useEffect, useState } from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Settings,
  Eye,
  EyeOff,
  Youtube,
  Music2,
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
import { GenerateVideoDropdown } from '@/components/GenerateVideoDropdown';
import { toast } from 'sonner';

interface PublerSettings {
  apiKey: string | null;
  workspaceId: string | null;
  defaultChannelId: string | null;
  defaultTikTokChannelId: string | null;
}

interface YouTubeChannel {
  id: string;
  name: string;
  avatar?: string;
}

interface TikTokAccount {
  id: string;
  name: string;
  avatar?: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<PublerSettings>({
    apiKey: null,
    workspaceId: null,
    defaultChannelId: null,
    defaultTikTokChannelId: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [tiktokAccounts, setTiktokAccounts] = useState<TikTokAccount[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings/publer');
      const data = await res.json();
      setSettings({
        apiKey: data.apiKey || null,
        workspaceId: data.workspaceId || null,
        defaultChannelId: data.defaultChannelId || null,
        defaultTikTokChannelId: data.defaultTikTokChannelId || null,
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
      if (data.tiktokAccounts) {
        setTiktokAccounts(data.tiktokAccounts);
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

  return (
    <>
      <header className="bg-background/95 sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur md:h-16 md:px-6">
        <h1 className="text-lg font-semibold md:text-xl">Settings</h1>
        <GenerateVideoDropdown />
      </header>

      <div className="max-w-2xl space-y-4 p-4 md:space-y-6 md:p-6">
        <Card>
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Settings className="h-4 w-4 md:h-5 md:w-5" />
              Publer API Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 md:space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
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
                      className="absolute top-0 right-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <EyeOff className="text-muted-foreground h-4 w-4" />
                      ) : (
                        <Eye className="text-muted-foreground h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs">
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

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={testConnection}
                    disabled={testingConnection || !settings.apiKey || !settings.workspaceId}
                    variant="outline"
                    size="sm"
                    className="md:size-default gap-2"
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
                    <span className="hidden sm:inline">Test Connection</span>
                    <span className="sm:hidden">Test</span>
                  </Button>
                  {connectionStatus === 'success' && (
                    <span className="flex items-center text-xs text-emerald-500 md:text-sm">
                      Connected!
                    </span>
                  )}
                  {connectionStatus === 'error' && (
                    <span className="flex items-center text-xs text-red-500 md:text-sm">
                      Failed
                    </span>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <label className="text-sm font-medium">YouTube Channel</label>
                  {channelsLoading ? (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-muted-foreground text-sm">Loading channels...</span>
                    </div>
                  ) : channels.length > 0 ? (
                    <>
                      {settings.defaultChannelId && (
                        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/5 p-2 md:gap-3 md:p-3">
                          {(() => {
                            const selectedChannel = channels.find(
                              (c) => c.id === settings.defaultChannelId
                            );
                            return selectedChannel ? (
                              <>
                                {selectedChannel.avatar ? (
                                  <img
                                    src={selectedChannel.avatar}
                                    alt={selectedChannel.name}
                                    className="h-8 w-8 rounded-full md:h-10 md:w-10"
                                  />
                                ) : (
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 md:h-10 md:w-10">
                                    <Youtube className="h-4 w-4 text-white md:h-5 md:w-5" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium md:text-base">
                                    {selectedChannel.name}
                                  </p>
                                  <p className="text-muted-foreground text-[10px] md:text-xs">
                                    Active channel
                                  </p>
                                </div>
                                <Badge
                                  variant="success"
                                  className="gap-1 px-1.5 text-[10px] md:px-2 md:text-xs"
                                >
                                  <CheckCircle2 className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                  <span className="hidden sm:inline">Connected</span>
                                </Badge>
                              </>
                            ) : null;
                          })()}
                        </div>
                      )}
                      <Select
                        value={settings.defaultChannelId || ''}
                        onValueChange={(value) =>
                          setSettings({ ...settings, defaultChannelId: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a YouTube channel" />
                        </SelectTrigger>
                        <SelectContent>
                          {channels.map((channel) => (
                            <SelectItem key={channel.id} value={channel.id}>
                              <div className="flex items-center gap-2">
                                {channel.avatar ? (
                                  <img
                                    src={channel.avatar}
                                    alt={channel.name}
                                    className="h-5 w-5 rounded-full"
                                  />
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
                    <p className="text-muted-foreground py-2 text-sm">
                      Test connection first to load channels
                    </p>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <label className="text-sm font-medium">TikTok Account</label>
                  {channelsLoading ? (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-muted-foreground text-sm">Loading accounts...</span>
                    </div>
                  ) : tiktokAccounts.length > 0 ? (
                    <>
                      {settings.defaultTikTokChannelId && (
                        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/5 p-2 md:gap-3 md:p-3">
                          {(() => {
                            const selectedAccount = tiktokAccounts.find(
                              (a) => a.id === settings.defaultTikTokChannelId
                            );
                            return selectedAccount ? (
                              <>
                                {selectedAccount.avatar ? (
                                  <img
                                    src={selectedAccount.avatar}
                                    alt={selectedAccount.name}
                                    className="h-8 w-8 rounded-full md:h-10 md:w-10"
                                  />
                                ) : (
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black md:h-10 md:w-10">
                                    <Music2 className="h-4 w-4 text-white md:h-5 md:w-5" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium md:text-base">
                                    {selectedAccount.name}
                                  </p>
                                  <p className="text-muted-foreground text-[10px] md:text-xs">
                                    Active account
                                  </p>
                                </div>
                                <Badge
                                  variant="success"
                                  className="gap-1 px-1.5 text-[10px] md:px-2 md:text-xs"
                                >
                                  <CheckCircle2 className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                  <span className="hidden sm:inline">Connected</span>
                                </Badge>
                              </>
                            ) : null;
                          })()}
                        </div>
                      )}
                      <Select
                        value={settings.defaultTikTokChannelId || ''}
                        onValueChange={(value) =>
                          setSettings({ ...settings, defaultTikTokChannelId: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a TikTok account" />
                        </SelectTrigger>
                        <SelectContent>
                          {tiktokAccounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              <div className="flex items-center gap-2">
                                {account.avatar ? (
                                  <img
                                    src={account.avatar}
                                    alt={account.name}
                                    className="h-5 w-5 rounded-full"
                                  />
                                ) : (
                                  <Music2 className="h-5 w-5" />
                                )}
                                {account.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  ) : (
                    <p className="text-muted-foreground py-2 text-sm">
                      {settings.apiKey && settings.workspaceId
                        ? 'No TikTok account connected in Publer'
                        : 'Test connection first to load accounts'}
                    </p>
                  )}
                </div>

                <Button onClick={saveSettings} disabled={saving} className="w-full gap-2">
                  {saving ? (
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
    </>
  );
}
