'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { onboardStore } from '@/lib/actions/stores';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, Building2, Settings, Users, Eye, Copy, ExternalLink, Share2, Clock, Mail, UserPlus, ChevronRight } from 'lucide-react';
import { showToast } from '@/lib/toast';

// ─── Island presets ───────────────────────────────────────────────────────────
const ISLAND_PRESETS: Record<string, { timezone: string; currency: string; locale: string }> = {
  Trinidad: { timezone: 'America/Port_of_Spain', currency: 'TTD', locale: 'en-TT' },
  Barbados: { timezone: 'America/Barbados', currency: 'BBD', locale: 'en-BB' },
  Jamaica: { timezone: 'America/Jamaica', currency: 'JMD', locale: 'en-JM' },
  Guyana: { timezone: 'America/Guyana', currency: 'GYD', locale: 'en-GY' },
  'St. Lucia': { timezone: 'America/St_Lucia', currency: 'XCD', locale: 'en-LC' },
  Grenada: { timezone: 'America/Grenada', currency: 'XCD', locale: 'en-GD' },
  Other: { timezone: 'America/Port_of_Spain', currency: 'TTD', locale: 'en-TT' },
};

const TIMEZONES = ['America/Port_of_Spain', 'America/Barbados', 'America/Jamaica', 'America/Guyana', 'America/St_Lucia', 'America/Grenada', 'UTC'];

const CURRENCIES = [
  { value: 'TTD', label: 'TTD — Trinidad & Tobago Dollar' },
  { value: 'BBD', label: 'BBD — Barbados Dollar' },
  { value: 'JMD', label: 'JMD — Jamaican Dollar' },
  { value: 'GYD', label: 'GYD — Guyanese Dollar' },
  { value: 'XCD', label: 'XCD — East Caribbean Dollar' },
  { value: 'USD', label: 'USD — US Dollar' },
];

const LOCALES = [
  { value: 'en-TT', label: 'en-TT (Trinidad & Tobago)' },
  { value: 'en-BB', label: 'en-BB (Barbados)' },
  { value: 'en-JM', label: 'en-JM (Jamaica)' },
  { value: 'en-GY', label: 'en-GY (Guyana)' },
  { value: 'en-LC', label: 'en-LC (St. Lucia)' },
  { value: 'en-GD', label: 'en-GD (Grenada)' },
];

const STEPS = [
  { label: 'Store Details', icon: Building2 },
  { label: 'Modules', icon: Settings },
  { label: 'Settings', icon: Settings },
  { label: 'Store Admin', icon: Users },
  { label: 'Review', icon: Eye },
];

type ModuleKey = 'customers' | 'machines' | 'parts' | 'reports';
const OPTIONAL_MODULES: { key: ModuleKey; label: string; description: string }[] = [
  { key: 'customers', label: 'Customers', description: 'Manage customer accounts and contacts' },
  { key: 'machines', label: 'Machines', description: 'Track equipment and serial numbers' },
  { key: 'parts', label: 'Parts', description: 'Inventory management for spare parts' },
  { key: 'reports', label: 'Reports', description: 'Analytics and performance reporting' },
];

