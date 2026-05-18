import { getInvitationByToken } from '@/lib/actions/invitations';
import { JoinForm } from './join-form';
import { LandingNavbar } from '@/components/landing-navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const ROLE_LABELS: Record<string, string> = {
  store_admin: 'Store Administrator',
  call_admin: 'Call Administrator',
  technician: 'Technician',
  manager: 'Manager',
};

interface JoinPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function JoinPage({ searchParams }: JoinPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return <InvalidState reason='missing' />;
  }

  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    return <InvalidState reason='not-found' />;
  }

  if (invitation.status === 'accepted') {
    return <InvalidState reason='accepted' />;
  }

  if (invitation.status === 'expired') {
    return <InvalidState reason='expired' />;
  }

  if (invitation.status === 'cancelled') {
    return <InvalidState reason='cancelled' />;
  }

  // Valid pending invitation
  const expiresIn = Math.ceil((invitation.expiresAt - Date.now()) / (1000 * 60 * 60));

  return (
    <div className='min-h-screen bg-background'>
      <LandingNavbar />
      <div className='flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-12'>
        <div className='w-full max-w-md'>
          <div className='text-center mb-8'>
            <h1 className='text-3xl font-bold text-foreground'>Join Caribbean Roasters</h1>
            <p className='text-muted-foreground mt-2'>Complete your account setup to get started</p>
          </div>

          <Card>
            <CardHeader className='pb-4'>
              <div className='flex items-center gap-3'>
                <div className='w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0'>
                  <CheckCircle2 className='h-5 w-5 text-primary' />
                </div>
                <div>
                  <CardTitle className='text-base'>You&apos;ve been invited</CardTitle>
                  <CardDescription>
                    Role: <span className='font-medium text-foreground'>{ROLE_LABELS[invitation.role] ?? invitation.role}</span>
                    {invitation.storeName && (
                      <>
                        {' '}
                        &middot; <span className='font-medium text-foreground'>{invitation.storeName}</span>
                      </>
                    )}
                  </CardDescription>
                </div>
              </div>
              <div className='flex items-center gap-1.5 mt-2 text-xs text-muted-foreground'>
                <Clock className='h-3.5 w-3.5' />
                <span>
                  Expires in {expiresIn} hour{expiresIn !== 1 ? 's' : ''}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <JoinForm token={token} defaultName={invitation.name} email={invitation.email} />
            </CardContent>
          </Card>

          <p className='text-center text-sm text-muted-foreground mt-6'>
            Already have an account?{' '}
            <Link href='/login' className='text-primary hover:underline font-medium'>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function InvalidState({ reason }: { reason: 'missing' | 'not-found' | 'accepted' | 'expired' | 'cancelled' }) {
  const messages: Record<typeof reason, { title: string; description: string }> = {
    missing: { title: 'Invalid invitation link', description: 'This link is missing a required token. Please check your invitation email.' },
    'not-found': { title: 'Invitation not found', description: 'This invitation link is invalid or has already been used. Contact your administrator for a new one.' },
    accepted: { title: 'Already accepted', description: 'This invitation has already been used to create an account. Try signing in.' },
    expired: { title: 'Invitation expired', description: 'This invitation link has expired (72-hour limit). Ask your administrator to resend the invitation.' },
    cancelled: { title: 'Invitation cancelled', description: 'This invitation was cancelled. Contact your administrator to receive a new one.' },
  };

  const { title, description } = messages[reason];

  return (
    <div className='min-h-screen bg-background'>
      <LandingNavbar />
      <div className='flex items-center justify-center min-h-[calc(100vh-4rem)] px-4'>
        <Card className='w-full max-w-md'>
          <CardHeader>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0'>
                <AlertTriangle className='h-5 w-5 text-destructive' />
              </div>
              <div>
                <CardTitle>{title}</CardTitle>
                <CardDescription className='mt-1'>{description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Link href='/login' className='block w-full text-center text-sm text-primary hover:underline font-medium'>
              Go to sign in →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
