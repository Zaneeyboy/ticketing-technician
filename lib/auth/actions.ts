'use server';

import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { createSession, destroySession } from './session';
import { redirect } from 'next/navigation';
import { Timestamp } from 'firebase-admin/firestore';

export async function loginAction(email: string, password: string) {
  try {
    // This needs to be done client-side, so we'll handle it differently
    // This is a placeholder for the server action pattern
    return { success: false, error: 'Use client-side login' };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to login',
    };
  }
}

export async function logoutAction() {
  await destroySession();
  redirect('/login');
}

export async function createSessionAction(idToken: string) {
  try {
    // Create session cookie (don't create user document)
    const result = await createSession(idToken);
    if (result.success) {
      return { success: true };
    }
    return { success: false, error: result.error };
  } catch (error: any) {
    console.error('Error creating session:', error);
    return { success: false, error: error.message || 'Failed to create session' };
  }
}

export async function signupAction(data: { email: string; password: string; name: string; role: 'admin' | 'call_admin' | 'technician' | 'management' }) {
  try {
    // Create Firebase Auth user
    const userRecord = await adminAuth.createUser({
      email: data.email,
      password: data.password,
      displayName: data.name,
    });

    // Create Firestore user document
    await adminDb.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: data.email,
      name: data.name,
      role: data.role,
      disabled: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    return { success: true, userId: userRecord.uid };
  } catch (error: any) {
    console.error('Error during signup:', error);
    return {
      success: false,
      error: error.message || 'Failed to create account',
    };
  }
}
