'use client';

import { LandingNavbar } from '@/components/landing-navbar';
import { Section, SectionHeading } from '@/components/section';
import { FeatureCard } from '@/components/feature-card';
import { ScrollReveal } from '@/components/scroll-reveal';
import { CTASection } from '@/components/cta-section';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Ticket, Wrench, Building2, Clock, BarChart3, Lock, ArrowRight, CheckCircle } from 'lucide-react';

export default function HomePage() {
  return (
    <>
      <LandingNavbar />

      {/* Hero Section */}
      <section className='relative overflow-hidden bg-gradient-to-b from-card via-card to-background pt-32 pb-20 sm:pt-48 sm:pb-32'>
        <div className='absolute inset-0 overflow-hidden'>
          <div className='absolute -right-40 top-0 h-80 w-80 rounded-full bg-accent/10 blur-3xl' />
          <div className='absolute -left-40 bottom-0 h-80 w-80 rounded-full bg-primary/10 blur-3xl' />
        </div>

        <div className='relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
          <div className='mx-auto max-w-3xl text-center'>
            <h1 className='text-4xl font-bold tracking-tight text-foreground sm:text-6xl animate-fade-in'>
              Service Management, <span className='bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent animate-gradient-shift'>Simplified</span>
            </h1>

            <p className='mt-6 text-xl text-muted-foreground sm:text-2xl animate-fade-in stagger-1'>
              Manage technician tickets, track service history, and optimize your operations—all in one platform. Built for service businesses that demand reliability.
            </p>

            <div className='mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center animate-fade-in stagger-2'>
              <Button asChild size='lg' className='bg-primary hover:bg-primary/90 text-white font-semibold h-12 transition-all duration-300 hover:scale-105 hover:shadow-lg'>
                <Link href='/signup'>
                  Get Started Free <ArrowRight className='ml-2 h-5 w-5 transition-transform group-hover:translate-x-1' />
                </Link>
              </Button>
              <Button asChild size='lg' variant='outline' className='h-12 font-semibold transition-all duration-300 hover:scale-105 hover:bg-accent/10'>
                <Link href='#features'>Learn More</Link>
              </Button>
            </div>

            <p className='mt-6 text-sm text-muted-foreground animate-fade-in stagger-3'>No credit card required. Set up in minutes.</p>
          </div>

          {/* Illustration placeholder */}
          <div className='mt-20 rounded-xl border border-border bg-linear-to-b from-primary/5 to-accent/5 p-12 sm:p-20 animate-slide-in-up stagger-4 transition-all duration-300 hover:shadow-xl hover:border-primary/30'>
            <div className='aspect-video rounded-lg bg-linear-to-br from-primary/10 to-accent/10 flex items-center justify-center text-muted-foreground'>
              <div className='text-center animate-float'>
                <BarChart3 className='h-20 w-20 mx-auto mb-4 opacity-20' />
                <p>Dashboard Preview</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <Section id='features'>
        <SectionHeading title='Everything You Need to Run Your Service Business' description='Powerful features designed to streamline your operations and improve customer satisfaction' />

        <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
          <ScrollReveal animation='slide-in-up' delay={0}>
            <FeatureCard
              icon={<Ticket className='h-6 w-6' />}
              title='Ticket Management'
              description='Create, assign, and track service tickets in real-time with automatic numbering and status updates.'
            />
          </ScrollReveal>
          <ScrollReveal animation='slide-in-up' delay={100}>
            <FeatureCard icon={<Wrench className='h-6 w-6' />} title='Technician Workflow' description='Log work hours, materials used, and completion notes directly from the field.' />
          </ScrollReveal>
          <ScrollReveal animation='slide-in-up' delay={200}>
            <FeatureCard icon={<Building2 className='h-6 w-6' />} title='Customer & Assets' description='Maintain centralized records for all customers, machines, and service history.' />
          </ScrollReveal>
          <ScrollReveal animation='slide-in-up' delay={300}>
            <FeatureCard icon={<Clock className='h-6 w-6' />} title='Service History' description='Complete audit trail of every service visit, repair, and maintenance performed.' />
          </ScrollReveal>
          <ScrollReveal animation='slide-in-up' delay={400}>
            <FeatureCard icon={<BarChart3 className='h-6 w-6' />} title='Reporting & Analytics' description='Insights into service performance, customer metrics, and operational trends.' />
          </ScrollReveal>
          <ScrollReveal animation='slide-in-up' delay={500}>
            <FeatureCard icon={<Lock className='h-6 w-6' />} title='Role-Based Access' description='Admin, technician, and management-level permissions for secure operations.' />
          </ScrollReveal>
        </div>
      </Section>

      {/* How It Works Section */}
      <Section id='how-it-works' className='bg-gradient-to-b from-background to-card/30'>
        <SectionHeading title='Get up and running in three simple steps' description='From setup to full operation in minutes, not days' />

        <div className='grid gap-8 sm:grid-cols-3'>
          {[
            {
              step: 1,
              title: 'Create',
              description: 'Add your customers, machines, and service offerings to the platform.',
            },
            {
              step: 2,
              title: 'Assign',
              description: 'Create service tickets and assign them to your technician team.',
            },
            {
              step: 3,
              title: 'Track',
              description: 'Monitor progress in real-time and generate comprehensive reports.',
            },
          ].map((item, index) => (
            <ScrollReveal key={index} animation='slide-in-up' delay={index * 300}>
              <div className='relative'>
                {index < 2 && <div className='absolute right-0 top-6 hidden h-1 w-1/4 -translate-x-1/4 bg-gradient-to-r from-accent/50 to-transparent sm:block' />}

                <div className='flex flex-col items-center text-center transition-all duration-300 hover:scale-105'>
                  <div className='mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white font-bold text-xl transition-all duration-300 group-hover:shadow-lg'>
                    {item.step}
                  </div>
                  <h3 className='text-xl font-semibold text-foreground transition-colors duration-300 hover:text-primary'>{item.title}</h3>
                  <p className='mt-3 text-muted-foreground transition-colors duration-300'>{item.description}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </Section>

      {/* Key Features Highlight */}
      <Section id='preview'>
        <div className='grid gap-12 lg:grid-cols-2 lg:gap-8 items-center'>
          <ScrollReveal animation='slide-in-left'>
            <h2 className='text-3xl font-bold text-foreground sm:text-4xl transition-colors duration-300'>Powerful Dashboard Overview</h2>
            <p className='mt-4 text-lg text-muted-foreground transition-colors duration-300'>
              Get instant visibility into all active tickets and service metrics. Monitor your team's performance, track technician assignments, and manage your entire operation from one unified
              interface.
            </p>

            <ul className='mt-8 space-y-4'>
              {['Real-time ticket status updates', 'Technician availability and assignments', 'Service completion metrics', 'Customer satisfaction tracking'].map((item, index) => (
                <li key={index} className='flex items-start gap-3 animate-fade-in transition-all duration-300 hover:translate-x-1' style={{ animationDelay: `${100 * (index + 1)}ms` }}>
                  <CheckCircle className='h-6 w-6 flex-shrink-0 text-primary mt-0.5 transition-transform duration-300 hover:scale-110' />
                  <span className='text-foreground transition-colors duration-300'>{item}</span>
                </li>
              ))}
            </ul>

            <div className='mt-10'>
              <Button asChild size='lg' className='bg-primary hover:bg-primary/90 transition-all duration-300 hover:scale-105 hover:shadow-lg'>
                <Link href='/signup'>Start Your Free Trial</Link>
              </Button>
            </div>
          </ScrollReveal>

          <ScrollReveal animation='slide-in-right'>
            <div className='rounded-xl border border-border bg-gradient-to-b from-primary/5 to-accent/5 p-8 sm:p-12 transition-all duration-300 hover:shadow-xl hover:border-primary/30'>
              <div className='aspect-square rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center text-muted-foreground animate-float'>
                <div className='text-center'>
                  <BarChart3 className='h-24 w-24 mx-auto mb-4 opacity-30 transition-opacity duration-300' />
                  <p className='text-lg'>Dashboard Screenshot</p>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </Section>

      {/* CTA Section */}
      <CTASection
        title='Ready to Transform Your Service Management?'
        description='Join hundreds of service businesses that have streamlined their operations with Tech Dynamics. Start for free today.'
        primaryAction={{
          label: 'Create Your Account',
          href: '/signup',
        }}
        secondaryAction={{
          label: 'Schedule a Demo',
          href: '/login',
        }}
      />

      {/* Footer */}
      <footer className='border-t border-border bg-card'>
        <div className='mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8'>
          <div className='grid gap-8 sm:grid-cols-2 lg:grid-cols-4'>
            <div>
              <h3 className='text-sm font-semibold text-foreground'>Product</h3>
              <ul className='mt-4 space-y-2'>
                <li>
                  <Link href='#features' className='text-sm text-muted-foreground hover:text-foreground transition-colors'>
                    Features
                  </Link>
                </li>
                <li>
                  <Link href='#' className='text-sm text-muted-foreground hover:text-foreground transition-colors'>
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href='#' className='text-sm text-muted-foreground hover:text-foreground transition-colors'>
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className='text-sm font-semibold text-foreground'>Company</h3>
              <ul className='mt-4 space-y-2'>
                <li>
                  <Link href='#' className='text-sm text-muted-foreground hover:text-foreground transition-colors'>
                    About
                  </Link>
                </li>
                <li>
                  <Link href='#' className='text-sm text-muted-foreground hover:text-foreground transition-colors'>
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href='#' className='text-sm text-muted-foreground hover:text-foreground transition-colors'>
                    Careers
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className='text-sm font-semibold text-foreground'>Resources</h3>
              <ul className='mt-4 space-y-2'>
                <li>
                  <Link href='#' className='text-sm text-muted-foreground hover:text-foreground transition-colors'>
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href='#' className='text-sm text-muted-foreground hover:text-foreground transition-colors'>
                    Support
                  </Link>
                </li>
                <li>
                  <Link href='#' className='text-sm text-muted-foreground hover:text-foreground transition-colors'>
                    Status
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className='text-sm font-semibold text-foreground'>Legal</h3>
              <ul className='mt-4 space-y-2'>
                <li>
                  <Link href='#' className='text-sm text-muted-foreground hover:text-foreground transition-colors'>
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href='#' className='text-sm text-muted-foreground hover:text-foreground transition-colors'>
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href='#' className='text-sm text-muted-foreground hover:text-foreground transition-colors'>
                    Security
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className='mt-8 border-t border-border pt-8 text-center text-sm text-muted-foreground'>
            <p>&copy; 2026 Tech Dynamics. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
