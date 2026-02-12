import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { ArrowRight, CalendarPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { users, bookingTypes, orgMembers } from '@/lib/db/schema';
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

export const metadata = {
  title: 'Dashboard',
};

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

  // Check if user has any booking types (for onboarding prompt)
  const membership = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, supabaseUser.id))
    .limit(1);

  let hasBookingTypes = false;
  if (membership.length > 0) {
    const types = await db
      .select({ id: bookingTypes.id })
      .from(bookingTypes)
      .where(eq(bookingTypes.orgId, membership[0].orgId))
      .limit(1);
    hasBookingTypes = types.length > 0;
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

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardDescription>Upcoming bookings</CardDescription>
                <CardTitle className="text-3xl">0</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>This week</CardDescription>
                <CardTitle className="text-3xl">0</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Total bookings</CardDescription>
                <CardTitle className="text-3xl">0</CardTitle>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
