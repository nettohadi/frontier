'use client';

import { useState, useCallback, useEffect } from 'react';
import { Loader2, Clock, Youtube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ScheduleUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoId: string | null;
  videoTitle: string | null;
  onSuccess?: () => void;
}

interface SlotInfo {
  displayTime: string;
  scheduledAt: string;
}

export function ScheduleUploadModal({
  open,
  onOpenChange,
  videoId,
  videoTitle,
  onSuccess,
}: ScheduleUploadModalProps) {
  const [loading, setLoading] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [nextSlot, setNextSlot] = useState<SlotInfo | null>(null);

  // Fetch next available slot when modal opens
  const fetchNextSlot = useCallback(async () => {
    setLoading(true);
    setNextSlot(null);
    try {
      const res = await fetch('/api/upload/schedules/preview?count=1');
      const data = await res.json();
      if (res.ok && data.slots?.length > 0) {
        const slot = data.slots[0];
        setNextSlot({
          displayTime: slot.displayTime,
          scheduledAt: slot.scheduledAt,
        });
      } else {
        alert(data.error || data.message || 'No available slots');
        onOpenChange(false);
      }
    } catch (err) {
      console.error('Failed to get next slot:', err);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [onOpenChange]);

  // Fetch slot when modal opens
  useEffect(() => {
    if (open && videoId) {
      fetchNextSlot();
    }
    if (!open) {
      setNextSlot(null);
    }
  }, [open, videoId, fetchNextSlot]);

  const handleConfirm = async () => {
    if (!videoId) return;

    setScheduling(true);
    try {
      const res = await fetch('/api/upload/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });
      if (res.ok) {
        onSuccess?.();
        onOpenChange(false);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to schedule upload');
      }
    } catch (err) {
      console.error('Failed to schedule upload:', err);
    } finally {
      setScheduling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Youtube className="h-5 w-5" />
            Schedule Upload
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <p className="text-muted-foreground text-sm">Video</p>
            <p className="font-medium">{videoTitle}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Next available slot</p>
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-muted-foreground">Finding slot...</span>
              </div>
            ) : (
              <p className="font-medium text-emerald-600 dark:text-emerald-400">
                {nextSlot?.displayTime}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={scheduling}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={handleConfirm}
            disabled={loading || scheduling}
          >
            {scheduling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <Clock className="h-4 w-4" />
                Schedule
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook for easier usage
export function useScheduleUploadModal() {
  const [modalState, setModalState] = useState<{
    open: boolean;
    videoId: string | null;
    videoTitle: string | null;
  }>({
    open: false,
    videoId: null,
    videoTitle: null,
  });

  const openModal = useCallback((videoId: string, videoTitle: string) => {
    setModalState({ open: true, videoId, videoTitle });
  }, []);

  const closeModal = useCallback(() => {
    setModalState((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    modalState,
    openModal,
    closeModal,
    setModalOpen: (open: boolean) => setModalState((prev) => ({ ...prev, open })),
  };
}
