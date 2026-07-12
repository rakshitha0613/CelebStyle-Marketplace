export default function StorefrontLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 animate-pulse">
      <div className="h-3 w-32 rounded-full bg-black/8 mb-6" />
      <div className="aspect-[21/8] rounded-[32px] bg-black/8 mb-6" />
      <div className="space-y-3 mb-10">
        <div className="h-3 w-40 rounded-full bg-black/5" />
        <div className="h-10 w-80 rounded-xl bg-black/8" />
        <div className="h-4 w-full rounded-full bg-black/5" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="aspect-[3/4] rounded-[24px] bg-black/8" />
        ))}
      </div>
    </div>
  );
}
