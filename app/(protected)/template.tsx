// app/(protected)/template.tsx — page transition for all protected (authenticated) pages
// Slightly faster animation inside the app shell to feel snappier

export default function ProtectedTemplate({ children }: { children: React.ReactNode }) {
  return <div className='animate-page-enter-fast'>{children}</div>;
}
