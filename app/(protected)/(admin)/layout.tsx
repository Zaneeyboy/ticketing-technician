import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Require user to exist and have admin role
  const user = await requireRole(['admin', 'call_admin', 'management']);

  if (!user) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
