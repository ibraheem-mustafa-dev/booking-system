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
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

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

function StatusDot({ status }: { status: string }) {
  const colours: Record<string, string> = {
    confirmed:  'bg-green-500',
    cancelled:  'bg-red-500',
    completed:  'bg-blue-500',
    no_show:    'bg-amber-500',
    pending:    'bg-zinc-500',
  };
  const labels: Record<string, string> = {
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    completed: 'Completed',
    no_show:   'No show',
    pending:   'Pending',
  };

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span className={`size-2 rounded-full ${colours[status] ?? 'bg-zinc-500'}`} aria-hidden="true" />
      {labels[status] ?? status}
    </span>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (!supabaseUser) return null;

  const appUser = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, supabaseUser.id))
    .limit(1);

  const displayName = appUser[0]?.name || appUser[0]?.email || 'there';

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
      {/* ── Top bar ── */}
      <header className="flex h-14 items-center gap-2 border-b border-border/50 px-4">
        <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="h-4 bg-border/50" />
        <h1 className="text-sm font-medium text-muted-foreground">Dashboard</h1>
      </header>

      <div className="p-6 md:p-8">
        <div className="mx-auto max-w-5xl space-y-8">

          {/* ── Page heading ── */}
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome back, {displayName}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Here&apos;s what&apos;s happening with your bookings.
            </p>
          </div>

          {/* ── Onboarding prompt ── */}
          {!hasBookingTypes && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary">
                  <CalendarPlus className="size-5 text-white" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Get started</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Create your first booking type to start accepting appointments.
                  </p>
                  <Button asChild size="sm" className="mt-4">
                    <Link href="/dashboard/booking-types/new">
                      Create booking type
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Bento stat grid ── */}
          <div className="spotlight-group grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Hero stat — upcoming (larger) */}
            <div className="hover-lift rounded-xl border border-border bg-card p-5 transition-[border-color,box-shadow] hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10 lg:col-span-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Upcoming (7 days)
                </p>
                <Calendar className="size-4 text-primary" aria-hidden="true" />
              </div>
              <p className="mt-3 font-mono text-4xl font-bold tabular text-foreground">
                {upcomingCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">confirmed bookings</p>
            </div>

            <div className="hover-lift rounded-xl border border-border bg-card p-5 transition-[border-color,box-shadow] hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  This month
                </p>
                <TrendingUp className="size-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="mt-3 font-mono text-3xl font-bold tabular text-foreground">
                {thisMonthCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">total bookings</p>
            </div>

            <div className="hover-lift rounded-xl border border-border bg-card p-5 transition-[border-color,box-shadow] hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Monthly revenue
                </p>
                <PoundSterling className="size-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="mt-3 font-mono text-3xl font-bold tabular text-foreground">
                {formatCurrency(thisMonthRevenue)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">from paid invoices</p>
            </div>

            <div className="hover-lift rounded-xl border border-border bg-card p-5 transition-[border-color,box-shadow] hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Outstanding
                </p>
                <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="mt-3 font-mono text-3xl font-bold tabular text-foreground">
                {outstandingInvoicesCount}
              </p>
              <p className="mt-1 font-mono text-xs tabular text-muted-foreground">
                {outstandingInvoicesTotal > 0
                  ? `${formatCurrency(outstandingInvoicesTotal)} owed`
                  : 'no outstanding invoices'}
              </p>
            </div>
          </div>

          {/* ── Recent bookings + quick actions ── */}
          <div className="grid gap-6 lg:grid-cols-3">

            {/* Recent bookings — row cards, not HTML table */}
            <div className="rounded-xl border border-border bg-card lg:col-span-2">
              <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
                <h3 className="text-sm font-semibold text-foreground">Recent bookings</h3>
                <Button asChild variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground">
                  <Link href="/dashboard/bookings">
                    View all
                    <ArrowRight className="size-3" />
                  </Link>
                </Button>
              </div>

              {recentBookings.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm text-muted-foreground">No bookings yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {recentBookings.map((b) => (
                    <Link
                      key={b.id}
                      href={`/dashboard/bookings/${b.id}`}
                      className={`flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/30 ${getStatusStripeClass(b.status)}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {b.clientName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {b.bookingTypeName}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-xs tabular text-muted-foreground">
                          {b.startAt.toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                          })}{' '}
                          {b.startAt.toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <StatusDot status={b.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border/50 px-5 py-4">
                <h3 className="text-sm font-semibold text-foreground">Quick actions</h3>
              </div>
              <div className="space-y-2 p-4">
                <Button asChild className="w-full justify-start" variant="ghost" size="sm">
                  <Link href="/dashboard/booking-types/new">
                    <CalendarPlus className="size-4 text-primary" />
                    New booking type
                  </Link>
                </Button>
                <Button asChild className="w-full justify-start" variant="ghost" size="sm">
                  <Link href="/dashboard/bookings">
                    <Calendar className="size-4 text-primary" />
                    View all bookings
                  </Link>
                </Button>
                <Button asChild className="w-full justify-start" variant="ghost" size="sm">
                  <Link href="/dashboard/invoices">
                    <FileText className="size-4 text-primary" />
                    View invoices
                  </Link>
                </Button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

function getStatusStripeClass(status: string): string {
  const map: Record<string, string> = {
    confirmed: 'status-confirmed',
    cancelled:  'status-cancelled',
    completed:  'status-completed',
    no_show:    'status-no-show',
    pending:    'status-pending',
  };
  return map[status] ?? 'status-pending';
}
