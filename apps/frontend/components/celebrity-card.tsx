import Link from "next/link";
import type { Celebrity } from "@/lib/api";

type CelebrityCardProps = {
  celebrity: Celebrity;
};

export function CelebrityCard({ celebrity }: CelebrityCardProps) {
  return (
    <Link href={`/celebrities/${celebrity.id}`} className="group overflow-hidden rounded-[28px] bg-white shadow-luxe transition duration-300 hover:-translate-y-1">
      <div className="relative aspect-[4/5] overflow-hidden bg-primary">
        <img
          src={celebrity.profileImage}
          alt={celebrity.name}
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/72 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.18),transparent_42%)]" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-background">
          <p className="text-xs uppercase tracking-[0.32em] text-gold">{celebrity.industry}</p>
          <h3 className="mt-2 font-serif text-2xl">{celebrity.name}</h3>
          <p className="mt-2 text-sm leading-6 text-background/78">{celebrity.bio}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {celebrity.styleTags.map((tag) => (
              <span key={tag} className="rounded-full border border-background/18 bg-background/10 px-3 py-1 text-xs backdrop-blur">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}