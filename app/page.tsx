'use client';

import { LandingNavbar } from '@/components/landing-navbar';
import { Section, SectionHeading } from '@/components/section';
import { FeatureCard } from '@/components/feature-card';
import { ScrollReveal } from '@/components/scroll-reveal';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Ticket, Wrench, Building2, Clock, BarChart3, Lock, ArrowRight, CheckCircle, FileText, Globe, MapPin, ShieldCheck, Users, TrendingUp, Layers } from 'lucide-react';

const MOCK_TICKETS = [
  { id: '#T-1042', customer: 'Sunrise Café & Bakery', machine: 'Crescendo · SN-00412', status: 'Urgent', statusClass: 'bg-destructive/10 text-destructive' },
  { id: '#T-1041', customer: 'Blue Mountain Café', machine: 'Espresso Pro · SN-00387', status: 'Assigned', statusClass: 'bg-primary/10 text-primary' },
  { id: '#T-1040', customer: 'Island Roasters Ltd', machine: 'Grinder X · SN-00291', status: 'Closed', statusClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { id: '#T-1039', customer: 'Harbour View Hotel', machine: 'Barista · SN-00188', status: 'Open', statusClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
];

const ISLANDS = [
  { name: 'Trinidad', flag: '\u{1F1F9}\u{1F1F9}', status: 'HQ' },
  { name: 'Barbados', flag: '\u{1F1E7}\u{1F1E7}', status: 'Branch' },
  { name: 'Jamaica', flag: '\u{1F1EF}\u{1F1F2}', status: 'Branch' },
  { name: 'Guyana', flag: '\u{1F1EC}\u{1F1FE}', status: 'Branch' },
  { name: 'St. Lucia', flag: '\u{1F1F1}\u{1F1E8}', status: 'Branch' },
  { name: 'Grenada', flag: '\u{1F1EC}\u{1F1E9}', status: 'Branch' },
];

const PLATFORM_STATS = [
  { value: '6+', label: 'Territories Supported', icon: <Globe className='h-5 w-5' /> },
  { value: '100%', label: 'Audit Trail Coverage', icon: <ShieldCheck className='h-5 w-5' /> },
  { value: 'Real-time', label: 'Cross-island Sync', icon: <TrendingUp className='h-5 w-5' /> },
  { value: 'Zero', label: 'Setup Fee', icon: <CheckCircle className='h-5 w-5' /> },
];

export default function HomePage() {
  return (
    <>
      <LandingNavbar />

      {/* â—€â—€ Hero "— dark navy, full-width â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€ */}
      <section className='relative bg-sidebar overflow-hidden pt-20 pb-20 sm:pt-32 sm:pb-32'>
        {/* Subtle grid texture */}
        <div
          className='pointer-events-none absolute inset-0 opacity-[0.04]'
          style={{
            backgroundImage: 'linear-gradient(oklch(0.93 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(0.93 0 0) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Blue glow top-right */}
        <div className='pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl' />
        {/* Blue glow bottom-left */}
        <div className='pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl' />

        <div className='relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
          <div className='grid lg:grid-cols-2 gap-12 lg:gap-20 items-center'>
            {/* Left: Copy */}
            <div className='animate-fade-in'>
              <div className='inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6'>
                <span className='h-1.5 w-1.5 rounded-full bg-primary animate-pulse' />
                Built exclusively for Caribbean Roasters
              </div>
              <h1 className='text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.05]' style={{ fontFamily: 'var(--font-playfair-display)' }}>
                One Platform.
                <br />
                <span className='text-primary'>Every Territory.</span>
              </h1>
              <p className='mt-6 text-lg text-sidebar-foreground/70 leading-relaxed sm:text-xl max-w-lg'>
                Manage service tickets, dispatch technicians, track machine health, and generate client reports &mdash; across every Caribbean Roasters branch, from a single command centre.
              </p>
              <div className='mt-8 flex flex-col gap-3 sm:flex-row'>
                <Button asChild size='lg' className='text-base font-semibold'>
                  <Link href='/login'>
                    Access Your Dashboard <ArrowRight className='ml-2 h-4 w-4' />
                  </Link>
                </Button>
                <Button asChild size='lg' variant='outline' className='bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white text-base'>
                  <Link href='/#features'>See What&apos;s Inside</Link>
                </Button>
              </div>
              <div className='mt-10 flex flex-wrap gap-x-6 gap-y-2'>
                {['Role-based access control', 'Real-time ticket sync', 'HQ aggregate reporting'].map((item) => (
                  <span key={item} className='flex items-center gap-1.5 text-sm text-sidebar-foreground/60'>
                    <CheckCircle className='h-4 w-4 text-primary shrink-0' />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: Live dashboard mock */}
            <div className='animate-slide-in-right'>
              <div className='rounded-xl border border-sidebar-border bg-sidebar-accent shadow-2xl overflow-hidden ring-1 ring-white/5'>
                {/* Window chrome */}
                <div className='border-b border-sidebar-border bg-sidebar/80 px-5 py-3 flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <div className='flex gap-1.5'>
                      <div className='h-3 w-3 rounded-full bg-red-500/60' />
                      <div className='h-3 w-3 rounded-full bg-amber-500/60' />
                      <div className='h-3 w-3 rounded-full bg-emerald-500/60' />
                    </div>
                    <span className='ml-2 text-xs font-medium text-sidebar-foreground/60 font-mono'>cr-field-service.vercel.app</span>
                  </div>
                  <span className='flex items-center gap-1.5 text-xs text-emerald-400 font-medium'>
                    <span className='h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse' />
                    Live
                  </span>
                </div>
                {/* Stats row */}
                <div className='grid grid-cols-3 divide-x divide-sidebar-border border-b border-sidebar-border'>
                  {[
                    { label: 'Open', value: '14', cls: 'text-destructive' },
                    { label: 'In Progress', value: '9', cls: 'text-primary' },
                    { label: 'Closed today', value: '7', cls: 'text-emerald-400' },
                  ].map((s) => (
                    <div key={s.label} className='px-4 py-4 text-center'>
                      <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
                      <p className='text-xs text-sidebar-foreground/50 mt-0.5'>{s.label}</p>
                    </div>
                  ))}
                </div>
                {/* Ticket rows */}
                <div className='divide-y divide-sidebar-border'>
                  {MOCK_TICKETS.map((t) => (
                    <div key={t.id} className='flex items-center justify-between px-5 py-3 text-sm hover:bg-sidebar/60 transition-colors'>
                      <div className='flex items-center gap-3 min-w-0'>
                        <span className='font-mono text-[11px] font-bold text-sidebar-foreground/40 shrink-0'>{t.id}</span>
                        <div className='min-w-0'>
                          <p className='font-medium text-sidebar-foreground truncate'>{t.customer}</p>
                          <p className='text-xs text-sidebar-foreground/50 truncate'>{t.machine}</p>
                        </div>
                      </div>
                      <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ml-2 ${t.statusClass}`}>{t.status}</span>
                    </div>
                  ))}
                </div>
                <div className='border-t border-sidebar-border bg-sidebar/60 px-5 py-2.5 flex items-center justify-between'>
                  <span className='text-xs text-sidebar-foreground/40'>Caribbean Roasters HQ · Trinidad</span>
                  <span className='text-xs text-sidebar-foreground/40'>30 total tickets</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* â—€â—€ Platform stats bar â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€ */}
      <div className='bg-primary'>
        <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8'>
          <div className='grid grid-cols-2 gap-8 lg:grid-cols-4'>
            {PLATFORM_STATS.map((stat) => (
              <div key={stat.value} className='flex flex-col items-center text-center gap-2'>
                <div className='text-white/60'>{stat.icon}</div>
                <p className='text-xl font-bold text-white sm:text-2xl' style={{ fontFamily: 'var(--font-playfair-display)' }}>
                  {stat.value}
                </p>
                <p className='text-sm text-white/70'>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* â—€â—€ Multi-Island Operations â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€ */}
      <Section id='territories' className='bg-muted'>
        <div className='grid gap-12 lg:grid-cols-2 lg:gap-20 items-center'>
          <ScrollReveal animation='slide-in-left'>
            <div className='inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary uppercase tracking-widest mb-4'>
              <Globe className='h-3.5 w-3.5' />
              Multi-Territory Operations
            </div>
            <h2 className='text-3xl font-black tracking-tight text-foreground sm:text-4xl leading-tight' style={{ fontFamily: 'var(--font-playfair-display)' }}>
              One view across
              <br />
              <span className='text-primary'>every island.</span>
            </h2>
            <p className='mt-4 text-lg text-muted-foreground leading-relaxed'>
              Caribbean Roasters operates across the region. This platform brings every branch into a unified HQ dashboard &mdash; with per-territory isolation and cross-island reporting built in from
              day one.
            </p>
            <ul className='mt-8 space-y-3'>
              {[
                'Each branch manages its own tickets, customers, and technicians independently',
                'HQ super-admin gets an aggregate view across all territories',
                'New branches onboarded instantly \u2014 no engineering required',
                "Per-store module toggles to match each territory's operations",
              ].map((item, i) => (
                <li key={i} className='flex items-start gap-3'>
                  <CheckCircle className='h-5 w-5 shrink-0 text-primary mt-0.5' />
                  <span className='text-sm text-foreground leading-relaxed'>{item}</span>
                </li>
              ))}
            </ul>
          </ScrollReveal>

          {/* Island grid */}
          <ScrollReveal animation='slide-in-right'>
            <div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
              {ISLANDS.map((island, i) => (
                <div
                  key={island.name}
                  className={`relative rounded-xl border p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                    island.status === 'HQ' ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-card hover:border-primary/30'
                  }`}
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {island.status === 'HQ' && <span className='absolute top-2 right-2 text-[9px] font-bold tracking-widest text-primary uppercase bg-primary/10 px-1.5 py-0.5 rounded-full'>HQ</span>}
                  <div className='text-2xl mb-2'>{island.flag}</div>
                  <p className='text-sm font-semibold text-foreground'>{island.name}</p>
                  <div className='flex items-center gap-1 mt-1'>
                    <span className='h-1.5 w-1.5 rounded-full bg-emerald-500' />
                    <p className='text-xs text-muted-foreground'>Active</p>
                  </div>
                </div>
              ))}
            </div>
            <p className='text-xs text-muted-foreground text-center mt-4 flex items-center justify-center gap-1'>
              <MapPin className='h-3 w-3' /> Expandable to any territory as Caribbean Roasters grows
            </p>
          </ScrollReveal>
        </div>
      </Section>

      {/* â—€â—€ Features â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€ */}
      <Section id='features'>
        <SectionHeading
          title="Everything your team needs. Nothing they don't."
          description='Purpose-built for Caribbean Roasters field operations — from the first service call to the client sign-off report.'
        />

        <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
          <ScrollReveal animation='slide-in-up' delay={0}>
            <FeatureCard
              icon={<Ticket className='h-6 w-6' />}
              title='Ticket Management'
              description='Create, assign, and track service tickets in real-time. Automatic numbering, priority routing, and full status history per ticket.'
            />
          </ScrollReveal>
          <ScrollReveal animation='slide-in-up' delay={100}>
            <FeatureCard
              icon={<Wrench className='h-6 w-6' />}
              title='Technician Workflow'
              description='Log work hours, parts used, and completion notes directly from the field. Time tracking and charge-out rates built in.'
            />
          </ScrollReveal>
          <ScrollReveal animation='slide-in-up' delay={200}>
            <FeatureCard
              icon={<Building2 className='h-6 w-6' />}
              title='Customers & Machines'
              description='Centralised records for all clients, machine installations, serial numbers, and full service history — searchable in seconds.'
            />
          </ScrollReveal>
          <ScrollReveal animation='slide-in-up' delay={300}>
            <FeatureCard
              icon={<Clock className='h-6 w-6' />}
              title='Full Audit Trail'
              description='Every service action is timestamped and logged. Know exactly who did what, when, and on which machine — always.'
            />
          </ScrollReveal>
          <ScrollReveal animation='slide-in-up' delay={400}>
            <FeatureCard
              icon={<BarChart3 className='h-6 w-6' />}
              title='Reporting & Analytics'
              description='Technician KPIs, parts usage, machine health trends, and territory-level breakdowns. Export client-ready reports in one click.'
            />
          </ScrollReveal>
          <ScrollReveal animation='slide-in-up' delay={500}>
            <FeatureCard
              icon={<Layers className='h-6 w-6' />}
              title='HQ Command Centre'
              description='Super-admin view aggregates data across all territories. Real-time KPIs, cross-store tickets, and branch performance at a glance.'
            />
          </ScrollReveal>
          <ScrollReveal animation='slide-in-up' delay={600}>
            <FeatureCard
              icon={<Users className='h-6 w-6' />}
              title='Role-Based Access'
              description='Super Admin, Store Admin, Call Admin, and Technician tiers. Each role sees exactly what they need — nothing more.'
            />
          </ScrollReveal>
          <ScrollReveal animation='slide-in-up' delay={700}>
            <FeatureCard
              icon={<Lock className='h-6 w-6' />}
              title='Secure by Design'
              description={"Firestore security rules enforce strict data isolation between territories. One branch cannot see another's data — ever."}
            />
          </ScrollReveal>
          <ScrollReveal animation='slide-in-up' delay={800}>
            <FeatureCard
              icon={<Globe className='h-6 w-6' />}
              title='Instant Branch Onboarding'
              description='HQ can spin up a new territory store in minutes. No developers needed. Enable the modules that branch requires and go.'
            />
          </ScrollReveal>
        </div>
      </Section>

      {/* â—€â—€ How It Works â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€ */}
      <Section id='how-it-works' className='bg-muted'>
        <SectionHeading title='Up and running in minutes' description='Designed for the Caribbean Roasters team — not for IT departments.' />

        <div className='grid gap-8 sm:grid-cols-3'>
          {[
            {
              step: 1,
              title: 'HQ Sets Up the Platform',
              description: 'Super-admin creates store profiles for each territory, assigns branch admins, and configures which modules each location needs.',
            },
            {
              step: 2,
              title: 'Branch Teams Take Over',
              description: 'Each store admin adds their customers, machines, and technicians. Call admins start logging tickets. Technicians receive assignments instantly.',
            },
            {
              step: 3,
              title: 'Track, Report & Scale',
              description: 'HQ monitors performance across every island in real time. Close tickets, generate reports, and onboard new territories as the business grows.',
            },
          ].map((item, index) => (
            <ScrollReveal key={index} animation='slide-in-up' delay={index * 200}>
              <div className='relative'>
                {index < 2 && <div className='absolute right-0 top-6 hidden h-px w-1/4 -translate-x-1/4 bg-border sm:block' />}
                <div className='flex flex-col items-center text-center'>
                  <div className='mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white font-black text-xl' style={{ fontFamily: 'var(--font-playfair-display)' }}>
                    {item.step}
                  </div>
                  <h3 className='text-lg font-semibold text-foreground'>{item.title}</h3>
                  <p className='mt-3 text-sm text-muted-foreground leading-relaxed'>{item.description}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </Section>

      {/* â—€â—€ See It In Action "— split â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€ */}
      <Section id='preview'>
        <div className='grid gap-12 lg:grid-cols-2 lg:gap-16 items-center'>
          <ScrollReveal animation='slide-in-left'>
            <div className='inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary uppercase tracking-widest mb-4'>Full Visibility</div>
            <h2 className='text-3xl font-black tracking-tight text-foreground sm:text-4xl leading-tight' style={{ fontFamily: 'var(--font-playfair-display)' }}>
              Every service call.
              <br />
              <span className='text-primary'>Fully accountable.</span>
            </h2>
            <p className='mt-4 text-lg text-muted-foreground'>
              From the moment a ticket is opened to the client sign-off, every step is tracked, timestamped, and auditable. Nothing falls through the cracks &mdash; across any territory.
            </p>
            <ul className='mt-8 space-y-3'>
              {[
                'Real-time ticket status across your entire regional team',
                'Technician time logs and parts used \u2014 per visit',
                'Machine service history and maintenance schedule',
                'Client-ready PDF reports generated in one click',
              ].map((item, index) => (
                <li key={index} className='flex items-start gap-3'>
                  <CheckCircle className='h-5 w-5 shrink-0 text-primary mt-0.5' />
                  <span className='text-foreground text-sm sm:text-base'>{item}</span>
                </li>
              ))}
            </ul>
            <div className='mt-10'>
              <Button asChild size='lg' className='font-semibold'>
                <Link href='/login'>
                  Go to Dashboard <ArrowRight className='ml-2 h-4 w-4' />
                </Link>
              </Button>
            </div>
          </ScrollReveal>

          {/* Realistic ticket detail mockup */}
          <ScrollReveal animation='slide-in-right'>
            <div className='rounded-xl border border-border bg-card shadow-lg overflow-hidden ring-1 ring-border/50'>
              <div className='border-b border-border bg-muted/50 px-5 py-3.5 flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <span className='text-sm font-semibold text-foreground'>TKT-20260515-042</span>
                  <span className='inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary'>Assigned</span>
                </div>
                <span className='inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive'>Urgent</span>
              </div>
              <div className='p-5 space-y-3'>
                {[
                  { label: 'Branch', value: 'Trinidad \u2014 HQ' },
                  { label: 'Customer', value: 'Sunrise Café & Bakery' },
                  { label: 'Machine', value: 'Crescendo · SN-00412' },
                  { label: 'Technician', value: 'Marcus Williams' },
                  { label: 'Scheduled', value: 'May 15, 2026 · 9:00 AM' },
                ].map((row) => (
                  <div key={row.label} className='flex items-center justify-between py-1 border-b border-border last:border-0'>
                    <span className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>{row.label}</span>
                    <span className='text-sm text-foreground font-medium'>{row.value}</span>
                  </div>
                ))}
                <div className='pt-2'>
                  <span className='text-xs font-medium uppercase tracking-wide text-muted-foreground block mb-2'>Issue</span>
                  <p className='text-sm text-foreground leading-relaxed bg-muted/60 rounded-lg p-3 border border-border'>
                    Machine failing to maintain brew temperature. Customer reports inconsistent shot quality over last 48hrs. Possible thermostat fault &mdash; parts ordered.
                  </p>
                </div>
              </div>
              <div className='border-t border-border bg-muted/30 px-5 py-3 flex items-center justify-between'>
                <div className='flex items-center gap-2 text-muted-foreground'>
                  <FileText className='h-4 w-4' />
                  <span className='text-xs'>Checklist: 3/5 complete · 2 parts logged</span>
                </div>
                <span className='text-xs text-primary font-medium'>View full ticket &rarr;</span>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </Section>

      {/* â—€â—€ CTA â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€ */}
      <section className='relative overflow-hidden bg-sidebar py-20 sm:py-28'>
        <div
          className='pointer-events-none absolute inset-0 opacity-[0.04]'
          style={{
            backgroundImage: 'linear-gradient(oklch(0.93 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(0.93 0 0) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className='pointer-events-none absolute -top-24 right-0 h-80 w-80 rounded-full bg-primary/20 blur-3xl' />
        <div className='pointer-events-none absolute bottom-0 left-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl' />
        <div className='relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8'>
          <div className='inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6'>
            <span className='h-1.5 w-1.5 rounded-full bg-primary' />
            Caribbean Roasters · Exclusive Platform
          </div>
          <h2 className='text-4xl font-black tracking-tight text-white sm:text-5xl leading-tight' style={{ fontFamily: 'var(--font-playfair-display)' }}>
            Your service operation,
            <br />
            <span className='text-primary'>under control.</span>
          </h2>
          <p className='mx-auto mt-6 max-w-2xl text-lg text-sidebar-foreground/70'>
            A platform built specifically for Caribbean Roasters &mdash; tailored to your workflows, your territories, and your team. No one else runs what you run.
          </p>
          <div className='mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center'>
            <Button asChild size='lg' className='font-semibold text-base'>
              <Link href='/login'>
                Access Your Dashboard <ArrowRight className='ml-2 h-4 w-4' />
              </Link>
            </Button>
            <Button asChild size='lg' variant='outline' className='bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white'>
              <Link href='/#features'>Explore Features</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* â—€â—€ Footer â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€â—€ */}
      <footer className='bg-sidebar text-sidebar-foreground border-t border-sidebar-border'>
        <div className='mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8'>
          <div className='grid gap-10 sm:grid-cols-2 lg:grid-cols-4 pb-10 border-b border-sidebar-border'>
            {/* Brand col */}
            <div className='lg:col-span-2'>
              <div className='flex items-center gap-2.5 mb-4'>
                <div className='flex h-9 w-9 items-center justify-center rounded-md bg-primary shadow-sm'>
                  <span className='text-xs font-black text-white tracking-tight'>CR</span>
                </div>
                <div className='flex flex-col leading-none'>
                  <span className='text-sm font-black tracking-tight text-sidebar-foreground' style={{ fontFamily: 'var(--font-playfair-display)' }}>
                    CARIBBEAN ROASTERS
                  </span>
                  <span className='text-[10px] font-medium text-sidebar-foreground/50 tracking-widest uppercase'>Field Service Platform</span>
                </div>
              </div>
              <p className='text-sm text-sidebar-foreground/50 leading-relaxed max-w-xs'>
                A custom-built service operations platform for Caribbean Roasters Ltd &mdash; managing field service across the Caribbean region.
              </p>
              <p className='mt-4 text-xs text-sidebar-foreground/30'>
                Built &amp; maintained by <span className='text-sidebar-foreground/50 font-medium'>Tech Dynamics</span>
              </p>
            </div>
            {/* Platform links */}
            <div>
              <h3 className='text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-widest mb-4'>Platform</h3>
              <ul className='space-y-2.5'>
                {[
                  { label: 'Features', href: '/#features' },
                  { label: 'How It Works', href: '/#how-it-works' },
                  { label: 'Territories', href: '/#territories' },
                  { label: 'Dashboard', href: '/login' },
                ].map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className='text-sm text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors'>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            {/* Account links */}
            <div>
              <h3 className='text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-widest mb-4'>Account</h3>
              <ul className='space-y-2.5'>
                {[
                  { label: 'Sign In', href: '/login' },
                  { label: 'HQ Dashboard', href: '/hq/dashboard' },
                  { label: 'Support', href: 'mailto:support@techdynamics.tt' },
                ].map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className='text-sm text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors'>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className='pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-sidebar-foreground/30'>
            <p>&copy; {new Date().getFullYear()} Caribbean Roasters Ltd. All rights reserved.</p>
            <p>
              Platform by <span className='text-sidebar-foreground/50'>Tech Dynamics</span>
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
