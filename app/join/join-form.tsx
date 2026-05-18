'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { acceptInvitationAction } from '@/lib/actions/invitations';
import { createSessionAction } from '@/lib/auth/actions';
import { auth } from '@/lib/firebase/client';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showToast } from '@/lib/toast';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

interface JoinFormProps {
  token: string;
  defaultName: string;
  email: string;
}

export function JoinForm({ token, defaultName, email }: JoinFormProps) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (password.length < 8) {
      setError('Password needs to be at least 8 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setError("Those passwords don't match — give it another try");
      return;
    }

    setLoading(true);

    try {
      // Create the account via server action
      const result = await acceptInvitationAction({ token, name: name.trim(), password });

      if (!result.success) {
        setError(result.error || 'Something went wrong creating your account');
        setLoading(false);
        return;
      }

      // Auto sign-in with the new credentials
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      await createSessionAction(idToken);

      showToast.success("You're in!", 'Account created — taking you to your dashboard');
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      console.error('Join error:', err);
      const code = err?.code as string | undefined;
      if (code === 'auth/too-many-requests') {
        setError('Too many attempts — wait a moment and try again');
      } else if (code === 'auth/network-request-failed') {
        setError('Network error — check your connection and try again');
      } else {
        setError('Something went wrong — please try again');
      }
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      {/* Email (read-only) */}
      <div className='space-y-2'>
        <Label htmlFor='join-email'>Email address</Label>
        <Input id='join-email' type='email' value={email} disabled className='bg-muted text-muted-foreground' />
        <p className='text-xs text-muted-foreground'>Your email is pre-assigned and cannot be changed</p>
      </div>

      {/* Name */}
      <div className='space-y-2'>
        <Label htmlFor='join-name'>Full name</Label>
        <Input id='join-name' type='text' value={name} onChange={(e) => setName(e.target.value)} placeholder='Your full name' disabled={loading} autoComplete='name' />
      </div>

      {/* Password */}
      <div className='space-y-2'>
        <Label htmlFor='join-password'>Create password</Label>
        <div className='relative'>
          <Input
            id='join-password'
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder='At least 8 characters'
            disabled={loading}
            autoComplete='new-password'
            className='pr-10'
          />
          <button type='button' onClick={() => setShowPassword((v) => !v)} className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground' tabIndex={-1}>
            {showPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
          </button>
        </div>
      </div>

      {/* Confirm password */}
      <div className='space-y-2'>
        <Label htmlFor='join-confirm'>Confirm password</Label>
        <Input
          id='join-confirm'
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder='Re-enter your password'
          disabled={loading}
          autoComplete='new-password'
        />
      </div>

      {error && <p className='text-sm text-destructive'>{error}</p>}

      <Button type='submit' className='w-full' disabled={loading}>
        {loading ? (
          <>
            <Loader2 className='h-4 w-4 animate-spin mr-2' />
            Creating account...
          </>
        ) : (
          'Create account & sign in'
        )}
      </Button>
    </form>
  );
}
