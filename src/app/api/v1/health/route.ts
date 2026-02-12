import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * Health check endpoint for uptime monitoring (UptimeRobot, etc.).
 * Returns 200 if the app is running and the database is reachable.
 */
export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { status: 'unhealthy', timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
