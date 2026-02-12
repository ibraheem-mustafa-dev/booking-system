import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { users, organisations, orgMembers } from '@/lib/db/schema';
import { DashboardSidebar } from './sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (!supabaseUser) {
    redirect('/login');
  }

  // Fetch app user + organisation
  const appUser = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, supabaseUser.id))
    .limit(1);

  if (appUser.length === 0) {
    // User record not created yet — redirect through callback to sync
    redirect('/auth/callback?redirect=/dashboard');
  }

  const user = appUser[0];

  // Get user's organisation
  const membershipResult = await db
    .select({
      orgId: orgMembers.orgId,
      orgName: organisations.name,
      orgSlug: organisations.slug,
    })
    .from(orgMembers)
    .innerJoin(organisations, eq(orgMembers.orgId, organisations.id))
    .where(eq(orgMembers.userId, supabaseUser.id))
    .limit(1);

  const org = membershipResult.length > 0 ? membershipResult[0] : null;

  return (
    <SidebarProvider>
      <DashboardSidebar
        user={{
          name: user.name || user.email,
          email: user.email,
          avatarUrl: user.avatarUrl,
        }}
        orgName={org?.orgName || 'No organisation'}
      />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
