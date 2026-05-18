import { listUsersAction } from '@/lib/actions/users';
import { listInvitationsAction } from '@/lib/actions/invitations';
import { listStores } from '@/lib/actions/stores';
import { getCurrentUser } from '@/lib/auth/session';
import HQUsersTable from './users-table';

export default async function HQUsersPage() {
  const [currentUser, usersResult, invResult, storesResult] = await Promise.all([getCurrentUser(), listUsersAction(), listInvitationsAction(), listStores()]);

  const users = usersResult.success ? usersResult.users : [];
  const pendingInvitations = invResult.success ? invResult.invitations.filter((i) => i.status === 'pending') : [];
  const stores = storesResult.success ? storesResult.stores : [];

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <p className='text-sm text-muted-foreground'>
          {users.length} user{users.length !== 1 ? 's' : ''} across the platform
        </p>
      </div>
      <HQUsersTable users={users} currentUserId={currentUser?.uid ?? ''} currentUserRole={currentUser?.role ?? 'manager'} pendingInvitations={pendingInvitations} stores={stores} />
    </div>
  );
}
