export default function CelebrityLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 animate-pulse">
      <div className="h-64 rounded-[28px] bg-black/8 mb-8" />
      <div className="space-y-3 mb-10">
        <div className="h-6 w-48 rounded-full bg-black/8" />
        <div className="h-12 w-80 rounded-full bg-black/8" />
        <div className="h-4 w-96 rounded-full bg-black/5" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="aspect-[3/4] rounded-[24px] bg-black/8" />
        ))}
      </div>
    </div>
  );
}
