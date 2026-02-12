'use client';

import { Suspense } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkingHoursEditor } from './_components/working-hours-editor';
import { OverridesEditor } from './_components/overrides-editor';
import { CalendarConnections } from './_components/calendar-connections';

export default function AvailabilityPage() {
  return (
    <>
      <header className="flex h-14 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />
        <h1 className="text-sm font-medium">Availability</h1>
      </header>

      <div className="p-6 md:p-8">
        <div className="mx-auto max-w-3xl">
          <Tabs defaultValue="working-hours">
            <TabsList className="mb-6">
              <TabsTrigger value="working-hours">Working Hours</TabsTrigger>
              <TabsTrigger value="overrides">Overrides</TabsTrigger>
              <TabsTrigger value="calendars">Calendars</TabsTrigger>
            </TabsList>

            <TabsContent value="working-hours">
              <WorkingHoursEditor />
            </TabsContent>

            <TabsContent value="overrides">
              <OverridesEditor />
            </TabsContent>

            <TabsContent value="calendars">
              <Suspense>
                <CalendarConnections />
              </Suspense>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
