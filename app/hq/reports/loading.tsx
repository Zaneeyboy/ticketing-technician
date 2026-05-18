import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function TableCardSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-6 w-40' />
      </CardHeader>
      <CardContent className='p-0'>
        <div className='flex items-center border-b bg-muted/50 h-11 px-4 gap-6'>
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className='h-3 flex-1' />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className='flex items-center border-b last:border-0 h-12 px-4 gap-6'>
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton key={j} className='h-4 flex-1' />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function HQReportsLoading() {
  return (
    <div className='space-y-6'>
      <TableCardSkeleton rows={5} cols={5} />
      <TableCardSkeleton rows={6} cols={3} />
    </div>
  );
}
