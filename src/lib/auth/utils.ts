import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { organisations } from '@/lib/db/schema';
import type { db as database } from '@/lib/db';

/**
 * Convert text to a URL-safe slug with a random suffix for uniqueness.
 * Example: "Small Giants Studio" → "small-giants-studio-a3f1"
 */
export function slugify(text: string): string {
  const base = text
    .toString()
    .normalize('NFKD') // decompose accented characters (café → cafe)
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, ''); // trim hyphens from start/end

  const suffix = randomBytes(2).toString('hex'); // 4 hex chars
  return base ? `${base}-${suffix}` : suffix;
}

/**
 * Generate a unique organisation slug by checking for collisions.
 * Retries up to 5 times with a fresh random suffix each attempt.
 */
export async function generateUniqueSlug(
  name: string,
  dbInstance: typeof database,
): Promise<string> {
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = slugify(name);
    const existing = await dbInstance
      .select({ id: organisations.id })
      .from(organisations)
      .where(eq(organisations.slug, candidate))
      .limit(1);

    if (existing.length === 0) {
      return candidate;
    }
  }

  // Fallback: use a longer random suffix to virtually guarantee uniqueness
  const fallback = slugify(name + '-' + randomBytes(4).toString('hex'));
  return fallback;
}
