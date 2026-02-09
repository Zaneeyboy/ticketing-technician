import { Metadata } from 'next';
import DashboardLayout from '@/components/dashboard-layout';
import { requireRole } from '@/lib/auth/role-guard';
import { getCustomers } from '@/lib/actions/customers';
import { CustomersTable } from './customers-table';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Customers',
  description: 'Manage customers',
};

export default async function CustomersPage() {
  await requireRole(['admin', 'call_admin', 'management']);

  const customers = await getCustomers();

  return (
    <DashboardLayout>
      <div className='space-y-6'>
        <div>
          <p className='text-slate-600 dark:text-slate-400'>Manage customer information</p>
        </div>

        <CustomersTable initialData={customers} />
      </div>
    </DashboardLayout>
  );
}
