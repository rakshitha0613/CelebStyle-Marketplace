export default function OutfitLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] animate-pulse">
        <div className="space-y-4">
          <div className="h-4 w-24 rounded-full bg-black/8" />
          <div className="aspect-[4/5] rounded-[32px] bg-black/8" />
          <div className="flex gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 w-16 shrink-0 rounded-[12px] bg-black/8" />
            ))}
          </div>
          <div className="h-48 rounded-[24px] bg-black/8" />
        </div>
        <div className="space-y-4">
          <div className="h-14 rounded-full bg-black/8" />
          <div className="h-10 rounded-full bg-black/5" />
          <div className="h-10 rounded-full bg-black/5" />
          <div className="h-40 rounded-[24px] bg-black/8" />
          <div className="h-32 rounded-[24px] bg-black/5" />
        </div>
      </div>
    </div>
  );
}
