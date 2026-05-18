import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return NextResponse.json({ authenticated: false, error: 'Invalid session' }, { status: 401 });
  }
}
