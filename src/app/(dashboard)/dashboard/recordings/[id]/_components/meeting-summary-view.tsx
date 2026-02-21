'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Copy,
  Check,
  MessageSquareQuote,
  Hash,
  Users,
  CalendarDays,
  Link2,
  CircleCheckBig,
  Gavel,
  Lightbulb,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { MeetingSummary } from '@/lib/ai/gemini';

interface MeetingSummaryViewProps {
  summary: MeetingSummary;
  speakerLabels: Record<string, string>;
}

/** Replace "Speaker N" with named labels throughout text */
function applySpeakerLabels(text: string, labels: Record<string, string>): string {
  let result = text;
  for (const [key, name] of Object.entries(labels)) {
    if (name.trim()) {
      result = result.replaceAll(`Speaker ${key}`, name);
    }
  }
  return result;
}

/** Copy text to clipboard with toast feedback */
function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(label ? `${label} copied` : 'Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-8 w-8 p-0"
      aria-label={label ? `Copy ${label}` : 'Copy to clipboard'}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </Button>
  );
}

/** Section wrapper that hides when empty */
function Section({
  title,
  icon: Icon,
  copyText,
  children,
  show,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  copyText?: string;
  children: React.ReactNode;
  show: boolean;
}) {
  if (!show) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          {copyText && <CopyButton text={copyText} label={title} />}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function MeetingSummaryView({ summary, speakerLabels }: MeetingSummaryViewProps) {
  const label = (text: string) => applySpeakerLabels(text, speakerLabels);

  const facts = summary.memorableFacts;
  const hasAnyFacts =
    facts.quotes.length + facts.stats.length + facts.names.length + facts.dates.length > 0;

  // Build copy text for key points section
  const keyPointsCopyText = summary.keyPoints
    .map((kp) => `${label(kp.title)}\n${label(kp.detail)}`)
    .join('\n\n');

  // Build copy text for action items
  const actionsCopyText = summary.actionItems
    .map((ai) => `${label(ai.text)}${ai.owner ? ` (${label(ai.owner)})` : ''}`)
    .join('\n');

  // Build copy text for facts
  const factsCopyText = [
    ...facts.quotes.map((q) => label(q)),
    ...facts.stats,
    ...facts.names,
    ...facts.dates,
  ].join('\n');

  return (
    <div className="space-y-4">
      {/* Overview */}
      <Section
        title="Summary"
        icon={Lightbulb}
        copyText={label(summary.summary)}
        show={!!summary.summary}
      >
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {label(summary.summary)}
          </ReactMarkdown>
        </div>
      </Section>

      {/* Key Points — Accordion */}
      <Section
        title="Key Points"
        icon={Lightbulb}
        copyText={keyPointsCopyText}
        show={summary.keyPoints.length > 0}
      >
        <Accordion type="multiple" className="-mt-2">
          {summary.keyPoints.map((kp, i) => (
            <AccordionItem key={i} value={`kp-${i}`}>
              <AccordionTrigger className="text-sm font-medium">
                {label(kp.title)}
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {label(kp.detail)}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Section>

      {/* Facts & Phrases to Remember */}
      <Section
        title="Facts & Phrases to Remember"
        icon={MessageSquareQuote}
        copyText={factsCopyText}
        show={hasAnyFacts}
      >
        <div className="space-y-4">
          {facts.quotes.length > 0 && (
            <FactsGroup icon={MessageSquareQuote} label="Quotes" items={facts.quotes.map(label)} variant="secondary" />
          )}
          {facts.stats.length > 0 && (
            <FactsGroup icon={Hash} label="Numbers & Stats" items={facts.stats} variant="outline" />
          )}
          {facts.names.length > 0 && (
            <FactsGroup icon={Users} label="Names & Titles" items={facts.names} variant="outline" />
          )}
          {facts.dates.length > 0 && (
            <FactsGroup icon={CalendarDays} label="Dates" items={facts.dates} variant="outline" />
          )}
        </div>
      </Section>

      {/* Mentioned URLs */}
      <Section
        title="Mentioned URLs"
        icon={Link2}
        copyText={summary.mentionedUrls.map((u) => u.url).join('\n')}
        show={summary.mentionedUrls.length > 0}
      >
        <ul className="space-y-2">
          {summary.mentionedUrls.map((u, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div>
                <a
                  href={u.url.startsWith('http') ? u.url : `https://${u.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {u.url}
                </a>
                {u.context && (
                  <p className="text-muted-foreground">{u.context}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Action Items */}
      <Section
        title="Action Items"
        icon={CircleCheckBig}
        copyText={actionsCopyText}
        show={summary.actionItems.length > 0}
      >
        <div className="space-y-2">
          {summary.actionItems.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3"
            >
              <div className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-muted-foreground/40" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{label(item.text)}</p>
                {item.owner && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {label(item.owner)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Decisions */}
      <Section
        title="Decisions Made"
        icon={Gavel}
        copyText={summary.decisions.join('\n')}
        show={summary.decisions.length > 0}
      >
        <ul className="space-y-2">
          {summary.decisions.map((decision, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Gavel className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>{label(decision)}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

/** Category label + badge chips */
function FactsGroup({
  icon: Icon,
  label,
  items,
  variant,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  items: string[];
  variant: 'secondary' | 'outline';
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <Badge key={i} variant={variant} className="text-xs">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}
