'use client';

import { useEffect, useState } from 'react';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
  X,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GenerateModal, type GenerateConfig } from '@/components/GenerateModal';
import { cn } from '@/lib/utils';

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

export default function SchedulePage() {
  const [scheduleDate, setScheduleDate] = useState(new Date());
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [regenerateModalSchedule, setRegenerateModalSchedule] = useState<{
    id: string;
    time: string;
    title: string | null;
  } | null>(null);

  const fetchSlots = async (date: Date) => {
    setLoading(true);
    try {
      const dateStr = date.toISOString().split('T')[0];
      const res = await fetch(`/api/upload/schedules/date?date=${dateStr}`);
      const data = await res.json();
      if (data.slots) {
        setSlots(data.slots);
      }
    } catch (err) {
      console.error('Failed to fetch schedule slots:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots(scheduleDate);
  }, [scheduleDate]);

  const cancelSchedule = async (scheduleId: string) => {
    if (!confirm('Cancel this scheduled upload?')) return;
    try {
      const res = await fetch(`/api/upload/schedules/${scheduleId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchSlots(scheduleDate);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to cancel schedule');
      }
    } catch (err) {
      console.error('Failed to cancel schedule:', err);
    }
  };

  const handleRegenerateConfirm = async () => {
    if (!regenerateModalSchedule) return;
    const scheduleId = regenerateModalSchedule.id;
    setRegenerateModalSchedule(null);
    setRegeneratingId(scheduleId);
    try {
      const res = await fetch(`/api/upload/schedules/${scheduleId}/regenerate`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchSlots(scheduleDate);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to regenerate');
      }
    } catch (err) {
      console.error('Failed to regenerate:', err);
    } finally {
      setRegeneratingId(null);
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

      {/* Regenerate Confirmation Modal */}
      <Dialog
        open={!!regenerateModalSchedule}
        onOpenChange={(open) => !open && setRegenerateModalSchedule(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Regenerate Video</DialogTitle>
            <DialogDescription>
              Are you sure you want to regenerate a new video for the{' '}
              <span className="font-medium text-foreground">{regenerateModalSchedule?.time}</span>{' '}
              slot?
              {regenerateModalSchedule?.title && (
                <>
                  <br />
                  <span className="mt-2 block text-xs">
                    Current: &quot;{regenerateModalSchedule.title}&quot;
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/50 rounded-md p-3 text-sm">
            This will cancel the existing Publer schedule and create a new video for this time slot.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenerateModalSchedule(null)}>
              Cancel
            </Button>
            <Button onClick={handleRegenerateConfirm}>Regenerate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <header className="bg-background/95 sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur md:h-16 md:px-6">
        <h1 className="text-lg font-semibold md:text-xl">Upload Schedule</h1>
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

      <div className="space-y-4 p-4 md:space-y-6 md:p-6">
        {/* Date Navigation */}
        <Card>
          <CardContent className="flex items-center justify-between p-3 md:p-4">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 md:h-10 md:w-10"
              onClick={() => {
                const newDate = new Date(scheduleDate);
                newDate.setDate(newDate.getDate() - 1);
                setScheduleDate(newDate);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex flex-col items-center gap-1 md:flex-row md:gap-4">
              <h2 className="text-center text-sm font-semibold md:text-lg">
                <span className="hidden md:inline">
                  {scheduleDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
                <span className="md:hidden">
                  {scheduleDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </h2>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs md:h-8 md:text-sm"
                onClick={() => setScheduleDate(new Date())}
              >
                Today
              </Button>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 md:h-10 md:w-10"
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
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Calendar className="h-4 w-4 md:h-5 md:w-5" />
              Upload Slots (GMT+8)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 md:gap-3">
                {slots.map((slot) => (
                  <div
                    key={slot.slot}
                    className={cn(
                      'rounded-lg border p-3 transition-colors md:p-4',
                      slot.isPast && 'opacity-50',
                      slot.schedule?.status === 'COMPLETED' &&
                        'border-emerald-500/50 bg-emerald-500/5',
                      slot.schedule?.status === 'UPLOADING' &&
                        'border-orange-500/50 bg-orange-500/5',
                      slot.schedule?.status === 'SCHEDULED' && 'border-blue-500/50 bg-blue-500/5',
                      slot.schedule?.status === 'FAILED' && 'border-red-500/50 bg-red-500/5',
                      slot.available && 'border-dashed'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 md:gap-4">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full md:h-10 md:w-10">
                          <Clock className="text-muted-foreground h-4 w-4 md:h-5 md:w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold md:text-base">{slot.time}</p>
                          {slot.schedule ? (
                            <p className="text-muted-foreground max-w-[120px] truncate text-xs md:max-w-[200px] md:text-sm">
                              {slot.schedule.youtubeTitle || 'Untitled'}
                            </p>
                          ) : slot.isPast ? (
                            <p className="text-muted-foreground text-xs md:text-sm">Passed</p>
                          ) : (
                            <p className="text-muted-foreground text-xs md:text-sm">Available</p>
                          )}
                        </div>
                      </div>
                      {slot.schedule && (
                        <div className="flex items-center gap-1 md:gap-2">
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
                            className="px-1.5 text-[10px] md:px-2 md:text-xs"
                          >
                            {slot.schedule.status}
                          </Badge>
                          {slot.schedule.status === 'SCHEDULED' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive h-7 w-7 md:h-8 md:w-8"
                              onClick={() => cancelSchedule(slot.schedule!.id)}
                            >
                              <X className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            </Button>
                          )}
                          {(slot.schedule.status === 'COMPLETED' ||
                            slot.schedule.status === 'FAILED') && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 md:h-8 md:w-8"
                              onClick={() =>
                                setRegenerateModalSchedule({
                                  id: slot.schedule!.id,
                                  time: slot.time,
                                  title: slot.schedule!.youtubeTitle,
                                })
                              }
                              disabled={regeneratingId === slot.schedule.id}
                            >
                              {regeneratingId === slot.schedule.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin md:h-4 md:w-4" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5 md:h-4 md:w-4" />
                              )}
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
    </>
  );
}
