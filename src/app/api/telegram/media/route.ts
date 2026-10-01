import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_BOT_TOKEN = '8695197731:AAFGJVsWLVxAmzHqd8Sb8TOLRKt-DyUTcUw';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN;
  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get('file_id') || searchParams.get('fileId');
  let filePath = searchParams.get('path');

  try {
    if (!filePath && fileId) {
      const getFileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
      const fileData = await getFileRes.json();
      if (fileData.ok && fileData.result?.file_path) {
        filePath = fileData.result.file_path;
      }
    }

    if (!filePath) {
      return NextResponse.json({ error: 'File not found or file_id/path missing' }, { status: 404 });
    }

    const fileStreamRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
    if (!fileStreamRes.ok) {
      return NextResponse.json({ error: 'Failed to retrieve media from Telegram' }, { status: fileStreamRes.status });
    }

    const contentType = fileStreamRes.headers.get('content-type') || 
      (filePath.endsWith('.png') ? 'image/png' : filePath.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

    const arrayBuffer = await fileStreamRes.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error: any) {
    console.error('Error proxying Telegram media:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
