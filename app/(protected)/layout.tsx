import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  // User must exist in Firestore to access protected routes
  if (!user) {
    redirect('/login');
  }

  return <>{children}</>;
}
