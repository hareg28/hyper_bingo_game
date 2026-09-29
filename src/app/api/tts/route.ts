import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const amharicNumbers = [
  '', 'አንድ', 'ሁለት', 'ሶስት', 'አራት', 'አምስት', 'ስድስት', 'ሰባት', 'ስምንት', 'ዘጠኝ', 'አስር',
  'አስራ አንድ', 'አስራ ሁለት', 'አስራ ሶስት', 'አስራ አራት', 'አስራ አምስት', 'አስራ ስድስት', 'አስራ ሰባት', 'አስራ ስምንት', 'አስራ ዘጠኝ', 'ሃያ',
  'ሃያ አንድ', 'ሃያ ሁለት', 'ሃያ ሶስት', 'ሃያ አራት', 'ሃያ አምስት', 'ሃያ ስድስት', 'ሃያ ሰባት', 'ሃያ ስምንት', 'ሃያ ዘጠኝ', 'ሰላሳ',
  'ሰላሳ አንድ', 'ሰላሳ ሁለት', 'ሰላሳ ሶስት', 'ሰላሳ አራት', 'ሰላሳ አምስት', 'ሰላሳ ስድስት', 'ሰላሳ ሰባት', 'ሰላሳ ስምንት', 'ሰላሳ ዘጠኝ', 'አርባ',
  'አርባ አንድ', 'አርባ ሁለት', 'አርባ ሶስት', 'አርባ አራት', 'አርባ አምስት', 'አርባ ስድስት', 'አርባ ሰባት', 'አርባ ስምንት', 'አርባ ዘጠኝ', 'ሃምሳ',
  'ሃምሳ አንድ', 'ሃምሳ ሁለት', 'ሃምሳ ሶስት', 'ሃምሳ አራት', 'ሃምሳ አምስት', 'ሃምሳ ስድስት', 'ሃምሳ ሰባት', 'ሃምሳ ስምንት', 'ሃምሳ ዘጠኝ', 'ስድሳ',
  'ስድሳ አንድ', 'ስድሳ ሁለት', 'ስድሳ ሶስት', 'ስድሳ አራት', 'ስድሳ አምስት', 'ስድሳ ስድስት', 'ስድሳ ሰባት', 'ስድሳ ስምንት', 'ስድሳ ዘጠኝ', 'ሰባ',
  'ሰባ አንድ', 'ሰባ ሁለት', 'ሰባ ሶስት', 'ሰባ አራት', 'ሰባ አምስት'
];

export function getAmharicCallPhrase(num: number): string {
  const letter = num <= 15 ? 'ቢ' : num <= 30 ? 'አይ' : num <= 45 ? 'ኤን' : num <= 60 ? 'ጂ' : 'ኦ';
  const amWord = amharicNumbers[num] || String(num);
  return `${letter}! ${amWord}!`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const numStr = searchParams.get('num');
  const num = parseInt(numStr || '0', 10);

  if (isNaN(num) || num < 1 || num > 75) {
    return new NextResponse('Invalid ball number (1..75)', { status: 400 });
  }

  // 1. Check if pre-cached file exists on local filesystem
  try {
    const filePath = path.join(process.cwd(), 'public', 'sounds', 'calls', `${num}.mp3`);
    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath);
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }
  } catch {}

  // 2. Fetch native Amharic female voice from Google TTS
  const phrase = getAmharicCallPhrase(num);
  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=am&client=tw-ob&q=${encodeURIComponent(phrase)}`;

  try {
    const res = await fetch(ttsUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://translate.google.com/',
      },
    });

    if (!res.ok) {
      return new NextResponse('TTS provider error', { status: 502 });
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Best-effort cache to public/sounds/calls/
    try {
      const dir = path.join(process.cwd(), 'public', 'sounds', 'calls');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(path.join(dir, `${num}.mp3`), buffer);
    } catch {}

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err: unknown) {
    console.error('Failed to generate TTS:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}
