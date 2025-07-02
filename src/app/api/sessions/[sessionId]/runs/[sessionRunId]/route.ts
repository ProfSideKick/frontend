import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

export async function GET(request: NextRequest) {
  try {
    const pathParts = request.nextUrl.pathname.split('/');
    const sessionId = pathParts[pathParts.indexOf('sessions') + 1];
    const sessionRunId = pathParts[pathParts.indexOf('runs') + 1];

    const response = await fetch(config.getApiUrl(`/api/sessions/${sessionId}/runs/${sessionRunId}`), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Session run not found' },
        { status: 404 }
      );
    }

    const sessionRunData = await response.json();
    return NextResponse.json(sessionRunData);
  } catch (error) {
    console.error('Error fetching session run:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
