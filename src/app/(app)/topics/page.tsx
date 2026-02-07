'use client';

import { useEffect, useState } from 'react';
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Pause,
  PlayCircle,
  Target,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ListFilter,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { GenerateVideoDropdown } from '@/components/GenerateVideoDropdown';
import { Skeleton } from '@/components/ui/skeleton';
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

const TOPICS_PER_PAGE = 10;

export default function TopicsPage() {
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [nextTopicId, setNextTopicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [newTopic, setNewTopic] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'delete' | 'deactivate';
    topic: Topic | null;
  }>({ open: false, type: 'delete', topic: null });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Filter state - "What's Next" shows topics starting from the next topic
  const [whatsNextFilter, setWhatsNextFilter] = useState(false);

  const fetchTopics = async () => {
    try {
      const res = await fetch('/api/topics');
      const data = await res.json();
      setAllTopics(data.topics || []);
      setNextTopicId(data.nextTopicId || null);
    } catch (err) {
      console.error('Failed to fetch topics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  // Get filtered and paginated topics
  const getDisplayedTopics = () => {
    let topics = allTopics;

    if (whatsNextFilter && nextTopicId) {
      // Find the index of the next topic
      const nextIndex = topics.findIndex((t) => t.id === nextTopicId);
      if (nextIndex !== -1) {
        // Reorder: topics from nextIndex to end, then start to nextIndex
        topics = [...topics.slice(nextIndex), ...topics.slice(0, nextIndex)];
      }
    }

    return topics;
  };

  const filteredTopics = getDisplayedTopics();
  const totalPages = Math.ceil(filteredTopics.length / TOPICS_PER_PAGE);
  const paginatedTopics = filteredTopics.slice(
    (currentPage - 1) * TOPICS_PER_PAGE,
    currentPage * TOPICS_PER_PAGE
  );

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [whatsNextFilter]);

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

  const openDeactivateConfirm = (topic: Topic) => {
    setConfirmDialog({ open: true, type: 'deactivate', topic });
  };

  const openDeleteConfirm = (topic: Topic) => {
    setConfirmDialog({ open: true, type: 'delete', topic });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({ open: false, type: 'delete', topic: null });
  };

  const confirmDeactivate = async () => {
    if (!confirmDialog.topic) return;
    try {
      await fetch(`/api/topics/${confirmDialog.topic.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      });
      fetchTopics();
    } catch (err) {
      console.error('Failed to deactivate topic:', err);
    } finally {
      closeConfirmDialog();
    }
  };

  const activateTopic = async (topic: Topic) => {
    try {
      await fetch(`/api/topics/${topic.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
      fetchTopics();
    } catch (err) {
      console.error('Failed to activate topic:', err);
    }
  };

  const [settingNextId, setSettingNextId] = useState<string | null>(null);

  const setAsNextTopic = async (topic: Topic) => {
    if (!topic.isActive) return;
    setSettingNextId(topic.id);
    try {
      await fetch('/api/rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setTopic: topic.id }),
      });
      await fetchTopics();
    } catch (err) {
      console.error('Failed to set next topic:', err);
    } finally {
      setSettingNextId(null);
    }
  };

  const confirmDelete = async () => {
    if (!confirmDialog.topic) return;
    try {
      const res = await fetch(`/api/topics/${confirmDialog.topic.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchTopics();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete topic');
      }
    } catch (err) {
      console.error('Failed to delete topic:', err);
    } finally {
      closeConfirmDialog();
    }
  };

  return (
    <>
      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && closeConfirmDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.type === 'delete' ? 'Delete Topic' : 'Deactivate Topic'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.type === 'delete' ? (
                <>
                  Are you sure you want to delete <strong>"{confirmDialog.topic?.name}"</strong>?
                  This action cannot be undone.
                </>
              ) : (
                <>
                  Are you sure you want to deactivate <strong>"{confirmDialog.topic?.name}"</strong>?
                  It will be excluded from video generation rotation.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDialog.type === 'delete' ? confirmDelete : confirmDeactivate}
              className={
                confirmDialog.type === 'delete'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
            >
              {confirmDialog.type === 'delete' ? 'Delete' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <header className="bg-background/95 sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur md:h-16 md:px-6">
        <h1 className="text-lg font-semibold md:text-xl">Manage Topics</h1>
        <GenerateVideoDropdown onRefresh={fetchTopics} />
      </header>

      <div className="space-y-4 p-4 md:space-y-6 md:p-6">
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
                className="w-full gap-2 md:w-auto"
              >
                {saving ? (
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
          <CardHeader className="pb-3 md:pb-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base md:text-lg">
                All Topics ({allTopics.length})
              </CardTitle>
              <Button
                variant={whatsNextFilter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setWhatsNextFilter(!whatsNextFilter)}
                className="gap-2"
              >
                <ListFilter className="h-4 w-4" />
                <span className="hidden sm:inline">What's Next</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-lg border p-3 md:p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <Skeleton className="h-4 w-32 md:h-5" />
                          <Skeleton className="h-4 w-14 rounded-full" />
                        </div>
                        <Skeleton className="mb-1.5 h-3 w-20" />
                        <Skeleton className="h-3 w-full max-w-md" />
                        <Skeleton className="mt-1 h-3 w-2/3 max-w-xs" />
                      </div>
                      <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            ) : allTopics.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No topics yet. Add one above!
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {paginatedTopics.map((topic) => (
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
                              disabled={saving}
                            >
                              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
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
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-1.5 md:gap-2">
                              <span className="text-sm font-medium md:text-base">{topic.name}</span>
                              <Badge
                                variant={topic.isActive ? 'success' : 'secondary'}
                                className="text-[10px] md:text-xs"
                              >
                                {topic.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                              {topic.id === nextTopicId && (
                                <Badge
                                  variant="outline"
                                  className="border-primary text-primary text-[10px] md:text-xs"
                                >
                                  Next
                                </Badge>
                              )}
                            </div>
                            <div className="text-muted-foreground mb-1.5 flex flex-wrap items-center gap-2 text-[10px] md:text-xs">
                              <span>Used: {topic.usageCount}x</span>
                              {topic._count.videos > 0 && (
                                <span>
                                  {topic._count.videos} video{topic._count.videos > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                            <p className="text-muted-foreground line-clamp-2 text-xs md:text-sm">
                              {topic.description}
                            </p>
                          </div>
                          <TooltipProvider delayDuration={300}>
                            <div className="mt-2 flex shrink-0 items-center gap-1 md:mt-0">
                              {topic.isActive && topic.id !== nextTopicId && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={() => setAsNextTopic(topic)}
                                      disabled={settingNextId === topic.id}
                                    >
                                      {settingNextId === topic.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Target className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Set as Next</TooltipContent>
                                </Tooltip>
                              )}
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
                              {topic.isActive ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={() => openDeactivateConfirm(topic)}
                                    >
                                      <Pause className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Deactivate</TooltipContent>
                                </Tooltip>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={() => activateTopic(topic)}
                                    >
                                      <PlayCircle className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Activate</TooltipContent>
                                </Tooltip>
                              )}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => openDeleteConfirm(topic)}
                                    disabled={topic._count.videos > 0}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {topic._count.videos > 0 ? 'Cannot delete' : 'Delete'}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between border-t pt-4">
                    <p className="text-muted-foreground text-sm">
                      Page {currentPage} of {totalPages}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronsLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">First</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Previous</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <span className="hidden sm:inline">Next</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                      >
                        <span className="hidden sm:inline">Last</span>
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
