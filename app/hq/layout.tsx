import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import HQLayout from '@/components/hq-layout';

export default async function HQRootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'super_admin' && user.role !== 'manager') {
    redirect('/dashboard');
  }

  return <HQLayout user={{ uid: user.uid, email: user.email, name: user.name, role: user.role }}>{children}</HQLayout>;
}
