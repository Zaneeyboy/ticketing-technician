import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import UsersClient from './users-client';

// This page requires authentication, so it must be dynamic
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const user = await requireRole(['admin', 'call_admin']);

  if (!user) {
    redirect('/dashboard');
  }

  return <UsersClient />;
}
