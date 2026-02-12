import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { calendarAccounts, calendarConnections } from '@/lib/db/schema';
import { syncCalendarList } from '@/lib/calendar/google';

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const calendarRouter = router({
  /** List all connected calendar accounts for the current user */
  listAccounts: protectedProcedure.query(async ({ ctx }) => {
    const accounts = await ctx.db
      .select({
        id: calendarAccounts.id,
        provider: calendarAccounts.provider,
        email: calendarAccounts.email,
        createdAt: calendarAccounts.createdAt,
      })
      .from(calendarAccounts)
      .where(eq(calendarAccounts.userId, ctx.user.id))
      .orderBy(calendarAccounts.createdAt);

    return accounts;
  }),

  /** List all calendar connections for a specific account */
  listConnections: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify the account belongs to this user
      const [account] = await ctx.db
        .select({ id: calendarAccounts.id })
        .from(calendarAccounts)
        .where(
          and(
            eq(calendarAccounts.id, input.accountId),
            eq(calendarAccounts.userId, ctx.user.id),
          ),
        )
        .limit(1);

      if (!account) {
        throw new Error('Calendar account not found');
      }

      return ctx.db
        .select()
        .from(calendarConnections)
        .where(eq(calendarConnections.calendarAccountId, input.accountId))
        .orderBy(calendarConnections.name);
    }),

  /** List ALL calendar connections across all accounts for the current user */
  listAllConnections: protectedProcedure.query(async ({ ctx }) => {
    const accounts = await ctx.db
      .select({ id: calendarAccounts.id })
      .from(calendarAccounts)
      .where(eq(calendarAccounts.userId, ctx.user.id));

    if (accounts.length === 0) return [];

    // Fetch connections for all accounts
    const connections = [];
    for (const account of accounts) {
      const accountConnections = await ctx.db
        .select()
        .from(calendarConnections)
        .where(eq(calendarConnections.calendarAccountId, account.id))
        .orderBy(calendarConnections.name);
      connections.push(...accountConnections);
    }

    return connections;
  }),

  /** Toggle whether a calendar is checked for busy times */
  toggleSelected: protectedProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership: connection → account → user
      const [connection] = await ctx.db
        .select({
          id: calendarConnections.id,
          isSelected: calendarConnections.isSelected,
          accountId: calendarConnections.calendarAccountId,
        })
        .from(calendarConnections)
        .where(eq(calendarConnections.id, input.connectionId))
        .limit(1);

      if (!connection) {
        throw new Error('Calendar connection not found');
      }

      // Verify the account belongs to this user
      const [account] = await ctx.db
        .select({ id: calendarAccounts.id })
        .from(calendarAccounts)
        .where(
          and(
            eq(calendarAccounts.id, connection.accountId),
            eq(calendarAccounts.userId, ctx.user.id),
          ),
        )
        .limit(1);

      if (!account) {
        throw new Error('Calendar account not found');
      }

      const [updated] = await ctx.db
        .update(calendarConnections)
        .set({ isSelected: !connection.isSelected })
        .where(eq(calendarConnections.id, input.connectionId))
        .returning();

      return updated;
    }),

  /** Re-sync calendar list from the provider */
  syncCalendars: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const [account] = await ctx.db
        .select({ id: calendarAccounts.id, provider: calendarAccounts.provider })
        .from(calendarAccounts)
        .where(
          and(
            eq(calendarAccounts.id, input.accountId),
            eq(calendarAccounts.userId, ctx.user.id),
          ),
        )
        .limit(1);

      if (!account) {
        throw new Error('Calendar account not found');
      }

      if (account.provider === 'google') {
        await syncCalendarList(input.accountId);
      }

      return { success: true };
    }),

  /** Disconnect a calendar account (deletes account + all connections) */
  disconnect: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const [account] = await ctx.db
        .select({ id: calendarAccounts.id })
        .from(calendarAccounts)
        .where(
          and(
            eq(calendarAccounts.id, input.accountId),
            eq(calendarAccounts.userId, ctx.user.id),
          ),
        )
        .limit(1);

      if (!account) {
        throw new Error('Calendar account not found');
      }

      // Connections are deleted via ON DELETE CASCADE
      await ctx.db
        .delete(calendarAccounts)
        .where(eq(calendarAccounts.id, input.accountId));

      return { success: true };
    }),
});
