export default function BlogPostLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 animate-pulse">
      <div className="h-3 w-32 rounded-full bg-black/8 mb-8" />
      <div className="aspect-video rounded-[20px] bg-black/8 mb-8" />
      <div className="flex gap-2 mb-4">
        <div className="h-3 w-16 rounded-full bg-black/5" />
        <div className="h-3 w-12 rounded-full bg-black/5" />
      </div>
      <div className="h-12 w-full rounded-xl bg-black/8 mb-4" />
      <div className="flex gap-3 mb-8">
        <div className="h-3 w-24 rounded-full bg-black/5" />
        <div className="h-3 w-32 rounded-full bg-black/5" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-4 rounded-full bg-black/5" style={{ width: `${60 + (i % 4) * 10}%` }} />
        ))}
      </div>
    </div>
  );
}
