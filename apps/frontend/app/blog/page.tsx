import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { getBlogPosts } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const { posts } = await getBlogPosts({ limit: 20 });

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Inspiration</p>
        <h1 className="mt-3 font-serif text-5xl text-primary">Style Blog</h1>
        <p className="mt-3 text-base text-text/60 max-w-xl">
          Celebrity fashion stories, styling tips, and behind-the-scenes looks.
        </p>

        {posts.length === 0 && (
          <div className="mt-16 text-center text-text/40">
            <p className="text-3xl mb-3">✍️</p>
            <p className="text-sm">No posts yet. Check back soon.</p>
          </div>
        )}

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="group">
              <article className="rounded-[20px] border border-black/6 bg-white overflow-hidden shadow-sm hover:shadow-md transition h-full flex flex-col">
                {post.coverImage && (
                  <div className="relative aspect-video overflow-hidden bg-black/5">
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition duration-500"
                      onError={() => {}}
                    />
                  </div>
                )}
                <div className="flex flex-col flex-1 p-5">
                  {post.tags.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {post.tags.slice(0, 3).map((t) => (
                        <span key={t} className="text-xs text-accent">#{t}</span>
                      ))}
                    </div>
                  )}
                  <h2 className="font-serif text-xl text-primary group-hover:text-accent transition line-clamp-2">
                    {post.title}
                  </h2>
                  <p className="mt-2 text-sm text-text/60 flex-1 line-clamp-3">{post.summary}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-text/40">
                    <span>by {post.authorName}</span>
                    <span>
                      {new Date(post.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
