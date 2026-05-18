import { redirect } from 'next/navigation';

// This page is superseded by the Create Ticket modal on /tickets.
// Redirect to avoid dead-end if someone navigates here directly.
export default function NewTicketPage() {
  redirect('/tickets');
}
