'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { createSessionAction } from '@/lib/auth/actions';
import { showToast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LandingNavbar } from '@/components/landing-navbar';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // Get ID token
      const idToken = await userCredential.user.getIdToken();

      // Create session cookie
      const result = await createSessionAction(idToken);

      if (result.success) {
        showToast.success('Login Successful', `Welcome back, ${userCredential.user.email}!`);
        // Delay redirect to allow user to see the success toast
        setTimeout(() => {
          router.push('/dashboard');
          router.refresh();
        }, 800);
      } else {
        setError(result.error || 'Failed to create session');
        showToast.error('Login Failed', result.error || 'Failed to create session');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to login';
      setError(errorMessage);
      showToast.error('Login Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='flex flex-col min-h-screen'>
      <LandingNavbar />

      {/* Header spacer to avoid content overlap with sticky navbar */}
      <div className='flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 py-12'>
        <div className='w-full max-w-md animate-fade-in'>
          <div className='mb-6 animate-slide-in-left'>
            <Link href='/' className='inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-300 hover:translate-x-1 mb-4'>
              <ArrowLeft className='h-4 w-4 transition-transform duration-300' />
              Back to Home
            </Link>
          </div>

          <Card className='shadow-lg animate-fade-in hover:shadow-primary/20 transition-shadow duration-300'>
            <CardHeader className='space-y-1 pb-4'>
              <CardTitle className='text-2xl font-bold animate-fade-in stagger-1'>Welcome Back</CardTitle>
              <CardDescription>Sign in to access the Tech Dynamics ticketing system</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className='space-y-4'>
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
                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <Label htmlFor='password'>Password</Label>
                    <Link href='/forgot-password' className='text-xs text-primary hover:underline font-medium'>
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id='password'
                    type='password'
                    placeholder='••••••••'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className='transition-all duration-300 focus:shadow-lg focus:shadow-primary/20'
                  />
                </div>
                {error && <div className='text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 p-3 rounded border border-rose-200 dark:border-rose-800 animate-shake'>{error}</div>}
                <Button
                  type='submit'
                  className='w-full bg-primary hover:bg-primary/90 text-white font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-primary/40 active:scale-95'
                  disabled={loading}
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>

                <div className='relative'>
                  <div className='absolute inset-0 flex items-center'>
                    <div className='w-full border-t border-border' />
                  </div>
                  <div className='relative flex justify-center text-sm'>
                    <span className='px-2 bg-card text-muted-foreground'>Don't have an account?</span>
                  </div>
                </div>

                <Button type='button' variant='outline' className='w-full transition-all duration-300 hover:border-primary hover:bg-primary/5 active:scale-95' asChild>
                  <Link href='/signup'>Create Account</Link>
                </Button>

                <div className='text-center text-xs text-muted-foreground pt-2'>
                  <Link href='/' className='hover:text-foreground transition-colors'>
                    Back to Home
                  </Link>
                </div>
              </form>
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
                  <Link href='/' className='text-sm text-muted-foreground hover:text-foreground transition-colors'>
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
