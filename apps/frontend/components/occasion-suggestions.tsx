import Link from "next/link";

type Occasion = {
  name: string;
  label: string;
  description: string;
  searchQuery: string;
  months: number[];
};

const OCCASIONS: Occasion[] = [
  {
    name: "Wedding Season",
    label: "Bridal & Sherwani",
    description: "It's wedding season — discover bridal and groom-inspired looks",
    searchQuery: "wedding",
    months: [11, 12, 1, 2],
  },
  {
    name: "Diwali",
    label: "Festive Ethnic",
    description: "Celebrate Diwali with traditional kurtas, lehengas, and sherwanis",
    searchQuery: "festive",
    months: [10, 11],
  },
  {
    name: "Summer",
    label: "Light & Breezy",
    description: "Beat the heat with light fabrics and relaxed silhouettes",
    searchQuery: "casual",
    months: [4, 5, 6],
  },
  {
    name: "Navratri",
    label: "Garba & Dance",
    description: "Colourful chaniya cholis and traditional dandiya attire",
    searchQuery: "ethnic",
    months: [9, 10],
  },
  {
    name: "Awards Season",
    label: "Red Carpet Glam",
    description: "Channel your inner celebrity at gala events and film awards",
    searchQuery: "gala",
    months: [1, 2, 3],
  },
  {
    name: "Monsoon",
    label: "Earthy Tones",
    description: "Embrace the season with rich earthy tones and layered looks",
    searchQuery: "casual",
    months: [7, 8, 9],
  },
  {
    name: "Republic Day",
    label: "Patriotic & Formal",
    description: "Formal ethnic wear for national celebrations and events",
    searchQuery: "formal",
    months: [1],
  },
  {
    name: "New Year",
    label: "Party Glam",
    description: "Ring in the new year with glamorous evening wear",
    searchQuery: "party",
    months: [12, 1],
  },
];

function getCurrentOccasions(month: number): Occasion[] {
  const current = OCCASIONS.filter((o) => o.months.includes(month));
  if (current.length > 0) return current.slice(0, 3);
  // Fallback: upcoming occasions (next 2 months)
  const next1 = month === 12 ? 1 : month + 1;
  const next2 = next1 === 12 ? 1 : next1 + 1;
  return OCCASIONS.filter((o) => o.months.includes(next1) || o.months.includes(next2)).slice(0, 3);
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function OccasionSuggestions() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const monthName = MONTH_NAMES[now.getMonth()];
  const occasions = getCurrentOccasions(month);

  if (occasions.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.36em] text-accent">Right Now · {monthName}</p>
          <h2 className="mt-3 font-serif text-4xl text-primary">Dress for the occasion</h2>
          <p className="mt-2 text-sm text-text/60">Trending styles matched to what&apos;s happening this season</p>
        </div>
      </div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {occasions.map((occasion) => (
          <Link
            key={occasion.name}
            href={`/search?occasion=${encodeURIComponent(occasion.searchQuery)}`}
            className="group flex flex-col rounded-[24px] border border-black/6 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-luxe"
          >
            <p className="text-xs uppercase tracking-[0.28em] text-accent">{occasion.label}</p>
            <p className="mt-2 font-serif text-2xl text-primary group-hover:text-accent transition">{occasion.name}</p>
            <p className="mt-2 text-sm text-text/60 flex-1">{occasion.description}</p>
            <p className="mt-4 text-xs font-medium text-accent group-hover:underline underline-offset-4">
              Shop this occasion →
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
