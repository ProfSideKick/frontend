import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const pathParts = request.nextUrl.pathname.split('/');
    const sessionId = pathParts[pathParts.indexOf('sessions') + 1];
    const sessionRunId = pathParts[pathParts.indexOf('runs') + 1];

    const response = await fetch(config.getApiUrl(`/api/sessions/${sessionId}/runs/${sessionRunId}/end`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(errorData, { status: response.status });
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error ending session run:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
