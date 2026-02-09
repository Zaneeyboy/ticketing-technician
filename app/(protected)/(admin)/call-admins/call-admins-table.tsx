'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { ViewCallAdminModal } from './view-call-admin-modal';

interface CallAdminSummary {
  uid: string;
  name: string;
  email: string;
  createdCount: number;
  activeCount: number;
  closedCount: number;
  createdAt: Date;
}

interface CallAdminsTableProps {
  callAdmins: CallAdminSummary[];
}

export function CallAdminsTable({ callAdmins }: CallAdminsTableProps) {
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedCallAdmin, setSelectedCallAdmin] = useState<CallAdminSummary | null>(null);

  const handleViewCallAdmin = (callAdmin: CallAdminSummary) => {
    setSelectedCallAdmin(callAdmin);
    setViewModalOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Call Administrators</CardTitle>
          <CardDescription>Detailed view of each call administrator's ticket activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='w-full overflow-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b bg-muted/50'>
                  <th className='h-12 px-4 text-left align-middle font-medium'>Name</th>
                  <th className='h-12 px-4 text-left align-middle font-medium'>Email</th>
                  <th className='h-12 px-4 text-right align-middle font-medium'>Created</th>
                  <th className='h-12 px-4 text-right align-middle font-medium'>Active</th>
                  <th className='h-12 px-4 text-right align-middle font-medium'>Closed</th>
                  <th className='h-12 px-4 text-right align-middle font-medium'>Actions</th>
                </tr>
              </thead>
              <tbody>
                {callAdmins.length === 0 ? (
                  <tr>
                    <td colSpan={6} className='h-12 px-4 text-center text-muted-foreground'>
                      No call administrators found
                    </td>
                  </tr>
                ) : (
                  callAdmins.map((callAdmin, index) => (
                    <tr key={callAdmin.uid} className='border-b hover:bg-muted/50 transition-colors animate-scale-in' style={{ animationDelay: `${240 + index * 60}ms` }}>
                      <td className='h-12 px-4 align-middle font-medium'>{callAdmin.name}</td>
                      <td className='h-12 px-4 align-middle text-muted-foreground'>{callAdmin.email}</td>
                      <td className='h-12 px-4 align-middle text-right'>
                        <Badge variant='secondary'>{callAdmin.createdCount}</Badge>
                      </td>
                      <td className='h-12 px-4 align-middle text-right'>
                        <Badge variant='outline'>{callAdmin.activeCount}</Badge>
                      </td>
                      <td className='h-12 px-4 align-middle text-right'>
                        <Badge variant='default'>{callAdmin.closedCount}</Badge>
                      </td>
                      <td className='h-12 px-4 align-middle text-right'>
                        <Button variant='ghost' size='sm' onClick={() => handleViewCallAdmin(callAdmin)}>
                          <Eye className='h-4 w-4 mr-1' />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selectedCallAdmin && <ViewCallAdminModal open={viewModalOpen} onOpenChange={setViewModalOpen} callAdminId={selectedCallAdmin.uid} callAdminName={selectedCallAdmin.name} />}
    </>
  );
}
