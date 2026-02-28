import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

/**
 * Supabase Free tier: 50MB max per file.
 * Files over this limit are uploaded directly to VPS disk via nginx WebDAV,
 * served at /recordings/files/<path> for Deepgram to fetch.
 */
const SUPABASE_SIZE_LIMIT = 50 * 1024 * 1024;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST { bookingId, fileName, fileSize }
 *
 * Returns:
 *   For files <= 50MB:
 *     { method: 'supabase', storagePath, signedUrl }
 *   For files > 50MB:
 *     { method: 'direct', storagePath, uploadUrl }
 *
 * In both cases, the browser uploads the file directly (never through tRPC).
 * After upload, call tRPC recordings.create with the storagePath.
 */
export async function POST(req: NextRequest) {
  try {
    const { bookingId, fileName, fileSize } = await req.json();

    if (!bookingId || !fileName) {
      return NextResponse.json({ error: 'bookingId and fileName required' }, { status: 400 });
    }

    const storagePath = `${bookingId}/${Date.now()}-${fileName}`;

    if (fileSize && fileSize > SUPABASE_SIZE_LIMIT) {
      // Large file: upload to VPS disk via nginx PUT, served at /recordings/files/
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      return NextResponse.json({
        method: 'direct',
        storagePath,
        uploadUrl: `${appUrl}/recordings/upload/${storagePath}`,
      });
    }

    // Small file: Supabase signed URL
    const { data, error } = await getSupabaseAdmin().storage
      .from('meeting-recordings')
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      console.error('Supabase signed URL error:', error);
      return NextResponse.json(
        { error: `Failed to create upload URL: ${error?.message ?? 'Unknown error'}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      method: 'supabase',
      storagePath,
      signedUrl: data.signedUrl,
    });
  } catch (error) {
    console.error('Upload route error:', error);
    return NextResponse.json({ error: 'Failed to prepare upload' }, { status: 500 });
  }
}
