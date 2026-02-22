import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '../src/lib/db/index';
import { organisations } from '../src/lib/db/schema';
import { sql } from 'drizzle-orm';

async function main() {
  // Update primaryColour and accentColour in the branding JSONB for all orgs
  const result = await db
    .update(organisations)
    .set({
      branding: sql`jsonb_set(
        jsonb_set(
          ${organisations.branding},
          '{primaryColour}',
          '"#0F7E80"'
        ),
        '{accentColour}',
        '"#F87A1F"'
      )`,
    })
    .returning({ id: organisations.id, name: organisations.name, branding: organisations.branding });

  for (const org of result) {
    const branding = org.branding as Record<string, unknown>;
    console.log(`Updated ${org.name} (${org.id}):`);
    console.log(`  primaryColour: ${branding.primaryColour}`);
    console.log(`  accentColour: ${branding.accentColour}`);
  }

  console.log(`\nDone — ${result.length} organisation(s) updated.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
