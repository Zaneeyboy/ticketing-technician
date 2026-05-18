import { LandingNavbar } from '@/components/landing-navbar';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SignupForm } from './signup-form';

export default function SignupPage() {
  return (
    <div className='flex flex-col min-h-screen'>
      <LandingNavbar />
      <div className='flex-1 flex items-center justify-center bg-muted p-4 py-12'>
        <div className='w-full max-w-md'>
          <div className='mb-6'>
            <Link href='/' className='inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4'>
              <ArrowLeft className='h-4 w-4' />
              Back to Home
            </Link>
          </div>
          <SignupForm />
        </div>
      </div>
    </div>
  );
}
