import { Metadata } from 'next';
import DashboardLayout from '@/components/dashboard-layout';
import { requireRole } from '@/lib/auth/role-guard';
import { getCustomers } from '@/lib/actions/customers';
import { CustomersTable } from './customers-table';
import { PageHeader } from '@/components/page-header';
import { Building2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Customers',
  description: 'Manage customers',
};

export default async function CustomersPage() {
  await requireRole(['store_admin', 'store_manager', 'call_admin']);

  const customers = await getCustomers();

  return (
    <DashboardLayout>
      <div className='space-y-6'>
        <PageHeader title='Customers' description='Manage customer accounts and contact information' icon={Building2} />
        <CustomersTable initialData={customers} />
      </div>
    </DashboardLayout>
  );
}
