'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Clock,
  MapPin,
  Video,
  Phone,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useState } from 'react';

const locationIcons = {
  online: Video,
  in_person: MapPin,
  phone: Phone,
} as const;

const locationLabels = {
  online: 'Online',
  in_person: 'In person',
  phone: 'Phone',
} as const;

export default function BookingTypesPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: bookingTypes, isLoading } = trpc.bookingTypes.list.useQuery();

  const toggleActive = trpc.bookingTypes.toggleActive.useMutation({
    onSuccess: (updated) => {
      utils.bookingTypes.list.invalidate();
      toast.success(
        updated.isActive
          ? `${updated.name} is now active`
          : `${updated.name} has been deactivated`,
      );
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.bookingTypes.delete.useMutation({
    onSuccess: () => {
      utils.bookingTypes.list.invalidate();
      toast.success('Booking type deleted');
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(error.message);
      setDeleteTarget(null);
    },
  });

  return (
    <>
      <header className="flex h-14 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />
        <h1 className="text-sm font-medium">Booking Types</h1>
        <div className="ml-auto">
          <Button asChild size="sm">
            <Link href="/dashboard/booking-types/new">
              <Plus className="mr-2 size-4" />
              New booking type
            </Link>
          </Button>
        </div>
      </header>

      <div className="p-6 md:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          {isLoading && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && bookingTypes?.length === 0 && (
            <Card className="border-dashed border-2">
              <CardHeader className="text-center">
                <CardTitle>No booking types yet</CardTitle>
                <CardDescription>
                  Create your first booking type to start accepting
                  appointments.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Button asChild>
                  <Link href="/dashboard/booking-types/new">
                    <Plus className="mr-2 size-4" />
                    Create booking type
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {!isLoading && bookingTypes && bookingTypes.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {bookingTypes.map((bt) => {
                const LocationIcon = locationIcons[bt.locationType];
                return (
                  <Card
                    key={bt.id}
                    className={!bt.isActive ? 'opacity-60' : undefined}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="size-3 rounded-full shrink-0"
                            style={{ backgroundColor: bt.colour }}
                          />
                          <CardTitle className="text-base leading-tight">
                            {bt.name}
                          </CardTitle>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                            >
                              <MoreHorizontal className="size-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(
                                  `/dashboard/booking-types/${bt.id}/edit`,
                                )
                              }
                            >
                              <Pencil className="mr-2 size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                toggleActive.mutate({ id: bt.id })
                              }
                            >
                              {bt.isActive ? (
                                <>
                                  <EyeOff className="mr-2 size-4" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <Eye className="mr-2 size-4" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() =>
                                setDeleteTarget({
                                  id: bt.id,
                                  name: bt.name,
                                })
                              }
                            >
                              <Trash2 className="mr-2 size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {bt.description && (
                        <CardDescription className="line-clamp-2">
                          {bt.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="size-3.5" />
                          {bt.durationMins} min
                        </div>
                        <div className="flex items-center gap-1">
                          <LocationIcon className="size-3.5" />
                          {locationLabels[bt.locationType]}
                        </div>
                        {!bt.isActive && (
                          <Badge variant="secondary" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                        {bt.requiresPayment && bt.priceAmount && (
                          <Badge variant="outline" className="text-xs">
                            {bt.priceCurrency} {bt.priceAmount}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete booking type</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}
              &rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })
              }
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
