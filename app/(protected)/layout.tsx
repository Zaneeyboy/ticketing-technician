import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { StoreProvider } from '@/lib/providers/store-context';

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Platform-level roles go to HQ dashboard
  if (user.role === 'super_admin' || user.role === 'manager') {
    redirect('/hq/dashboard');
  }

  return <StoreProvider>{children}</StoreProvider>;
}
