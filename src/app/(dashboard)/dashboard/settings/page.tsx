import { eq } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { organisations, orgMembers, users } from '@/lib/db/schema';
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
  title: 'Settings',
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (!supabaseUser) {
    return null;
  }

  const membership = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, supabaseUser.id))
    .limit(1);

  if (membership.length === 0) {
    return null;
  }

  const [org] = await db
    .select({
      name: organisations.name,
      slug: organisations.slug,
      branding: organisations.branding,
    })
    .from(organisations)
    .where(eq(organisations.id, membership[0].orgId))
    .limit(1);

  const [appUser] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, supabaseUser.id))
    .limit(1);

  return (
    <>
      <header className="flex h-14 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />
        <h1 className="text-sm font-medium">Settings</h1>
      </header>

      <div className="p-6 md:p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
            <p className="text-muted-foreground">
              Manage your organisation and account settings.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Organisation</CardTitle>
              <CardDescription>
                Your organisation details and public booking page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-1">
                <span className="text-sm font-medium">Name</span>
                <span className="text-sm text-muted-foreground">
                  {org.name}
                </span>
              </div>
              <div className="grid gap-1">
                <span className="text-sm font-medium">Booking page URL</span>
                <span className="text-sm text-muted-foreground">
                  /book/{org.slug}
                </span>
              </div>
              {org.branding.companyName && (
                <div className="grid gap-1">
                  <span className="text-sm font-medium">Company name</span>
                  <span className="text-sm text-muted-foreground">
                    {org.branding.companyName}
                  </span>
                </div>
              )}
              {org.branding.vatNumber && (
                <div className="grid gap-1">
                  <span className="text-sm font-medium">VAT number</span>
                  <span className="text-sm text-muted-foreground">
                    {org.branding.vatNumber}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>
                Your personal account information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-1">
                <span className="text-sm font-medium">Name</span>
                <span className="text-sm text-muted-foreground">
                  {appUser?.name ?? 'Not set'}
                </span>
              </div>
              <div className="grid gap-1">
                <span className="text-sm font-medium">Email</span>
                <span className="text-sm text-muted-foreground">
                  {appUser?.email}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>
                Customise the look of your public booking pages.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1">
                  <span className="text-sm font-medium">Primary colour</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="size-5 rounded border"
                      style={{ backgroundColor: org.branding.primaryColour }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {org.branding.primaryColour}
                    </span>
                  </div>
                </div>
                <div className="grid gap-1">
                  <span className="text-sm font-medium">Accent colour</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="size-5 rounded border"
                      style={{ backgroundColor: org.branding.accentColour }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {org.branding.accentColour}
                    </span>
                  </div>
                </div>
                <div className="grid gap-1">
                  <span className="text-sm font-medium">Font</span>
                  <span className="text-sm text-muted-foreground">
                    {org.branding.fontFamily}
                  </span>
                </div>
                <div className="grid gap-1">
                  <span className="text-sm font-medium">Border radius</span>
                  <span className="text-sm text-muted-foreground">
                    {org.branding.borderRadius}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
