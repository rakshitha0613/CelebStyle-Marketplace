import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { getBlogPost, getOutfits } from "@/lib/api";
import { BlogShareButton } from "./share-button";

export const dynamic = "force-dynamic";

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  const relatedOutfits =
    post.outfitIds.length > 0
      ? (await getOutfits()).filter((o) => post.outfitIds.includes(o.id)).slice(0, 4)
      : [];

  const wordCount = post.body?.split(/\s+/).length ?? 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

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

        {/* Category */}
        {post.category && (
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.28em] text-primary/60">
            {post.category}
          </p>
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
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-text/50">
          <span>by {post.authorName}</span>
          <span>·</span>
          <span>
            {new Date(post.createdAt).toLocaleDateString("en-IN", {
              day: "numeric", month: "long", year: "numeric",
            })}
          </span>
          <span>·</span>
          <span>{readingTime} min read</span>
          <span>·</span>
          <span>{post.views} views</span>
          <div className="ml-auto">
            <BlogShareButton title={post.title} slug={post.slug} />
          </div>
        </div>

        {/* Body — inline images come from either an explicit [[img:url]] marker
            line in the body text (how admin/seeded posts embed them, since
            BlogPost has no images column) or, as a fallback, post.images
            dropped in at roughly the 1/3 and 2/3 marks of the article. */}
        <div className="mt-8 prose prose-neutral max-w-none text-text/90 leading-relaxed">
          {(() => {
            const INLINE_IMAGE = /^\[\[img:(.+)\]\]$/;
            const paragraphs = post.body.split("\n");
            const hasInlineMarkers = paragraphs.some((p) => INLINE_IMAGE.test(p.trim()));

            const imageSlots = new Map<number, string>();
            if (!hasInlineMarkers) {
              const textParaIndexes = paragraphs
                .map((p, i) => (p.trim() ? i : -1))
                .filter((i) => i !== -1);
              post.images.slice(0, 2).forEach((url, imgIdx) => {
                const targetPos = Math.floor(
                  textParaIndexes.length * ((imgIdx + 1) / (post.images.length + 1))
                );
                const paraIndex = textParaIndexes[Math.min(targetPos, textParaIndexes.length - 1)];
                if (paraIndex !== undefined) imageSlots.set(paraIndex, url);
              });
            }

            const renderImage = (url: string, key: string) => (
              <span key={key} className="my-6 block overflow-hidden rounded-[16px] bg-black/5 not-prose">
                <img src={url} alt={`${post.title} — inline`} className="h-full w-full object-cover" />
              </span>
            );

            return paragraphs.map((para, i) => {
              const marker = INLINE_IMAGE.exec(para.trim());
              if (marker) return renderImage(marker[1], `img-${i}`);
              return (
                <React.Fragment key={i}>
                  {para.trim() ? <p>{para}</p> : <br />}
                  {imageSlots.has(i) && renderImage(imageSlots.get(i)!, `img-slot-${i}`)}
                </React.Fragment>
              );
            });
          })()}
        </div>

        {/* Share CTA */}
        <div className="mt-10 flex items-center justify-between rounded-[16px] border border-black/6 bg-secondary/30 p-5">
          <div>
            <p className="text-sm font-medium text-primary">Enjoyed this article?</p>
            <p className="text-xs text-text/50">Share it with fellow fashion lovers</p>
          </div>
          <BlogShareButton title={post.title} slug={post.slug} />
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
                      src={outfit.imageUrl || undefined}
                      alt={outfit.category}
                      className="h-full w-full object-cover group-hover:scale-105 transition duration-500"
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
        <div className="mt-12 border-t border-black/6 pt-8 flex items-center justify-between">
          <Link href="/blog" className="text-sm text-accent hover:underline">
            ← Back to Blog
          </Link>
          <Link href="/search" className="text-sm text-accent hover:underline">
            Browse outfits →
          </Link>
        </div>
      </article>
    </main>
  );
}
