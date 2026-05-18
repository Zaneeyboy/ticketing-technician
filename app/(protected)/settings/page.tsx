'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/providers/store-context';
import { updateStoreSettings } from '@/lib/actions/stores';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth/auth-provider';
import { useRouter } from 'next/navigation';

const TIMEZONES = [
  { value: 'America/Port_of_Spain', label: 'Trinidad & Tobago (AST)' },
  { value: 'America/Barbados', label: 'Barbados (AST)' },
  { value: 'America/Jamaica', label: 'Jamaica (EST)' },
  { value: 'America/Guyana', label: 'Guyana (GYT)' },
  { value: 'America/St_Kitts', label: 'St Kitts (AST)' },
  { value: 'America/St_Lucia', label: 'St Lucia (AST)' },
  { value: 'America/Grenada', label: 'Grenada (AST)' },
];

const CURRENCIES = [
  { value: 'TTD', label: 'TTD — Trinidad & Tobago Dollar' },
  { value: 'BBD', label: 'BBD — Barbados Dollar' },
  { value: 'JMD', label: 'JMD — Jamaican Dollar' },
  { value: 'GYD', label: 'GYD — Guyanese Dollar' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'XCD', label: 'XCD — East Caribbean Dollar' },
];

export default function StoreSettingsPage() {
  const { user } = useAuth();
  const { store } = useStore();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    contactEmail: '',
    contactPhone: '',
    address: '',
    timezone: 'America/Port_of_Spain',
    currency: 'TTD',
  });

  // Redirect non-store_admin away
  useEffect(() => {
    if (user && user.role !== 'store_admin') {
      router.push('/dashboard');
    }
  }, [user, router]);

  // Populate form with current store data
  useEffect(() => {
    if (store) {
      setForm({
        contactEmail: store.contactEmail || '',
        contactPhone: store.contactPhone || '',
        address: store.address || '',
        timezone: store.settings?.timezone || 'America/Port_of_Spain',
        currency: store.settings?.currency || 'TTD',
      });
    }
  }, [store]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await updateStoreSettings({
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        address: form.address,
        settings: {
          timezone: form.timezone,
          currency: form.currency,
          locale: store?.settings?.locale || 'en-TT',
        },
      });

      if (result.success) {
        showToast.success('Settings Saved', 'Store settings have been updated.');
      } else {
        showToast.error('Error', result.error || 'Failed to save settings.');
      }
    } catch (err: any) {
      showToast.error('Error', err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (!user || user.role !== 'store_admin') return null;

  // Show skeleton while store data is loading from Firestore
  if (!store) {
    return (
      <DashboardLayout>
        <div className='max-w-2xl space-y-6'>
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader className='space-y-1'>
                <Skeleton className='h-6 w-40' />
                <Skeleton className='h-4 w-72' />
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid grid-cols-2 gap-4'>
                  <div className='space-y-1'>
                    <Skeleton className='h-4 w-20' />
                    <Skeleton className='h-10 w-full rounded-md' />
                  </div>
                  <div className='space-y-1'>
                    <Skeleton className='h-4 w-14' />
                    <Skeleton className='h-10 w-full rounded-md' />
                  </div>
                </div>
                <Skeleton className='h-px w-full' />
                {[1, 2, 3].map((j) => (
                  <div key={j} className='space-y-2'>
                    <Skeleton className='h-4 w-28' />
                    <Skeleton className='h-10 w-full rounded-md' />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
          <Skeleton className='h-10 w-28 rounded-md' />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <form onSubmit={handleSubmit} className='max-w-2xl space-y-6'>
        {/* Store info (read-only) */}
        <Card>
          <CardHeader>
            <CardTitle>Store Information</CardTitle>
            <CardDescription>Basic details about this store. Name and type can only be changed by HQ.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-1'>
                <Label>Store Name</Label>
                <Input value={store?.name || '—'} disabled className='bg-muted' />
              </div>
              <div className='space-y-1'>
                <Label>Status</Label>
                <Input value={store?.status || '—'} disabled className='bg-muted capitalize' />
              </div>
            </div>

            <Separator />

            <div className='space-y-2'>
              <Label htmlFor='contactEmail'>Contact Email</Label>
              <Input id='contactEmail' type='email' value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} placeholder='store@company.com' disabled={saving} />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='contactPhone'>Contact Phone</Label>
              <Input id='contactPhone' type='tel' value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder='+1 868 000 0000' disabled={saving} />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='address'>Address</Label>
              <Input id='address' value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder='123 Main St, Port of Spain' disabled={saving} />
            </div>
          </CardContent>
        </Card>

        {/* Regional settings */}
        <Card>
          <CardHeader>
            <CardTitle>Regional Settings</CardTitle>
            <CardDescription>Timezone and currency for this store location.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-2'>
              <Label>Timezone</Label>
              <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })} disabled={saving}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })} disabled={saving}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Enabled modules (read-only view) */}
        {store?.modules && (
          <Card>
            <CardHeader>
              <CardTitle>Active Modules</CardTitle>
              <CardDescription>Modules are enabled or disabled by HQ.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
                {Object.entries(store.modules).map(([mod, enabled]) => (
                  <div
                    key={mod}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm border ${enabled ? 'border-primary/30 bg-primary/5 text-primary' : 'border-border text-muted-foreground bg-muted/30'}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                    <span className='capitalize'>{mod}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className='flex justify-end'>
          <Button type='submit' disabled={saving} className='rounded-full px-8'>
            {saving ? 'Saving…' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </DashboardLayout>
  );
}
