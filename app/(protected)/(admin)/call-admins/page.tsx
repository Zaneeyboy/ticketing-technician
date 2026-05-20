import { Metadata } from 'next';
import DashboardLayout from '@/components/dashboard-layout';
import { adminDb } from '@/lib/firebase/admin';
import { requireRole } from '@/lib/auth/role-guard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CallAdminsTable } from './call-admins-table';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Call Administrators',
  description: 'Monitor call administrator performance and ticket metrics',
};

interface CallAdminSummary {
  uid: string;
  name: string;
  email: string;
  createdCount: number;
  activeCount: number;
  closedCount: number;
  createdAt: Date;
}

export default async function CallAdminsPage() {
  const currentUser = await requireRole(['store_admin', 'super_admin']);

  const loadData = async (): Promise<CallAdminSummary[]> => {
    try {
      // Build query — super_admin sees all stores, store_admin only sees their own store
      let callAdminsQuery = adminDb.collection('users').where('role', '==', 'call_admin');
      if (currentUser.role === 'store_admin' && currentUser.storeId) {
        callAdminsQuery = callAdminsQuery.where('storeId', '==', currentUser.storeId) as any;
      }
      const callAdminDocs = await callAdminsQuery.get();

      // Map user documents to summaries using aggregated stats
      const summaries: CallAdminSummary[] = callAdminDocs.docs.map((doc) => {
        const callAdminData = doc.data();
        const uid = doc.id;
        const stats = callAdminData.stats || {};

        return {
          uid,
          name: callAdminData.name || 'Unknown',
          email: callAdminData.email || '',
          createdCount: stats.totalTickets || 0,
          activeCount: (stats.openTickets || 0) + (stats.assignedTickets || 0),
          closedCount: stats.closedTickets || 0,
          createdAt: callAdminData.createdAt?.toDate?.() || new Date(),
        };
      });

      // Sort by created count (most active first)
      return summaries.sort((a, b) => b.createdCount - a.createdCount);
    } catch (error) {
      console.error('Error loading call admin data:', error);
      return [];
    }
  };

  const callAdmins = await loadData();

  return (
    <DashboardLayout>
      <div className='space-y-6'>
        <div>
          <p className='text-muted-foreground'>Monitor call administrator performance and ticket creation metrics</p>
        </div>

        {/* Summary Stats */}
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          <Card className='animate-scale-in' style={{ animationDelay: '0ms' }}>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium text-muted-foreground'>Total Call Admins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{callAdmins.length}</div>
            </CardContent>
          </Card>

          <Card className='animate-scale-in' style={{ animationDelay: '60ms' }}>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium text-muted-foreground'>Total Tickets Created</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{callAdmins.reduce((sum, ca) => sum + ca.createdCount, 0)}</div>
            </CardContent>
          </Card>

          <Card className='animate-scale-in' style={{ animationDelay: '120ms' }}>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium text-muted-foreground'>Currently Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{callAdmins.reduce((sum, ca) => sum + ca.activeCount, 0)}</div>
            </CardContent>
          </Card>

          <Card className='animate-scale-in' style={{ animationDelay: '180ms' }}>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium text-muted-foreground'>Total Closed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{callAdmins.reduce((sum, ca) => sum + ca.closedCount, 0)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Call Admins Table */}
        <CallAdminsTable callAdmins={callAdmins} />
      </div>
    </DashboardLayout>
  );
}
