'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-provider';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getTechnicianMetrics,
  getTicketMetrics,
  getCustomerMetrics,
  getEquipmentMetrics,
  getRevenueMetrics,
  getServiceQualityMetrics,
  TechnicianMetrics,
  TicketMetrics,
  CustomerMetrics,
  EquipmentMetrics,
  RevenueMetrics,
  ServiceQualityMetrics,
} from '@/lib/actions/reports';
import { TechnicianPerformanceReport } from '@/components/reports/technician-performance-report';
import { TicketAnalyticsReport } from '@/components/reports/ticket-analytics-report';
import { CustomerAnalysisReport } from '@/components/reports/customer-analysis-report';
import { EquipmentAnalysisReport } from '@/components/reports/equipment-analysis-report';
import { RevenueReport } from '@/components/reports/revenue-report';
import { ServiceQualityReport } from '@/components/reports/service-quality-report';
import { BarChart3, Users, TrendingUp, Wrench, DollarSign, CheckCircle } from 'lucide-react';

export default function ReportsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [techMetrics, setTechMetrics] = useState<TechnicianMetrics[]>([]);
  const [ticketMetrics, setTicketMetrics] = useState<TicketMetrics | null>(null);
  const [customerMetrics, setCustomerMetrics] = useState<CustomerMetrics[]>([]);
  const [equipmentMetrics, setEquipmentMetrics] = useState<EquipmentMetrics[]>([]);
  const [revenueMetrics, setRevenueMetrics] = useState<RevenueMetrics[]>([]);
  const [qualityMetrics, setQualityMetrics] = useState<ServiceQualityMetrics | null>(null);

  useEffect(() => {
    if (!user || !['admin', 'management'].includes(user.role)) {
      router.push('/dashboard');
      return;
    }
    loadAllReports();
  }, [user]);

  const loadAllReports = async () => {
    try {
      setLoading(true);
      const [tech, ticket, customer, equipment, revenue, quality] = await Promise.all([
        getTechnicianMetrics(),
        getTicketMetrics(),
        getCustomerMetrics(),
        getEquipmentMetrics(),
        getRevenueMetrics(),
        getServiceQualityMetrics(),
      ]);

      console.log('Report data loaded:', { tech, ticket, customer, equipment, revenue, quality });
      setTechMetrics(tech || []);
      setTicketMetrics(ticket);
      setCustomerMetrics(customer || []);
      setEquipmentMetrics(equipment || []);
      setRevenueMetrics(revenue || []);
      setQualityMetrics(quality);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user || !['admin', 'management'].includes(user.role)) return null;

  return (
    <DashboardLayout>
      <div className='space-y-6'>
        <div>
          <h2 className='text-2xl font-bold'>Management Reports</h2>
          <p className='text-slate-600 dark:text-slate-400'>Comprehensive analytics and insights for business decision making</p>
        </div>

        {loading ? (
          <div className='space-y-4'>
            <Skeleton className='h-32 w-full' />
            <Skeleton className='h-96 w-full' />
          </div>
        ) : (
          <Tabs defaultValue='tickets' className='space-y-4 sm:space-y-6'>
            <TabsList className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1 sm:gap-2 w-full'>
              <TabsTrigger value='tickets' className='flex flex-col sm:flex-row items-center justify-center gap-1 px-2 sm:px-4 py-2 text-xs sm:text-sm'>
                <BarChart3 className='h-4 w-4' />
                <span>Tickets</span>
              </TabsTrigger>
              <TabsTrigger value='technicians' className='flex flex-col sm:flex-row items-center justify-center gap-1 px-2 sm:px-4 py-2 text-xs sm:text-sm'>
                <Users className='h-4 w-4' />
                <span>Team</span>
              </TabsTrigger>
              <TabsTrigger value='customers' className='flex flex-col sm:flex-row items-center justify-center gap-1 px-2 sm:px-4 py-2 text-xs sm:text-sm'>
                <TrendingUp className='h-4 w-4' />
                <span>Customers</span>
              </TabsTrigger>
              <TabsTrigger value='equipment' className='flex flex-col sm:flex-row items-center justify-center gap-1 px-2 sm:px-4 py-2 text-xs sm:text-sm'>
                <Wrench className='h-4 w-4' />
                <span>Equipment</span>
              </TabsTrigger>
              <TabsTrigger value='revenue' className='flex flex-col sm:flex-row items-center justify-center gap-1 px-2 sm:px-4 py-2 text-xs sm:text-sm'>
                <DollarSign className='h-4 w-4' />
                <span>Revenue</span>
              </TabsTrigger>
              <TabsTrigger value='quality' className='flex flex-col sm:flex-row items-center justify-center gap-1 px-2 sm:px-4 py-2 text-xs sm:text-sm'>
                <CheckCircle className='h-4 w-4' />
                <span>Quality</span>
              </TabsTrigger>
            </TabsList>

            {/* Ticket Analytics */}
            <TabsContent value='tickets'>
              {ticketMetrics ? (
                <TicketAnalyticsReport data={ticketMetrics} />
              ) : (
                <Card>
                  <CardContent className='py-8'>
                    <div className='text-center text-slate-500'>No ticket data available</div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Technician Performance */}
            <TabsContent value='technicians'>
              {techMetrics.length > 0 ? (
                <TechnicianPerformanceReport data={techMetrics} />
              ) : (
                <Card>
                  <CardContent className='py-8'>
                    <div className='text-center text-slate-500'>No technician data available</div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Customer Analysis */}
            <TabsContent value='customers'>
              {customerMetrics.length > 0 ? (
                <CustomerAnalysisReport data={customerMetrics} />
              ) : (
                <Card>
                  <CardContent className='py-8'>
                    <div className='text-center text-slate-500'>No customer data available</div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Equipment Analysis */}
            <TabsContent value='equipment'>
              {equipmentMetrics.length > 0 ? (
                <EquipmentAnalysisReport data={equipmentMetrics} />
              ) : (
                <Card>
                  <CardContent className='py-8'>
                    <div className='text-center text-slate-500'>No equipment data available</div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Revenue Analysis */}
            <TabsContent value='revenue'>
              {revenueMetrics.length > 0 ? (
                <RevenueReport data={revenueMetrics} />
              ) : (
                <Card>
                  <CardContent className='py-8'>
                    <div className='text-center text-slate-500'>No revenue data available</div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Service Quality */}
            <TabsContent value='quality'>
              {qualityMetrics ? (
                <ServiceQualityReport data={qualityMetrics} />
              ) : (
                <Card>
                  <CardContent className='py-8'>
                    <div className='text-center text-slate-500'>No quality data available</div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