// ─── Component ─────────────────────────────────────────────────────────────────
export default function NewStorePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [joinUrl, setJoinUrl] = useState('');
  const [newStoreId, setNewStoreId] = useState('');
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  // Form state
  const [details, setDetails] = useState({
    name: '',
    island: '',
    address: '',
    contactEmail: '',
    contactPhone: '',
  });
  const [modules, setModules] = useState<Record<ModuleKey, boolean>>({
    customers: true,
    machines: true,
    parts: true,
    reports: true,
  });
  const [settings, setSettings] = useState({
    timezone: 'America/Port_of_Spain',
    currency: 'TTD',
    locale: 'en-TT',
  });
  const [admin, setAdmin] = useState({ name: '', email: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ─── Validation ─────────────────────────────────────────────────────────────
  const validateStep = (): boolean => {
    const errs: Record<string, string> = {};

    if (step === 0) {
      if (!details.name.trim()) errs.name = 'Store name is required';
      if (!details.island) errs.island = 'Island is required';
      if (!details.address.trim()) errs.address = 'Address is required';
      if (!details.contactEmail.trim()) errs.contactEmail = 'Contact email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.contactEmail)) errs.contactEmail = 'Enter a valid email';
      if (!details.contactPhone.trim()) errs.contactPhone = 'Contact phone is required';
    }

    if (step === 3) {
      if (!admin.name.trim()) errs.adminName = 'Admin name is required';
      if (!admin.email.trim()) errs.adminEmail = 'Admin email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.email)) errs.adminEmail = 'Enter a valid email';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (validateStep()) setStep((s) => s + 1);
  };

  const prev = () => setStep((s) => s - 1);

  // ─── Island preset auto-fill ─────────────────────────────────────────────────
  const handleIslandChange = (island: string) => {
    setDetails((d) => ({ ...d, island }));
    const preset = ISLAND_PRESETS[island];
    if (preset) setSettings(preset);
  };

  // ─── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateStep()) return;
    setLoading(true);

    const result = await onboardStore({
      store: {
        name: details.name,
        island: details.island,
        address: details.address,
        contactEmail: details.contactEmail,
        contactPhone: details.contactPhone,
        status: 'onboarding',
        modules: { tickets: true, ...modules },
        settings,
      },
      adminName: admin.name,
      adminEmail: admin.email,
    });

    if (result.success && result.storeId) {
      setNewStoreId(result.storeId);
      setJoinUrl(result.joinUrl ?? '');
      setStep(5); // Success screen
    } else {
      showToast.error(result.error || 'Failed to create store. Please try again.');
      setLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${details.name} on Caribbean Roasters`,
          text: `You've been invited as Store Administrator for ${details.name}. Click to set up your account:`,
          url: joinUrl,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2500);
      } catch {
        // User cancelled share — no-op
      }
    } else {
      copyLink();
    }
  };

  // ─── Success screen ──────────────────────────────────────────────────────────
  if (step === 5) {
    const activeModules = ['Tickets', ...OPTIONAL_MODULES.filter((m) => modules[m.key]).map((m) => m.label)];

    return (
      <div className='max-w-2xl mx-auto py-8 space-y-6'>
        {/* Header */}
        <div className='flex items-start gap-4'>
          <div className='w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-0.5'>
            <Check className='h-6 w-6 text-emerald-600 dark:text-emerald-400' />
          </div>
          <div>
            <h2 className='text-xl font-bold'>{details.name} is live!</h2>
            <p className='text-sm text-muted-foreground mt-0.5'>
              The store has been created and an invitation email was sent to <strong>{admin.email}</strong>.
            </p>
          </div>
        </div>

        {/* Store summary */}
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-sm flex items-center gap-2'>
              <Building2 className='h-4 w-4 text-muted-foreground' />
              Store Summary
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm'>
              <div className='text-muted-foreground'>Name</div>
              <div className='font-medium'>{details.name}</div>
              <div className='text-muted-foreground'>Island</div>
              <div>{details.island}</div>
              <div className='text-muted-foreground'>Address</div>
              <div className='truncate'>{details.address}</div>
              <div className='text-muted-foreground'>Currency</div>
              <div>{settings.currency}</div>
              <div className='text-muted-foreground'>Timezone</div>
              <div className='text-xs'>{settings.timezone}</div>
            </div>
            <Separator />
            <div>
              <p className='text-xs text-muted-foreground mb-2'>Active modules</p>
              <div className='flex flex-wrap gap-1.5'>
                {activeModules.map((m) => (
                  <Badge key={m} variant='secondary'>
                    {m}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin invite link */}
        <Card className='border-amber-200/70 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-950/10'>
          <CardHeader className='pb-3'>
            <CardTitle className='text-sm flex items-center gap-2'>
              <Mail className='h-4 w-4 text-amber-600 dark:text-amber-400' />
              Admin Invite Link
            </CardTitle>
            <CardDescription className='text-xs'>
              An email was sent to <strong className='text-foreground'>{admin.name}</strong> at {admin.email}. Share this link directly as a backup.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            {/* Link display */}
            <div className='bg-background border rounded-md px-3 py-2'>
              <p className='text-xs font-mono text-muted-foreground truncate'>{joinUrl}</p>
            </div>

            {/* Action buttons */}
            <div className='flex flex-wrap gap-2'>
              <Button size='sm' variant='outline' onClick={copyLink} className='gap-1.5'>
                {copied ? <Check className='h-3.5 w-3.5 text-emerald-600' /> : <Copy className='h-3.5 w-3.5' />}
                {copied ? 'Copied!' : 'Copy link'}
              </Button>
              <Button size='sm' variant='outline' asChild className='gap-1.5'>
                <a href={joinUrl} target='_blank' rel='noopener noreferrer'>
                  <ExternalLink className='h-3.5 w-3.5' />
                  Open in new tab
                </a>
              </Button>
              <Button size='sm' variant='outline' onClick={shareLink} className='gap-1.5'>
                {shared ? <Check className='h-3.5 w-3.5 text-emerald-600' /> : <Share2 className='h-3.5 w-3.5' />}
                {shared ? 'Shared!' : 'Share'}
              </Button>
            </div>

            {/* Expiry warning */}
            <div className='flex items-start gap-2 rounded-md border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5'>
              <Clock className='h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0' />
              <div className='text-xs text-amber-800 dark:text-amber-300 space-y-0.5'>
                <p className='font-semibold'>This link expires in 72 hours.</p>
                <p>
                  If {admin.name.split(' ')[0]} doesn&apos;t accept in time, go to <strong>HQ → Users</strong>, find the pending invitation, and hit <strong>Resend</strong> — a fresh link will be
                  emailed automatically.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Build your team */}
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-sm flex items-center gap-2'>
              <UserPlus className='h-4 w-4 text-muted-foreground' />
              Next: Build the Team
            </CardTitle>
            <CardDescription className='text-xs'>Once the store admin accepts their invite, they can manage the team — or you can get a head start now.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            <p className='text-xs text-muted-foreground'>
              Go to the Users page to invite the first Call Admins and Technicians for this store. These are the two most critical roles to get operational.
            </p>
            <div className='flex flex-wrap gap-2 pt-1'>
              <Button size='sm' asChild className='gap-1.5'>
                <Link href={`/hq/users?store=${newStoreId}&invite=call_admin`}>
                  Invite a Call Admin
                  <ChevronRight className='h-3.5 w-3.5' />
                </Link>
              </Button>
              <Button size='sm' variant='outline' asChild className='gap-1.5'>
                <Link href={`/hq/users?store=${newStoreId}&invite=technician`}>
                  Invite a Technician
                  <ChevronRight className='h-3.5 w-3.5' />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className='flex flex-col sm:flex-row gap-2'>
          <Button asChild className='flex-1'>
            <Link href={`/hq/stores/${newStoreId}`}>Go to Store</Link>
          </Button>
          <Button variant='outline' asChild className='flex-1'>
            <Link
              href='/hq/stores/new'
              onClick={() => {
                setStep(0);
                setDetails({ name: '', island: '', address: '', contactEmail: '', contactPhone: '' });
                setAdmin({ name: '', email: '' });
                setModules({} as Record<ModuleKey, boolean>);
                setSettings({ timezone: 'America/Trinidad', currency: 'TTD', locale: 'en-TT' });
                setJoinUrl('');
                setNewStoreId('');
              }}
            >
              Create Another Store
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // ─── Step indicator ──────────────────────────────────────────────────────────
  const StepIndicator = () => (
    <div className='flex items-center gap-1 mb-8'>
      {STEPS.map((s, i) => (
        <div key={i} className='flex items-center gap-1'>
          <div
            className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-colors ${
              i < step ? 'bg-primary text-primary-foreground' : i === step ? 'bg-primary text-primary-foreground ring-2 ring-primary/30' : 'bg-muted text-muted-foreground'
            }`}
          >
            {i < step ? <Check className='h-3.5 w-3.5' /> : i + 1}
          </div>
          {i < STEPS.length - 1 && <div className={`flex-1 h-px w-6 ${i < step ? 'bg-primary' : 'bg-border'}`} />}
        </div>
      ))}
      <span className='ml-2 text-sm font-medium text-muted-foreground'>{STEPS[step]?.label}</span>
    </div>
  );

  const fieldErr = (key: string) => (errors[key] ? <p className='text-xs text-destructive mt-1'>{errors[key]}</p> : null);

  return (
    <div className='max-w-2xl mx-auto space-y-6'>
      {/* Header */}
      <div>
        <Link href='/hq/stores' className='inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4'>
          <ArrowLeft className='h-4 w-4' />
          Back to Stores
        </Link>
        <h2 className='text-xl font-semibold'>Add New Store</h2>
        <p className='text-sm text-muted-foreground'>Set up a new Caribbean Roasters branch in a few steps.</p>
      </div>

      <StepIndicator />

      {/* ── Step 0: Store Details ─────────────────────────────────────────────── */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Store Details</CardTitle>
            <CardDescription>Basic information about this branch.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div>
                <Label htmlFor='name'>Store Name *</Label>
                <Input id='name' value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} placeholder='e.g. Port of Spain Branch' className='mt-1' />
                {fieldErr('name')}
              </div>
              <div>
                <Label htmlFor='island'>Island *</Label>
                <Select value={details.island} onValueChange={handleIslandChange}>
                  <SelectTrigger className='mt-1'>
                    <SelectValue placeholder='Select island' />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(ISLAND_PRESETS).map((island) => (
                      <SelectItem key={island} value={island}>
                        {island}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErr('island')}
              </div>
            </div>
            <div>
              <Label htmlFor='address'>Address *</Label>
              <Input id='address' value={details.address} onChange={(e) => setDetails({ ...details, address: e.target.value })} placeholder='Full street address' className='mt-1' />
              {fieldErr('address')}
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div>
                <Label htmlFor='contactEmail'>Contact Email *</Label>
                <Input
                  id='contactEmail'
                  type='email'
                  value={details.contactEmail}
                  onChange={(e) => setDetails({ ...details, contactEmail: e.target.value })}
                  placeholder='store@caribbeanroasters.com'
                  className='mt-1'
                />
                {fieldErr('contactEmail')}
              </div>
              <div>
                <Label htmlFor='contactPhone'>Contact Phone *</Label>
                <Input id='contactPhone' value={details.contactPhone} onChange={(e) => setDetails({ ...details, contactPhone: e.target.value })} placeholder='+1 868 000 0000' className='mt-1' />
                {fieldErr('contactPhone')}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 1: Modules ───────────────────────────────────────────────────── */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Modules</CardTitle>
            <CardDescription>Choose which modules this store will use. Tickets are always enabled.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            {/* Tickets — always on */}
            <div className='flex items-center justify-between p-3 rounded-lg border bg-muted/30'>
              <div>
                <p className='text-sm font-medium'>Tickets</p>
                <p className='text-xs text-muted-foreground'>Core service ticket management</p>
              </div>
              <Badge variant='default'>Always On</Badge>
            </div>

            {OPTIONAL_MODULES.map(({ key, label, description }) => (
              <div
                key={key}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${modules[key] ? 'border-primary/40 bg-primary/5' : 'hover:bg-muted/30'}`}
                onClick={() => setModules((m) => ({ ...m, [key]: !m[key] }))}
              >
                <div>
                  <p className='text-sm font-medium'>{label}</p>
                  <p className='text-xs text-muted-foreground'>{description}</p>
                </div>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${modules[key] ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                  {modules[key] && <Check className='h-3 w-3 text-primary-foreground' />}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Settings ──────────────────────────────────────────────────── */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Regional Settings</CardTitle>
            <CardDescription>Auto-filled based on island. Adjust if needed.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div>
              <Label>Timezone</Label>
              <Select value={settings.timezone} onValueChange={(v) => setSettings({ ...settings, timezone: v })}>
                <SelectTrigger className='mt-1'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={settings.currency} onValueChange={(v) => setSettings({ ...settings, currency: v })}>
                <SelectTrigger className='mt-1'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Locale</Label>
              <Select value={settings.locale} onValueChange={(v) => setSettings({ ...settings, locale: v })}>
                <SelectTrigger className='mt-1'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Store Admin ───────────────────────────────────────────────── */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Store Admin Account</CardTitle>
            <CardDescription>We'll send this person an invite link so they can set their own password. The link expires after 72 hours.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div>
              <Label htmlFor='adminName'>Full Name *</Label>
              <Input id='adminName' value={admin.name} onChange={(e) => setAdmin({ ...admin, name: e.target.value })} placeholder='Store admin full name' className='mt-1' />
              {fieldErr('adminName')}
            </div>
            <div>
              <Label htmlFor='adminEmail'>Email Address *</Label>
              <Input id='adminEmail' type='email' value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} placeholder='admin@caribbeanroasters.com' className='mt-1' />
              {fieldErr('adminEmail')}
            </div>
            <p className='text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2'>
              After creating the store, you'll receive a unique invite link to share with this person. They'll use it to complete their account setup.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Step 4: Review ────────────────────────────────────────────────────── */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Review & Confirm</CardTitle>
            <CardDescription>Double-check everything before creating the store.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-5'>
            <div className='space-y-3'>
              <div>
                <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5'>Store Details</p>
                <div className='grid grid-cols-2 gap-x-4 gap-y-1 text-sm'>
                  <span className='text-muted-foreground'>Name</span> <span>{details.name}</span>
                  <span className='text-muted-foreground'>Island</span> <span>{details.island}</span>
                  <span className='text-muted-foreground'>Address</span> <span>{details.address}</span>
                  <span className='text-muted-foreground'>Email</span> <span>{details.contactEmail}</span>
                  <span className='text-muted-foreground'>Phone</span> <span>{details.contactPhone}</span>
                </div>
              </div>

              <div>
                <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5'>Modules</p>
                <div className='flex flex-wrap gap-1.5'>
                  <Badge>Tickets</Badge>
                  {OPTIONAL_MODULES.filter((m) => modules[m.key]).map((m) => (
                    <Badge key={m.key} variant='secondary'>
                      {m.label}
                    </Badge>
                  ))}
                  {OPTIONAL_MODULES.filter((m) => !modules[m.key]).map((m) => (
                    <Badge key={m.key} variant='outline' className='line-through opacity-50'>
                      {m.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5'>Settings</p>
                <div className='grid grid-cols-2 gap-x-4 gap-y-1 text-sm'>
                  <span className='text-muted-foreground'>Timezone</span> <span>{settings.timezone}</span>
                  <span className='text-muted-foreground'>Currency</span> <span>{settings.currency}</span>
                  <span className='text-muted-foreground'>Locale</span> <span>{settings.locale}</span>
                </div>
              </div>

              <div>
                <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5'>Store Admin (invite will be sent)</p>
                <div className='grid grid-cols-2 gap-x-4 gap-y-1 text-sm'>
                  <span className='text-muted-foreground'>Name</span> <span>{admin.name}</span>
                  <span className='text-muted-foreground'>Email</span> <span>{admin.email}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Navigation ────────────────────────────────────────────────────────── */}
      <div className='flex justify-between'>
        {step === 0 ? (
          <Button variant='outline' asChild>
            <Link href='/hq/stores'>Cancel</Link>
          </Button>
        ) : (
          <Button variant='outline' onClick={prev} disabled={loading}>
            <ArrowLeft className='h-4 w-4 mr-1.5' />
            Back
          </Button>
        )}

        {step < 4 ? (
          <Button onClick={next}>
            Next
            <ArrowRight className='h-4 w-4 ml-1.5' />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating store…' : 'Create Store'}
            {!loading && <Check className='h-4 w-4 ml-1.5' />}
          </Button>
        )}
      </div>
    </div>
  );
}
