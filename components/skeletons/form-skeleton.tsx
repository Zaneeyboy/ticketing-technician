import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface FormSkeletonProps {
  fields?: number;
  sections?: number;
}

export function FormSkeleton({ fields = 6, sections = 1 }: FormSkeletonProps) {
  return (
    <div className='space-y-6'>
      {Array.from({ length: sections }).map((_, sectionIndex) => (
        <Card key={sectionIndex}>
          <CardHeader>
            <Skeleton className='h-6 w-48' />
            <Skeleton className='h-4 w-72' />
          </CardHeader>
          <CardContent className='space-y-4'>
            {Array.from({ length: fields }).map((_, fieldIndex) => (
              <div key={fieldIndex} className='space-y-2'>
                <Skeleton className='h-4 w-32' />
                <Skeleton className='h-10 w-full' />
              </div>
            ))}
            <div className='flex gap-2 justify-end pt-4'>
              <Skeleton className='h-10 w-24' />
              <Skeleton className='h-10 w-24' />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
