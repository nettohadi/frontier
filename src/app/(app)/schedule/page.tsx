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
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  const [generateModalOpen, setGenerateModalOpen] = useState(false);

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
        <h1 className="text-lg font-semibold md:text-xl">Upload Schedule</h1>
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
              <h2 className="text-sm font-semibold text-center md:text-lg">
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
              <Button variant="outline" size="sm" className="h-7 text-xs md:h-8 md:text-sm" onClick={() => setScheduleDate(new Date())}>
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
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-2 md:gap-3 md:grid-cols-2">
                {slots.map((slot) => (
                  <div
                    key={slot.slot}
                    className={cn(
                      'rounded-lg border p-3 transition-colors md:p-4',
                      slot.isPast && 'opacity-50',
                      slot.schedule?.status === 'COMPLETED' && 'border-emerald-500/50 bg-emerald-500/5',
                      slot.schedule?.status === 'UPLOADING' && 'border-orange-500/50 bg-orange-500/5',
                      slot.schedule?.status === 'SCHEDULED' && 'border-blue-500/50 bg-blue-500/5',
                      slot.schedule?.status === 'FAILED' && 'border-red-500/50 bg-red-500/5',
                      slot.available && 'border-dashed'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 md:gap-4">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted md:h-10 md:w-10">
                          <Clock className="h-4 w-4 text-muted-foreground md:h-5 md:w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm md:text-base">{slot.time}</p>
                          {slot.schedule ? (
                            <p className="text-xs text-muted-foreground truncate max-w-[120px] md:text-sm md:max-w-[200px]">
                              {slot.schedule.youtubeTitle || 'Untitled'}
                            </p>
                          ) : slot.isPast ? (
                            <p className="text-xs text-muted-foreground md:text-sm">Passed</p>
                          ) : (
                            <p className="text-xs text-muted-foreground md:text-sm">Available</p>
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
                            className="text-[10px] px-1.5 md:text-xs md:px-2"
                          >
                            {slot.schedule.status}
                          </Badge>
                          {slot.schedule.status === 'SCHEDULED' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive md:h-8 md:w-8"
                              onClick={() => cancelSchedule(slot.schedule!.id)}
                            >
                              <X className="h-3.5 w-3.5 md:h-4 md:w-4" />
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
