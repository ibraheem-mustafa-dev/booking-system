import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '../src/lib/db/index';
import { meetingRecordings, bookings } from '../src/lib/db/schema';

async function main() {
  const recordings = await db.select().from(meetingRecordings);
  for (const r of recordings) {
    console.log('RECORDING:', r.id, 'json:', !!r.summaryJson, 'text:', (r.summaryText || '').length);
  }

  const bks = await db.select({ id: bookings.id }).from(bookings);
  console.log('BOOKINGS:', bks.map((b) => b.id));

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
