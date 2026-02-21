/**
 * Setup test data for recordings upload testing
 *
 * Usage: npx tsx scripts/setup-test-data.ts
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { bookings, bookingTypes, organisations, users, orgMembers } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

// Load environment variables
config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

async function main() {
  console.log('Setting up test data for recording upload...\n');

  // Get the first user
  const [user] = await db.select().from(users).limit(1);

  if (!user) {
    console.error('❌ No users found. Sign up via /login first.');
    console.error('   Go to: http://localhost:3000/login');
    process.exit(1);
  }

  console.log(`✓ User: ${user.email}`);

  // Get user's organisation
  const [membership] = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, user.id))
    .limit(1);

  if (!membership) {
    console.error('❌ User has no organisation.');
    process.exit(1);
  }

  const orgId = membership.orgId;
  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);

  console.log(`✓ Organisation: ${org.name}`);

  // Check for existing booking type
  let [bookingType] = await db
    .select()
    .from(bookingTypes)
    .where(eq(bookingTypes.orgId, orgId))
    .limit(1);

  if (!bookingType) {
    console.log('\nCreating test booking type...');
    [bookingType] = await db
      .insert(bookingTypes)
      .values({
        orgId,
        name: 'Test Consultation',
        slug: 'test-consultation',
        description: 'Test booking type for recording upload testing',
        durationMins: 60,
        priceAmount: '0',
        priceCurrency: 'GBP',
        requiresPayment: false,
        customFields: { fields: [] },
        isActive: true,
      })
      .returning();

    console.log(`✓ Created booking type: "${bookingType.name}"`);
  } else {
    console.log(`✓ Booking type: "${bookingType.name}"`);
  }

  // Create test booking
  console.log('\nCreating test booking...');

  const startTime = new Date();
  startTime.setDate(startTime.getDate() - 1); // Yesterday (so it looks "past")
  startTime.setHours(14, 0, 0, 0);

  const endTime = new Date(startTime);
  endTime.setHours(15, 0, 0, 0);

  const [booking] = await db
    .insert(bookings)
    .values({
      orgId,
      bookingTypeId: bookingType.id,
      organiserId: user.id,
      clientName: 'Test Client',
      clientEmail: 'test@example.com',
      clientPhone: '+44 7700 900123',
      clientTimezone: 'Europe/London',
      startAt: startTime,
      endAt: endTime,
      status: 'confirmed',
      notes: 'Test booking for recording upload',
      customFieldResponses: {},
      cancellationToken: crypto.randomUUID(),
      rescheduleToken: crypto.randomUUID(),
    })
    .returning();

  console.log('\n✅ Test data created!\n');
  console.log(`Booking ID: ${booking.id}`);
  console.log(`Client: ${booking.clientName}`);
  console.log(`Time: ${booking.startAt.toLocaleString('en-GB')}`);
  console.log('\nYou can now test recording upload at:');
  console.log(`→ http://localhost:3000/dashboard/recordings\n`);

  await client.end();
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  console.error('\nStack:', error.stack);
  process.exit(1);
});
