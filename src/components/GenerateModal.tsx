'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, AlertCircle, Calendar, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface GenerateConfig {
  count: number;
  uploadMode: 'none' | 'immediate' | 'scheduled';
}

interface SlotPreview {
  date: string;
  slot: number;
  displayTime: string;
  scheduledAt: string;
}

interface GenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (config: GenerateConfig) => void;
  isGenerating?: boolean;
}

export function GenerateModal({
  open,
  onOpenChange,
  onGenerate,
  isGenerating = false,
}: GenerateModalProps) {
  const [count, setCount] = useState(1);
  const [uploadMode, setUploadMode] = useState<'none' | 'immediate' | 'scheduled'>('none');
  const [previewSlots, setPreviewSlots] = useState<SlotPreview[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [publerConfigured, setPublerConfigured] = useState<boolean | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  // Check if Publer is configured when modal opens
  useEffect(() => {
    if (open) {
      checkPublerConfig();
    }
  }, [open]);

  // Fetch slot preview when scheduled mode is selected
  useEffect(() => {
    if (uploadMode === 'scheduled' && count > 0) {
      fetchSlotPreview();
    } else {
      setPreviewSlots([]);
      setSlotsError(null);
    }
  }, [uploadMode, count]);

  const checkPublerConfig = async () => {
    try {
      const res = await fetch('/api/settings/publer');
      if (res.ok) {
        const data = await res.json();
        const isConfigured = data.configured && (!!data.defaultChannelId || !!data.defaultTikTokChannelId);
        setPublerConfigured(isConfigured);
        if (!isConfigured) {
          if (!data.configured) {
            setConfigError('Please configure Publer API credentials in Settings first.');
          } else if (!data.defaultChannelId && !data.defaultTikTokChannelId) {
            setConfigError('Please select at least one channel (YouTube or TikTok) in Settings first.');
          }
        } else {
          setConfigError(null);
        }
      }
    } catch {
      setPublerConfigured(false);
      setConfigError('Could not check Publer configuration.');
    }
  };

  const fetchSlotPreview = async () => {
    setLoadingSlots(true);
    setSlotsError(null);
    try {
      const res = await fetch(`/api/upload/schedules/preview?count=${count}`);
      const data = await res.json();
      if (res.ok) {
        setPreviewSlots(data.slots);
        if (!data.hasEnoughSlots) {
          setSlotsError(data.message);
        }
      } else {
        setSlotsError(data.error || 'Failed to load schedule preview');
      }
    } catch {
      setSlotsError('Failed to load schedule preview');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSubmit = () => {
    onGenerate({ count, uploadMode });
  };

  const canUseAutoUpload = publerConfigured === true;
  const showSlotPreview = uploadMode === 'scheduled' && canUseAutoUpload;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90dvh] w-[95%] max-w-md flex-col p-0">
        <DialogHeader className="flex-shrink-0 border-b p-4">
          <DialogTitle>Generate Videos</DialogTitle>
          <DialogDescription>
            Generate one or more videos with optional automatic YouTube upload.
          </DialogDescription>
        </DialogHeader>

        <div className={cn('flex min-h-0 flex-1 flex-col space-y-4', 'h-[80%] overflow-auto p-4')}>
          {/* Video Count */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">How many videos?</label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setCount(Math.max(1, count - 1))}
                disabled={count <= 1}
              >
                -
              </Button>
              <Input
                type="text"
                min={1}
                max={10}
                value={count}
                onChange={(e) => setCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-20 text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setCount(Math.min(10, count + 1))}
                disabled={count >= 10}
              >
                +
              </Button>
              <span className="text-muted-foreground text-sm">Max 10</span>
            </div>
          </div>

          {/* Upload Mode */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">After generation:</label>
            <div className="space-y-2">
              <UploadOption
                selected={uploadMode === 'none'}
                onClick={() => setUploadMode('none')}
                icon={<X className="h-4 w-4" />}
                title="Don't upload"
                description="Generate videos only, upload manually later"
              />
              <UploadOption
                selected={uploadMode === 'immediate'}
                onClick={() => canUseAutoUpload && setUploadMode('immediate')}
                icon={<Upload className="h-4 w-4" />}
                title="Upload immediately"
                description="Upload to YouTube as soon as each video completes"
                disabled={!canUseAutoUpload}
              />
              <UploadOption
                selected={uploadMode === 'scheduled'}
                onClick={() => canUseAutoUpload && setUploadMode('scheduled')}
                icon={<Calendar className="h-4 w-4" />}
                title="Schedule upload"
                description="Schedule each video for the next available slot"
                disabled={!canUseAutoUpload}
              />
            </div>

            {/* Config Error */}
            {configError && uploadMode !== 'none' && (
              <div className="flex items-start gap-2 rounded-md bg-yellow-500/10 p-3 text-sm text-yellow-600">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{configError}</span>
              </div>
            )}
          </div>

          {/* Schedule Preview - Scrollable */}
          {showSlotPreview && (
            <div className="flex min-h-[200px] flex-1 flex-col overflow-hidden rounded-md border">
              <div className="flex-shrink-0 border-b p-3">
                <div className="text-sm font-medium">Schedule Preview</div>
              </div>
              <ScrollArea className="h-full flex-1">
                <div className="p-3">
                  {loadingSlots ? (
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading available slots...
                    </div>
                  ) : slotsError ? (
                    <div className="flex items-start gap-2 text-sm text-yellow-600">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <span>{slotsError}</span>
                    </div>
                  ) : previewSlots.length > 0 ? (
                    <ul className="text-muted-foreground space-y-1 text-sm">
                      {previewSlots.map((slot, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="w-4 text-center">{i + 1}.</span>
                          <span>{slot.displayTime}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 border-t p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isGenerating || (uploadMode !== 'none' && !canUseAutoUpload)}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              `Generate ${count} Video${count > 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface UploadOptionProps {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
}

function UploadOption({
  selected,
  onClick,
  icon,
  title,
  description,
  disabled = false,
}: UploadOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
        selected
          ? 'border-primary bg-primary/5'
          : disabled
            ? 'border-muted bg-muted/50 cursor-not-allowed opacity-50'
            : 'border-border hover:border-primary/50 hover:bg-accent/50'
      }`}
    >
      <div
        className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
          selected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'
        }`}
      >
        {selected && <div className="h-2 w-2 rounded-full bg-current" />}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{title}</span>
        </div>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </button>
  );
}
