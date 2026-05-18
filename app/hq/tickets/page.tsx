import { getAllTickets, listStores } from '@/lib/actions/stores';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default async function HQTicketsPage() {
  const [ticketsResult, storesResult] = await Promise.all([getAllTickets(), listStores()]);

  const tickets = ticketsResult.success ? ticketsResult.tickets : [];
  const stores = storesResult.success ? storesResult.stores : [];

  const statusColor = (status: string) => {
    if (status === 'Open') return 'outline';
    if (status === 'Assigned') return 'default';
    return 'secondary';
  };

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <p className='text-sm text-muted-foreground'>
          {tickets.length} tickets across {stores.length} store{stores.length !== 1 ? 's' : ''}
        </p>
      </div>

      <Card>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket #</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className='text-center py-8 text-muted-foreground'>
                    No tickets found across any stores.
                  </TableCell>
                </TableRow>
              )}
              {tickets.map((ticket: any) => (
                <TableRow key={`${ticket.storeId}-${ticket.id}`}>
                  <TableCell className='font-mono text-sm'>{ticket.ticketNumber || ticket.id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <span className='text-xs bg-muted px-2 py-0.5 rounded'>{ticket.storeName}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColor(ticket.status) as any}>{ticket.status}</Badge>
                  </TableCell>
                  <TableCell className='text-sm'>{ticket.machines?.[0]?.customerName || '—'}</TableCell>
                  <TableCell className='text-sm text-muted-foreground'>{ticket.assignedToName || 'Unassigned'}</TableCell>
                  <TableCell className='text-sm text-muted-foreground'>{ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
