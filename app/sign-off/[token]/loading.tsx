export default function SignOffLoading() {
  return (
    <div className='min-h-screen bg-slate-50 flex items-center justify-center'>
      <div className='flex flex-col items-center gap-3'>
        <div className='h-10 w-10 rounded-full border-4 border-blue-500 border-t-transparent animate-spin' />
        <p className='text-slate-500 text-sm'>Loading service report…</p>
      </div>
    </div>
  );
}
