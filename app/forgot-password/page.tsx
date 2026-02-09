'use client';

import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { showToast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LandingNavbar } from '@/components/landing-navbar';
import Link from 'next/link';
import { ArrowLeft, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setSubmitted(true);
      showToast.success('Email Sent', `Password reset link sent to ${email}`);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to send reset email';
      setError(errorMessage);
      showToast.error('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='flex flex-col min-h-screen'>
      <LandingNavbar />

      {/* Main Content */}
      <div className='flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 py-12'>
        <div className='w-full max-w-md'>
          <div className='mb-6'>
            <Link href='/login' className='inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors'>
              <ArrowLeft className='h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1' />
              Back to Login
            </Link>
          </div>

          <Card className='shadow-lg animate-fade-in hover:shadow-primary/20 transition-shadow duration-300'>
            <CardHeader className='space-y-1 pb-4'>
              <CardTitle className='text-2xl font-bold animate-fade-in stagger-1'>Reset Password</CardTitle>
              <CardDescription className='animate-fade-in stagger-2'>Enter your email to receive a password reset link</CardDescription>
            </CardHeader>
            <CardContent>
              {!submitted ? (
                <form onSubmit={handleSubmit} className='space-y-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='email'>Email Address</Label>
                    <Input
                      id='email'
                      type='email'
                      placeholder='your.email@example.com'
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      className='transition-colors'
                    />
                  </div>

                  {error && (
                    <div className='text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 p-3 rounded border border-rose-200 dark:border-rose-800 animate-shake'>{error}</div>
                  )}

                  <Button
                    type='submit'
                    className='w-full bg-primary hover:bg-primary/90 text-white font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-primary/40 active:scale-95'
                    disabled={loading}
                  >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </Button>

                  <div className='text-center text-sm text-muted-foreground pt-2'>
                    Remember your password?{' '}
                    <Link href='/login' className='text-primary hover:underline font-medium transition-all duration-300 hover:text-primary/80'>
                      Sign in
                    </Link>
                  </div>
                </form>
              ) : (
                <div className='space-y-4 animate-fade-in'>
                  <div className='flex justify-center animate-scale-in'>
                    <CheckCircle className='h-12 w-12 text-green-500 animate-pulse-glow' />
                  </div>
                  <div className='text-center space-y-2 animate-slide-in-up'>
                    <h3 className='font-semibold text-foreground'>Check Your Email</h3>
                    <p className='text-sm text-muted-foreground'>
                      We've sent a password reset link to <span className='font-medium text-foreground'>{email}</span>. Click the link in the email to reset your password.
                    </p>
                  </div>
                  <div className='bg-slate-50 dark:bg-slate-900 p-4 rounded border border-border text-xs text-muted-foreground space-y-2 animate-slide-in-up'>
                    <p>
                      <strong>Didn't receive the email?</strong>
                    </p>
                    <ul className='list-disc list-inside space-y-1'>
                      <li>Check your spam folder</li>
                      <li>Make sure you entered the correct email address</li>
                      <li>Try requesting a new reset link</li>
                    </ul>
                  </div>
                  <Button
                    type='button'
                    onClick={() => {
                      setSubmitted(false);
                      setEmail('');
                    }}
                    variant='outline'
                    className='w-full transition-all duration-300 hover:border-primary hover:bg-primary/5 active:scale-95 animate-slide-in-up'
                  >
                    Try Another Email
                  </Button>
                  <Link href='/login' className='block'>
                    <Button
                      type='button'
                      className='w-full bg-primary hover:bg-primary/90 text-white font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-primary/40 active:scale-95 animate-slide-in-up'
                    >
                      Back to Login
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className='border-t border-border bg-card transition-colors duration-300'>
        <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12'>
          <div className='grid gap-8 sm:grid-cols-2 md:grid-cols-4 mb-8'>
            <div className='animate-fade-in' style={{ animationDelay: '100ms' }}>
              <h3 className='text-sm font-semibold text-foreground transition-colors duration-300'>Product</h3>
              <ul className='mt-4 space-y-2'>
                <li>
                  <Link href='/#features' className='text-sm text-muted-foreground hover:text-primary transition-all duration-300 inline-block hover:translate-x-1'>
                    Features
                  </Link>
                </li>
                <li>
                  <Link href='/#how-it-works' className='text-sm text-muted-foreground hover:text-primary transition-all duration-300 inline-block hover:translate-x-1'>
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link href='/#preview' className='text-sm text-muted-foreground hover:text-primary transition-all duration-300 inline-block hover:translate-x-1'>
                    Pricing
                  </Link>
                </li>
              </ul>
            </div>

            <div className='animate-fade-in' style={{ animationDelay: '200ms' }}>
              <h3 className='text-sm font-semibold text-foreground transition-colors duration-300'>Company</h3>
              <ul className='mt-4 space-y-2'>
                <li>
                  <Link href='/' className='text-sm text-muted-foreground hover:text-primary transition-all duration-300 inline-block hover:translate-x-1'>
                    About
                  </Link>
                </li>
                <li>
                  <Link href='/' className='text-sm text-muted-foreground hover:text-primary transition-all duration-300 inline-block hover:translate-x-1'>
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href='/' className='text-sm text-muted-foreground hover:text-primary transition-all duration-300 inline-block hover:translate-x-1'>
                    Careers
                  </Link>
                </li>
              </ul>
            </div>

            <div className='animate-fade-in' style={{ animationDelay: '300ms' }}>
              <h3 className='text-sm font-semibold text-foreground transition-colors duration-300'>Resources</h3>
              <ul className='mt-4 space-y-2'>
                <li>
                  <Link href='/' className='text-sm text-muted-foreground hover:text-primary transition-all duration-300 inline-block hover:translate-x-1'>
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href='/' className='text-sm text-muted-foreground hover:text-primary transition-all duration-300 inline-block hover:translate-x-1'>
                    Support
                  </Link>
                </li>
                <li>
                  <Link href='/' className='text-sm text-muted-foreground hover:text-primary transition-all duration-300 inline-block hover:translate-x-1'>
                    Status
                  </Link>
                </li>
              </ul>
            </div>

            <div className='animate-fade-in' style={{ animationDelay: '400ms' }}>
              <h3 className='text-sm font-semibold text-foreground transition-colors duration-300'>Legal</h3>
              <ul className='mt-4 space-y-2'>
                <li>
                  <Link href='/' className='text-sm text-muted-foreground hover:text-primary transition-all duration-300 inline-block hover:translate-x-1'>
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href='/' className='text-sm text-muted-foreground hover:text-primary transition-all duration-300 inline-block hover:translate-x-1'>
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href='/' className='text-sm text-muted-foreground hover:text-primary transition-all duration-300 inline-block hover:translate-x-1'>
                    Security
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className='border-t border-border pt-8 text-center text-sm text-muted-foreground animate-fade-in' style={{ animationDelay: '500ms' }}>
            <p>&copy; 2026 Tech Dynamics. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
