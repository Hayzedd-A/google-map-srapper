import { NextResponse } from 'next/server';
import { generateXlsxFromMongo } from '@/app/services/spreadsheet';

export async function GET() {
  try {
    const buffer = await generateXlsxFromMongo();
    
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="results.xlsx"',
      },
    });
  } catch (error) {
    console.error('Failed to generate spreadsheet:', error);
    return NextResponse.json(
      { error: 'Failed to generate spreadsheet' },
      { status: 500 }
    );
  }
}

