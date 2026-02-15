/**
 * Quick script to create a test booking for testing the recordings upload
 *
 * Usage: npx tsx scripts/create-test-booking.ts
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { bookings, organisations, users, orgMembers } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

// Load environment variables
config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

async function main() {
  console.log('Creating test booking...\n');

  // Get the first user and their organisation
  const user = await db.select().from(users).limit(1);

  if (!user[0]) {
    console.error('❌ No users found. Please sign up via /login first.');
    process.exit(1);
  }

  console.log(`✓ Found user: ${user[0].email}`);

  // Get user's organisation
  const membership = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, user[0].id))
    .limit(1);

  if (!membership[0]) {
    console.error('❌ User has no organisation. Sign up should auto-create one.');
    process.exit(1);
  }

  const orgId = membership[0].orgId;
  console.log(`✓ Found organisation ID: ${orgId}`);

  // Get organisation details
  const org = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);

  console.log(`✓ Organisation: ${org[0].name}\n`);

  // Create test booking
  const startTime = new Date();
  startTime.setDate(startTime.getDate() + 7); // 1 week from now
  startTime.setHours(14, 0, 0, 0); // 2:00 PM

  const endTime = new Date(startTime);
  endTime.setHours(15, 0, 0, 0); // 3:00 PM

  const [booking] = await db
    .insert(bookings)
    .values({
      orgId,
      bookingTypeId: crypto.randomUUID(), // Dummy ID - won't reference real booking type
      organiserId: user[0].id,
      clientName: 'Test Client',
      clientEmail: 'test@example.com',
      clientPhone: '+44 7700 900000',
      clientTimezone: 'Europe/London',
      startAt: startTime,
      endAt: endTime,
      status: 'confirmed',
      notes: 'Test booking for recording upload testing',
      customFieldResponses: {},
      cancellationToken: crypto.randomUUID(),
      rescheduleToken: crypto.randomUUID(),
    })
    .returning();

  console.log('✅ Test booking created!\n');
  console.log(`Booking ID: ${booking.id}`);
  console.log(`Client: ${booking.clientName} (${booking.clientEmail})`);
  console.log(`Time: ${booking.startAt.toLocaleString('en-GB')}`);
  console.log(`Status: ${booking.status}\n`);
  console.log('You can now test the recording upload at:');
  console.log(`http://localhost:3000/dashboard/recordings\n`);

  await client.end();
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
