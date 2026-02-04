'use client';

import { useState } from 'react';
import { Plus, Loader2, Sparkles, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { GenerateModal, type GenerateConfig } from '@/components/GenerateModal';

interface GenerateVideoDropdownProps {
  onRefresh?: () => void;
}

export function GenerateVideoDropdown({ onRefresh }: GenerateVideoDropdownProps) {
  const [creating, setCreating] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [customTopicModalOpen, setCustomTopicModalOpen] = useState(false);
  const [customTopic, setCustomTopic] = useState({ name: '', description: '' });
  const [generatingCustom, setGeneratingCustom] = useState(false);
  const [saveToDatabase, setSaveToDatabase] = useState(false);

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
      onRefresh?.();
    } catch (err) {
      console.error('Failed to create videos:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleCustomTopicGenerate = async () => {
    if (!customTopic.name.trim() || !customTopic.description.trim()) return;

    setGeneratingCustom(true);
    try {
      // Optionally save to database first
      if (saveToDatabase) {
        const res = await fetch('/api/topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customTopic),
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || 'Failed to save topic');
          return;
        }
      }

      // Generate video with custom topic
      await fetch('/api/videos/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: 1,
          customTopic: {
            name: customTopic.name,
            description: customTopic.description,
          },
        }),
      });

      setCustomTopicModalOpen(false);
      setCustomTopic({ name: '', description: '' });
      setSaveToDatabase(false);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to generate with custom topic:', err);
    } finally {
      setGeneratingCustom(false);
    }
  };

  const isGenerating = creating || generatingCustom;

  return (
    <>
      <GenerateModal
        open={generateModalOpen}
        onOpenChange={setGenerateModalOpen}
        onGenerate={handleBatchGenerate}
        isGenerating={creating}
      />

      {/* Custom Topic Modal */}
      <Dialog open={customTopicModalOpen} onOpenChange={setCustomTopicModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate with Custom Topic</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Topic Name</label>
              <Input
                placeholder="e.g., Mahabbah"
                value={customTopic.name}
                onChange={(e) => setCustomTopic({ ...customTopic, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (in Indonesian)</label>
              <Textarea
                placeholder="Describe the topic for script generation..."
                value={customTopic.description}
                onChange={(e) => setCustomTopic({ ...customTopic, description: e.target.value })}
                rows={4}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="save-to-db"
                checked={saveToDatabase}
                onCheckedChange={setSaveToDatabase}
              />
              <label htmlFor="save-to-db" className="cursor-pointer text-sm">
                Save topic to database
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setCustomTopicModalOpen(false)}
              disabled={generatingCustom}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleCustomTopicGenerate}
              disabled={generatingCustom || !customTopic.name.trim() || !customTopic.description.trim()}
            >
              {generatingCustom ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            disabled={isGenerating}
            size="sm"
            className="from-primary hover:from-primary/90 md:size-default gap-2 bg-gradient-to-r to-violet-600 hover:to-violet-600/90"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {isGenerating ? 'Generating...' : 'Generate Video'}
            </span>
            <span className="sm:hidden">{isGenerating ? '...' : 'Generate'}</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setGenerateModalOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Generate Videos
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setCustomTopicModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Generate with Custom Topic
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
