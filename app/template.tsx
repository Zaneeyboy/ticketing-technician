// app/template.tsx — re-renders on every navigation, perfect for page transitions
// Unlike layout.tsx which persists, template.tsx unmounts/remounts on route change

export default function Template({ children }: { children: React.ReactNode }) {
  return <div className='animate-page-enter'>{children}</div>;
}
