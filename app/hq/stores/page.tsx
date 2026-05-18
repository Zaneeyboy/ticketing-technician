import { listStores } from '@/lib/actions/stores';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';

export default async function HQStoresPage() {
  const result = await listStores();
  const stores = result.success ? result.stores : [];

  return (
    <div>
      <div className='flex items-center justify-between mb-6'>
        <p className='text-muted-foreground text-sm'>
          {stores.length} store{stores.length !== 1 ? 's' : ''} registered
        </p>
        <Link href='/hq/stores/new'>
          <Button className='rounded-full gap-2'>
            <PlusCircle className='h-4 w-4' />
            Add Store
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Island</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {stores.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className='text-center text-muted-foreground py-8'>
                    No stores registered yet.
                  </TableCell>
                </TableRow>
              )}
              {stores.map((store) => (
                <TableRow key={store.id}>
                  <TableCell className='font-medium'>{store.name}</TableCell>
                  <TableCell>{store.island || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={store.status === 'active' ? 'default' : store.status === 'onboarding' ? 'outline' : 'secondary'} className='capitalize'>
                      {store.status}
                    </Badge>
                  </TableCell>
                  <TableCell className='text-muted-foreground text-sm'>{store.contactEmail || '—'}</TableCell>
                  <TableCell className='text-right'>
                    <Link href={`/hq/stores/${store.id}`}>
                      <Button variant='ghost' size='sm'>
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
