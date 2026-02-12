'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  RefreshCw,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ---------------------------------------------------------------------------
// Provider display config
// ---------------------------------------------------------------------------

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google Calendar',
  outlook: 'Microsoft Outlook',
  apple: 'Apple Calendar',
};

const PROVIDER_COLOURS: Record<string, string> = {
  google: '#4285F4',
  outlook: '#0078D4',
  apple: '#333333',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CalendarConnections() {
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();

  const [disconnectTarget, setDisconnectTarget] = useState<{
    id: string;
    email: string | null;
    provider: string;
  } | null>(null);

  // Show toast based on URL params from OAuth callback
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'google_connected') {
      toast.success('Google Calendar connected successfully');
    } else if (error === 'google_denied') {
      toast.error('Google Calendar connection was denied');
    } else if (error === 'google_failed') {
      toast.error('Failed to connect Google Calendar. Please try again.');
    } else if (error === 'auth_mismatch') {
      toast.error('Authentication mismatch. Please try again.');
    } else if (error === 'missing_params') {
      toast.error('Invalid callback — missing parameters.');
    }
  }, [searchParams]);

  const { data: accounts, isLoading: accountsLoading } =
    trpc.calendar.listAccounts.useQuery();

  const disconnectMutation = trpc.calendar.disconnect.useMutation({
    onSuccess: () => {
      utils.calendar.listAccounts.invalidate();
      utils.calendar.listAllConnections.invalidate();
      toast.success('Calendar disconnected');
      setDisconnectTarget(null);
    },
    onError: (error) => {
      toast.error(error.message);
      setDisconnectTarget(null);
    },
  });

  if (accountsLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Connect button */}
        <Card>
          <CardHeader>
            <CardTitle>Calendar Connections</CardTitle>
            <CardDescription>
              Connect your calendars to automatically block out busy times when
              calculating availability. You control which calendars are checked
              — &ldquo;yes there&rsquo;s an event at 1pm but I can still take
              calls&rdquo;.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <a href="/api/auth/google/connect">
                  <svg
                    className="mr-2 size-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Connect Google Calendar
                </a>
              </Button>
              {/* Outlook and Apple will be added in later steps */}
            </div>
          </CardContent>
        </Card>

        {/* Connected accounts */}
        {accounts && accounts.length > 0 && (
          <div className="space-y-4">
            {accounts.map((account) => (
              <ConnectedAccount
                key={account.id}
                account={account}
                onDisconnect={() =>
                  setDisconnectTarget({
                    id: account.id,
                    email: account.email,
                    provider: account.provider,
                  })
                }
              />
            ))}
          </div>
        )}

        {accounts && accounts.length === 0 && (
          <Card className="border-dashed border-2">
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No calendars connected. Connect a calendar above to sync your
                busy times.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Disconnect confirmation dialogue */}
      <Dialog
        open={!!disconnectTarget}
        onOpenChange={(open) => !open && setDisconnectTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect calendar</DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect{' '}
              {disconnectTarget
                ? `${PROVIDER_LABELS[disconnectTarget.provider] || disconnectTarget.provider}${disconnectTarget.email ? ` (${disconnectTarget.email})` : ''}`
                : 'this calendar'}
              ? This will remove all synced calendar data. You can reconnect at
              any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDisconnectTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={disconnectMutation.isPending}
              onClick={() =>
                disconnectTarget &&
                disconnectMutation.mutate({ accountId: disconnectTarget.id })
              }
            >
              {disconnectMutation.isPending
                ? 'Disconnecting...'
                : 'Disconnect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Connected Account Card — shows calendars with toggle switches
// ---------------------------------------------------------------------------

function ConnectedAccount({
  account,
  onDisconnect,
}: {
  account: {
    id: string;
    provider: string;
    email: string | null;
    createdAt: Date;
  };
  onDisconnect: () => void;
}) {
  const utils = trpc.useUtils();

  const { data: connections, isLoading } =
    trpc.calendar.listConnections.useQuery({ accountId: account.id });

  const syncMutation = trpc.calendar.syncCalendars.useMutation({
    onSuccess: () => {
      utils.calendar.listConnections.invalidate({ accountId: account.id });
      toast.success('Calendars synced');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const toggleMutation = trpc.calendar.toggleSelected.useMutation({
    onSuccess: (updated) => {
      utils.calendar.listConnections.invalidate({ accountId: account.id });
      utils.calendar.listAllConnections.invalidate();
      toast.success(
        updated.isSelected
          ? `${updated.name} will be checked for busy times`
          : `${updated.name} will be ignored`,
      );
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const providerColour = PROVIDER_COLOURS[account.provider] || '#666';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="size-3 rounded-full shrink-0"
              style={{ backgroundColor: providerColour }}
            />
            <div className="min-w-0">
              <CardTitle className="text-base">
                {PROVIDER_LABELS[account.provider] || account.provider}
              </CardTitle>
              {account.email && (
                <CardDescription className="truncate">
                  {account.email}
                </CardDescription>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={() => syncMutation.mutate({ accountId: account.id })}
              disabled={syncMutation.isPending}
              aria-label="Sync calendars"
            >
              <RefreshCw
                className={`size-4 ${syncMutation.isPending ? 'animate-spin' : ''}`}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={onDisconnect}
              aria-label="Disconnect account"
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {!isLoading && connections && connections.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No calendars found. Try syncing.
          </p>
        )}

        {!isLoading && connections && connections.length > 0 && (
          <div className="space-y-2">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {conn.colour && (
                    <div
                      className="size-3 rounded-full shrink-0"
                      style={{ backgroundColor: conn.colour }}
                    />
                  )}
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {conn.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {conn.isPrimary && (
                        <Badge variant="secondary" className="text-xs">
                          Primary
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {conn.isSelected
                          ? 'Checking for busy times'
                          : 'Ignored'}
                      </span>
                    </div>
                  </div>
                </div>
                <Switch
                  checked={conn.isSelected}
                  onCheckedChange={() =>
                    toggleMutation.mutate({ connectionId: conn.id })
                  }
                  disabled={toggleMutation.isPending}
                  aria-label={`Toggle ${conn.name} busy time checking`}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
