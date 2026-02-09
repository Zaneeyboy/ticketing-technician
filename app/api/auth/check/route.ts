import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        uid: session.uid,
        email: session.email,
        role: session.role,
      },
    });
  } catch (error) {
    return NextResponse.json({ authenticated: false, error: 'Invalid session' }, { status: 401 });
  }
}
