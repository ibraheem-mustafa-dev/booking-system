import Link from 'next/link';
import { eq, and, gte, lte, count, desc, ne, sql } from 'drizzle-orm';
import {
  ArrowRight,
  CalendarPlus,
  Calendar,
  TrendingUp,
  PoundSterling,
  FileText,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import {
  users,
  bookingTypes,
  bookings,
  orgMembers,
  invoices,
} from '@/lib/db/schema';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: 'Dashboard',
};

function formatCurrency(pence: number): string {
  const pounds = pence / 100;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pounds);
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'confirmed':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Confirmed</Badge>;
    case 'cancelled':
      return <Badge variant="destructive">Cancelled</Badge>;
    case 'completed':
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Completed</Badge>;
    case 'no_show':
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">No show</Badge>;
    case 'pending':
      return <Badge variant="secondary">Pending</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (!supabaseUser) {
    return null; // Layout handles redirect
  }

  // Fetch user name
  const appUser = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, supabaseUser.id))
    .limit(1);

  const displayName = appUser[0]?.name || appUser[0]?.email || 'there';

  // Check membership
  const membership = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, supabaseUser.id))
    .limit(1);

  let hasBookingTypes = false;
  let upcomingCount = 0;
  let thisMonthCount = 0;
  let thisMonthRevenue = 0;
  let outstandingInvoicesCount = 0;
  let outstandingInvoicesTotal = 0;
  let recentBookings: {
    id: string;
    clientName: string;
    startAt: Date;
    status: string;
    bookingTypeName: string | null;
  }[] = [];

  if (membership.length > 0) {
    const orgId = membership[0].orgId;
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      typesResult,
      upcomingResult,
      thisMonthResult,
      recentResult,
      revenueResult,
      outstandingResult,
    ] = await Promise.all([
      db.select({ id: bookingTypes.id })
        .from(bookingTypes)
        .where(eq(bookingTypes.orgId, orgId))
        .limit(1),

      db.select({ value: count() })
        .from(bookings)
        .where(and(
          eq(bookings.orgId, orgId),
          eq(bookings.status, 'confirmed'),
          gte(bookings.startAt, now),
          lte(bookings.startAt, sevenDaysFromNow),
        )),

      db.select({ value: count() })
        .from(bookings)
        .where(and(
          eq(bookings.orgId, orgId),
          ne(bookings.status, 'cancelled'),
          gte(bookings.startAt, monthStart),
          lte(bookings.startAt, monthEnd),
        )),

      db.select({
          id: bookings.id,
          clientName: bookings.clientName,
          startAt: bookings.startAt,
          status: bookings.status,
          bookingTypeName: bookingTypes.name,
        })
        .from(bookings)
        .leftJoin(bookingTypes, eq(bookings.bookingTypeId, bookingTypes.id))
        .where(eq(bookings.orgId, orgId))
        .orderBy(desc(bookings.createdAt))
        .limit(5),

      db.select({
          total: sql<string>`COALESCE(SUM(${invoices.total}::numeric), 0)`,
        })
        .from(invoices)
        .where(and(
          eq(invoices.orgId, orgId),
          eq(invoices.paymentStatus, 'paid'),
          gte(invoices.paidAt, monthStart),
          lte(invoices.paidAt, monthEnd),
        )),

      db.select({
          invoiceCount: count(),
          invoiceTotal: sql<string>`COALESCE(SUM(${invoices.total}::numeric), 0)`,
        })
        .from(invoices)
        .where(and(
          eq(invoices.orgId, orgId),
          eq(invoices.paymentStatus, 'pending'),
        )),
    ]);

    hasBookingTypes = typesResult.length > 0;
    upcomingCount = upcomingResult[0]?.value ?? 0;
    thisMonthCount = thisMonthResult[0]?.value ?? 0;
    recentBookings = recentResult;
    thisMonthRevenue = Math.round(parseFloat(revenueResult[0]?.total ?? '0') * 100);
    outstandingInvoicesCount = outstandingResult[0]?.invoiceCount ?? 0;
    outstandingInvoicesTotal = Math.round(parseFloat(outstandingResult[0]?.invoiceTotal ?? '0') * 100);
  }

  return (
    <>
      <header className="flex h-14 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />
        <h1 className="text-sm font-medium">Dashboard</h1>
      </header>

      <div className="p-6 md:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Welcome back, {displayName}
            </h2>
            <p className="text-muted-foreground">
              Here&apos;s an overview of your booking system.
            </p>
          </div>

          {!hasBookingTypes && (
            <Card className="border-dashed border-2">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-(--brand-primary)">
                    <CalendarPlus className="size-5 text-white" />
                  </div>
                  <div>
                    <CardTitle>Get started</CardTitle>
                    <CardDescription>
                      Create your first booking type to start accepting
                      appointments.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/dashboard/booking-types/new">
                    Create booking type
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Stat cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>Upcoming (7 days)</CardDescription>
                <Calendar className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{upcomingCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>This month</CardDescription>
                <TrendingUp className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{thisMonthCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>Monthly revenue</CardDescription>
                <PoundSterling className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{formatCurrency(thisMonthRevenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>Outstanding invoices</CardDescription>
                <FileText className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{outstandingInvoicesCount}</p>
                {outstandingInvoicesTotal > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(outstandingInvoicesTotal)} owed
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent bookings + quick actions */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Recent bookings</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/dashboard/bookings">
                    View all
                    <ArrowRight className="ml-1 size-3" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {recentBookings.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No bookings yet.
                  </p>
                ) : (
                  <div className="rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-4 py-2 text-left font-medium">Client</th>
                          <th className="px-4 py-2 text-left font-medium">Type</th>
                          <th className="hidden px-4 py-2 text-left font-medium sm:table-cell">Date/Time</th>
                          <th className="px-4 py-2 text-right font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentBookings.map((b) => (
                          <tr key={b.id} className="border-b last:border-b-0">
                            <td className="px-4 py-2">{b.clientName}</td>
                            <td className="px-4 py-2 text-muted-foreground">{b.bookingTypeName}</td>
                            <td className="hidden px-4 py-2 text-muted-foreground sm:table-cell">
                              {b.startAt.toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                              })}{' '}
                              {b.startAt.toLocaleTimeString('en-GB', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <StatusBadge status={b.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link href="/dashboard/booking-types/new">
                    <CalendarPlus className="mr-2 size-4" />
                    New booking type
                  </Link>
                </Button>
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link href="/dashboard/bookings">
                    <Calendar className="mr-2 size-4" />
                    View all bookings
                  </Link>
                </Button>
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link href="/dashboard/invoices">
                    <FileText className="mr-2 size-4" />
                    View invoices
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
