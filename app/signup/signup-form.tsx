'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSessionAction, signupAction } from '@/lib/auth/actions';
import { showToast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { auth } from '@/lib/firebase/client';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

export function SignupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.email || !formData.password || !formData.name) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Those passwords don't match — give it another try");
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password needs to be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const result = await signupAction({
        email: formData.email,
        password: formData.password,
        name: formData.name,
      });

      if (result.success) {
        const credential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        const idToken = await credential.user.getIdToken();
        const sessionResult = await createSessionAction(idToken);

        if (!sessionResult.success) {
          setError(sessionResult.error || 'Failed to create session');
          return;
        }

        showToast.success("You're in!", 'Super Admin account created — welcome aboard!');
        setTimeout(() => router.push('/hq/dashboard'), 800);
      } else {
        setError(result.error || 'Failed to create account');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong — please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className='shadow-sm border-border'>
      <CardHeader className='space-y-1 pb-4'>
        <CardTitle className='text-2xl font-bold'>Create an Account</CardTitle>
        <CardDescription>Sign up as a Super Admin to set up your own stores and team.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignup} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='email'>Email Address</Label>
            <Input id='email' name='email' type='email' placeholder='your.email@example.com' value={formData.email} onChange={handleChange} required disabled={loading} />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='name'>Full Name</Label>
            <Input id='name' name='name' type='text' placeholder='John Doe' value={formData.name} onChange={handleChange} required disabled={loading} />
          </div>

          <div className='rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground'>
            Role: <span className='font-medium text-foreground'>Super Admin</span>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='password'>Password</Label>
            <Input id='password' name='password' type='password' placeholder='••••••••' value={formData.password} onChange={handleChange} required disabled={loading} />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='confirmPassword'>Confirm Password</Label>
            <Input id='confirmPassword' name='confirmPassword' type='password' placeholder='••••••••' value={formData.confirmPassword} onChange={handleChange} required disabled={loading} />
          </div>

          {error && <div className='text-sm text-destructive bg-destructive/5 p-3 rounded-md border border-destructive/20'>{error}</div>}

          <Button type='submit' className='w-full' disabled={loading}>
            {loading ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </Button>

          <div className='relative'>
            <div className='absolute inset-0 flex items-center'>
              <div className='w-full border-t border-border' />
            </div>
            <div className='relative flex justify-center text-sm'>
              <span className='px-2 bg-card text-muted-foreground'>Already have an account?</span>
            </div>
          </div>

          <Button type='button' variant='outline' className='w-full' asChild>
            <Link href='/login'>Sign In</Link>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
