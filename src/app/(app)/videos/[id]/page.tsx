'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
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

export default function VideoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = params.id as string;
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{video.title || 'Untitled Video'}</h1>
          <p className="text-sm text-muted-foreground">ID: {video.id}</p>
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
                <Badge variant={video.validationPassed ? 'success' : 'warning'} className="mt-1">
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
