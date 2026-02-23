import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Generate a signed upload URL for direct browser-to-Supabase upload.
 * The file never touches our server — avoids OOM on the 512MB container.
 *
 * POST { bookingId, fileName, contentType }
 * Returns { storagePath, signedUrl, token }
 */
export async function POST(req: NextRequest) {
  try {
    const { bookingId, fileName, contentType } = await req.json();

    if (!bookingId || !fileName) {
      return NextResponse.json({ error: 'bookingId and fileName required' }, { status: 400 });
    }

    const storagePath = `${bookingId}/${Date.now()}-${fileName}`;

    const { data, error } = await getSupabaseAdmin().storage
      .from('meeting-recordings')
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      return NextResponse.json(
        { error: `Failed to create upload URL: ${error?.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      storagePath,
      signedUrl: data.signedUrl,
      token: data.token,
    });
  } catch (error) {
    console.error('Signed URL generation error:', error);
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }
}
