'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface ValidationIssue {
  type: 'typo' | 'made-up-word' | 'coherence' | 'clarity';
  severity: 'critical' | 'major' | 'minor';
  location: string;
  issue: string;
  suggestion: string;
}

interface ValidationResult {
  isValid: boolean;
  overallQuality: 'excellent' | 'good' | 'fair' | 'poor';
  issues: ValidationIssue[];
  summary: string;
  recommendation: 'accept' | 'revise' | 'regenerate';
}

interface VideoDetail {
  id: string;
  title: string | null;
  description: string | null;
  script: string | null;
  scriptWordCount: number | null;
  scriptModel: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  scriptValidationResult: ValidationResult | null;
  validationPassed: boolean | null;
  validationAttempts: number | null;
  topicRelation?: {
    name: string;
    description: string;
  } | null;
}

const severityConfig = {
  critical: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'Critical' },
  major: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-50', label: 'Major' },
  minor: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-50', label: 'Minor' },
};

const qualityConfig = {
  excellent: { color: 'text-green-600', badge: 'success' as const },
  good: { color: 'text-blue-600', badge: 'info' as const },
  fair: { color: 'text-yellow-600', badge: 'warning' as const },
  poor: { color: 'text-red-600', badge: 'destructive' as const },
};

const MODEL_LABELS: Record<string, string> = {
  'google/gemini-2.0-flash-001': 'Gemini 2.0 Flash',
  'qwen/qwen-2.5-72b-instruct': 'Qwen 2.5 72B',
  'deepseek/deepseek-v3.2-20251201': 'DeepSeek v3.2',
  'google/gemini-2.5-flash': 'Gemini 2.5 Flash',
  'google/gemini-2.5-pro': 'Gemini 2.5 Pro',
  'openai/gpt-5.2-20251211': 'GPT-5.2',
  'openai/gpt-4o': 'GPT-4o',
  'anthropic/claude-4.5-sonnet-20250929': 'Claude 4.5 Sonnet',
  'anthropic/claude-4.5-opus-20251124': 'Claude 4.5 Opus',
};

function formatModelName(model: string | null): string | null {
  if (!model) return null;
  return MODEL_LABELS[model] || model.split('/').pop() || model;
}

export default function VideoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = params.id as string;
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);

  useEffect(() => {
    async function fetchVideo() {
      try {
        const response = await fetch(`/api/videos/${videoId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch video');
        }
        const data = await response.json();
        setVideo(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchVideo();
  }, [videoId]);

  const saveTitle = async () => {
    if (!editingTitleValue.trim() || !video) {
      setEditingTitle(false);
      return;
    }
    setSavingTitle(true);
    try {
      const res = await fetch(`/api/videos/${videoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editingTitleValue.trim() }),
      });
      if (res.ok) {
        setVideo({ ...video, title: editingTitleValue.trim() });
      }
    } catch (err) {
      console.error('Failed to save title:', err);
    } finally {
      setSavingTitle(false);
      setEditingTitle(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <p className="text-red-500">Error: {error || 'Video not found'}</p>
          <Button onClick={() => router.push('/')} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const validation = video.scriptValidationResult;

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              type="text"
              value={editingTitleValue}
              onChange={(e) => setEditingTitleValue(e.target.value)}
              onBlur={() => saveTitle()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') setEditingTitle(false);
              }}
              autoFocus
              disabled={savingTitle}
              className="w-full bg-transparent text-3xl font-bold outline-none border-b border-primary"
            />
          ) : (
            <div className="group/title flex items-center gap-2">
              <h1 className="text-3xl font-bold">{video.title || 'Untitled Video'}</h1>
              <button
                className="shrink-0 text-muted-foreground hover:text-primary transition-colors md:opacity-0 md:group-hover/title:opacity-100"
                onClick={() => {
                  setEditingTitle(true);
                  setEditingTitleValue(video.title || '');
                }}
                title="Edit title"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          )}
          <p className="mt-1 text-sm text-muted-foreground">ID: {video.id}</p>
        </div>
      </div>

      {/* Video Info */}
      <Card>
        <CardHeader>
          <CardTitle>Video Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Status</p>
            <Badge className="mt-1">{video.status}</Badge>
          </div>
          {video.scriptModel && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Model</p>
              <Badge className="mt-1 border-transparent bg-teal-500/15 text-teal-600 hover:bg-teal-500/15 dark:bg-teal-500/20 dark:text-teal-400">
                {formatModelName(video.scriptModel)}
              </Badge>
            </div>
          )}
          {video.topicRelation && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Topic</p>
              <p className="font-medium">{video.topicRelation.name}</p>
              <p className="text-sm text-muted-foreground">{video.topicRelation.description}</p>
            </div>
          )}
          {video.description && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Description</p>
              <p>{video.description}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Word Count</p>
              <p>{video.scriptWordCount || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Created</p>
              <p>{new Date(video.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Summary */}
      {validation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {video.validationPassed ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
              Script Validation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant={video.validationPassed ? 'success' : 'destructive'} className="mt-1">
                  {video.validationPassed ? 'Passed' : 'Has Issues'}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Quality</p>
                <Badge variant={qualityConfig[validation.overallQuality].badge} className="mt-1">
                  {validation.overallQuality.charAt(0).toUpperCase() +
                    validation.overallQuality.slice(1)}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Attempts</p>
                <p className="mt-1">{video.validationAttempts || 1}</p>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Summary</p>
              <p className="text-sm">{validation.summary}</p>
            </div>

            {/* Issues List */}
            {validation.issues.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  Issues Found ({validation.issues.length})
                </p>
                <div className="space-y-3">
                  {validation.issues.map((issue, index) => {
                    const config = severityConfig[issue.severity];
                    const Icon = config.icon;

                    return (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border ${config.bg} border-${issue.severity === 'critical' ? 'red' : issue.severity === 'major' ? 'orange' : 'yellow'}-200`}
                      >
                        <div className="flex items-start gap-3">
                          <Icon className={`h-5 w-5 mt-0.5 ${config.color}`} />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  issue.severity === 'critical'
                                    ? 'destructive'
                                    : issue.severity === 'major'
                                      ? 'warning'
                                      : 'secondary'
                                }
                                className="text-xs"
                              >
                                {config.label}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {issue.type}
                              </Badge>
                            </div>
                            <div>
                              <p className="font-medium text-sm">{issue.issue}</p>
                              {issue.location && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  Location: "{issue.location}"
                                </p>
                              )}
                            </div>
                            {issue.suggestion && (
                              <div className="pt-2 border-t">
                                <p className="text-xs font-medium text-muted-foreground">
                                  Suggestion:
                                </p>
                                <p className="text-sm">{issue.suggestion}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {validation.issues.length === 0 && (
              <div className="flex items-center gap-2 p-4 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-sm text-green-700">No issues found in the script!</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Script Content */}
      {video.script && (
        <Card>
          <CardHeader>
            <CardTitle>Script</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-muted p-4 rounded-lg">
                {video.script}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
