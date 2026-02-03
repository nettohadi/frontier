'use client';

import { useEffect, useState } from 'react';
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Pause,
  PlayCircle,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { GenerateModal, type GenerateConfig } from '@/components/GenerateModal';
import { cn } from '@/lib/utils';

interface Topic {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  _count: { videos: number };
}

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [newTopic, setNewTopic] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);

  const fetchTopics = async () => {
    try {
      const res = await fetch('/api/topics');
      const data = await res.json();
      setTopics(data.topics || []);
    } catch (err) {
      console.error('Failed to fetch topics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  const createTopic = async () => {
    if (!newTopic.name.trim() || !newTopic.description.trim()) return;
    setSaving(true);
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
      setSaving(false);
    }
  };

  const updateTopic = async (topic: Topic) => {
    setSaving(true);
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
      setSaving(false);
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

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:h-16 md:px-6">
        <h1 className="text-lg font-semibold md:text-xl">Manage Topics</h1>
        <Button
          onClick={() => setGenerateModalOpen(true)}
          disabled={creating}
          size="sm"
          className="gap-2 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 md:size-default"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          <span className="hidden sm:inline">{creating ? 'Generating...' : 'Generate Video'}</span>
          <span className="sm:hidden">{creating ? '...' : 'Generate'}</span>
        </Button>
      </header>

      <div className="p-4 space-y-4 md:p-6 md:space-y-6">
        {/* Add new topic */}
        <Card>
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Plus className="h-4 w-4 md:h-5 md:w-5" />
              Add New Topic
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
              <Input
                placeholder="Topic name (e.g., Mahabbah)"
                value={newTopic.name}
                onChange={(e) => setNewTopic({ ...newTopic, name: e.target.value })}
                className="w-full md:w-48"
              />
              <Input
                placeholder="Description in Indonesian"
                value={newTopic.description}
                onChange={(e) => setNewTopic({ ...newTopic, description: e.target.value })}
                className="w-full md:min-w-[300px] md:flex-1"
              />
              <Button
                onClick={createTopic}
                disabled={saving || !newTopic.name.trim() || !newTopic.description.trim()}
                className="gap-2 w-full md:w-auto"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Topic
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Topic list */}
        <Card>
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="text-base md:text-lg">All Topics ({topics.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : topics.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground text-sm">No topics yet. Add one above!</p>
            ) : (
              <ScrollArea className="h-[500px] pr-2 md:h-[600px] md:pr-4">
                <div className="space-y-2">
                  {topics.map((topic) => (
                    <div
                      key={topic.id}
                      className={cn(
                        'rounded-lg border p-3 transition-colors md:p-4',
                        topic.isActive
                          ? 'border-emerald-500/50 bg-emerald-500/5'
                          : 'border-border bg-muted/30 opacity-60'
                      )}
                    >
                      {editingTopic?.id === topic.id ? (
                        <div className="space-y-3">
                          <Input
                            value={editingTopic.name}
                            onChange={(e) => setEditingTopic({ ...editingTopic, name: e.target.value })}
                            className="font-medium"
                          />
                          <Textarea
                            value={editingTopic.description}
                            onChange={(e) => setEditingTopic({ ...editingTopic, description: e.target.value })}
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => updateTopic(editingTopic)} disabled={saving}>
                              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingTopic(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1 md:gap-2">
                              <span className="font-medium text-sm md:text-base">{topic.name}</span>
                              <Badge variant={topic.isActive ? 'success' : 'secondary'} className="text-[10px] md:text-xs">
                                {topic.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mb-1.5 text-[10px] text-muted-foreground md:text-xs">
                              <span>Used: {topic.usageCount}x</span>
                              {topic._count.videos > 0 && (
                                <span>
                                  {topic._count.videos} video{topic._count.videos > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 md:text-sm">{topic.description}</p>
                          </div>
                          <div className="flex shrink-0 gap-1 mt-2 md:mt-0">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleTopicActive(topic)}>
                                  {topic.isActive ? <Pause className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{topic.isActive ? 'Deactivate' : 'Activate'}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingTopic(topic)}>
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
                              <TooltipContent>{topic._count.videos > 0 ? 'Cannot delete (has videos)' : 'Delete'}</TooltipContent>
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
    </>
  );
}
