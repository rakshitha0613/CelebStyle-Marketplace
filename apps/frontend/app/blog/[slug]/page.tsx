import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { getBlogPost, getOutfits } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  const relatedOutfits =
    post.outfitIds.length > 0
      ? (await getOutfits()).filter((o) => post.outfitIds.includes(o.id)).slice(0, 4)
      : [];

  return (
    <main>
      <Navbar />
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-text/40 mb-8">
          <Link href="/blog" className="hover:text-accent transition">Blog</Link>
          <span>/</span>
          <span className="text-text/60 truncate">{post.title}</span>
        </nav>

        {/* Cover */}
        {post.coverImage && (
          <div className="relative aspect-video rounded-[20px] overflow-hidden bg-black/5 mb-8">
            <img
              src={post.coverImage}
              alt={post.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {post.tags.map((t) => (
              <span key={t} className="text-xs text-accent">#{t}</span>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 className="font-serif text-4xl sm:text-5xl text-primary leading-tight">{post.title}</h1>

        {/* Meta */}
        <div className="mt-4 flex items-center gap-4 text-sm text-text/50">
          <span>by {post.authorName}</span>
          <span>·</span>
          <span>
            {new Date(post.createdAt).toLocaleDateString("en-IN", {
              day: "numeric", month: "long", year: "numeric",
            })}
          </span>
          <span>·</span>
          <span>{post.views} views</span>
        </div>

        {/* Body */}
        <div className="mt-8 prose prose-neutral max-w-none text-text/90 leading-relaxed">
          {post.body.split("\n").map((para, i) =>
            para.trim() ? <p key={i}>{para}</p> : <br key={i} />
          )}
        </div>

        {/* Related outfits */}
        {relatedOutfits.length > 0 && (
          <section className="mt-12">
            <h2 className="font-serif text-2xl text-primary mb-6">Shop the Look</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {relatedOutfits.map((outfit) => (
                <Link
                  key={outfit.id}
                  href={`/outfits/${outfit.id}`}
                  className="group rounded-[16px] border border-black/6 bg-white overflow-hidden shadow-sm hover:shadow-md transition"
                >
                  <div className="aspect-[3/4] bg-black/5 overflow-hidden">
                    <img
                      src={outfit.imageUrl}
                      alt={outfit.category}
                      className="h-full w-full object-cover group-hover:scale-105 transition duration-500"
                      onError={() => {}}
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-medium text-primary line-clamp-1">{outfit.category}</p>
                    <p className="text-xs text-text/50">{outfit.celebrityName}</p>
                    <p className="mt-1 text-sm font-semibold text-primary">
                      ₹{outfit.price.toLocaleString("en-IN")}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Back link */}
        <div className="mt-12 border-t border-black/6 pt-8">
          <Link href="/blog" className="text-sm text-accent hover:underline">
            ← Back to Blog
          </Link>
        </div>
      </article>
    </main>
  );
}
