'use client';

import { useState } from 'react';
import { CelebrityCard } from './celebrity-card';

type Celebrity = {
  id: string;
  name: string;
  industry: string;
  bio: string;
  profileImage: string;
  bannerImage: string;
  styleTags: string[];
};

type IndustryFilterProps = {
  celebrities: Celebrity[];
  industries: string[];
};

export function IndustryFilter({ celebrities, industries }: IndustryFilterProps) {
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);

  const filteredCelebrities = selectedIndustry
    ? celebrities.filter((c) => c.industry === selectedIndustry)
    : celebrities;

  const byIndustry = industries.map((ind) => ({
    industry: ind,
    count: celebrities.filter((c) => c.industry === ind).length
  }));

  return (
    <div>
      {/* Industry Tabs */}
      <div className="mb-10 flex flex-wrap gap-3">
        <button
          onClick={() => setSelectedIndustry(null)}
          className={`rounded-full px-5 py-2.5 text-xs font-medium uppercase tracking-[0.28em] transition-all ${
            selectedIndustry === null
              ? 'bg-accent text-white'
              : 'bg-secondary text-primary hover:bg-accent/10'
          }`}
        >
          All Industries
          <span className="ml-2 text-xs opacity-70">({celebrities.length})</span>
        </button>
        {byIndustry.map(({ industry, count }) => (
          <button
            key={industry}
            onClick={() => setSelectedIndustry(industry)}
            className={`rounded-full px-5 py-2.5 text-xs font-medium uppercase tracking-[0.28em] transition-all ${
              selectedIndustry === industry
                ? 'bg-accent text-white'
                : 'bg-secondary text-primary hover:bg-accent/10'
            }`}
          >
            {industry}
            <span className="ml-2 text-xs opacity-70">({count})</span>
          </button>
        ))}
      </div>

      {/* Celebrity Grid */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredCelebrities.map((celebrity) => (
          <CelebrityCard key={celebrity.id} celebrity={celebrity} />
        ))}
      </div>
    </div>
  );
}
