/**
 * Admin demo seed — populates realistic data for the admin panel.
 * Idempotent: uses upsert/skipDuplicates where possible.
 */

import { PrismaClient, type ReturnReason, type ReturnStatus } from "@prisma/client";
import { hashPassword } from "../auth/password.service.js";
import { DEMO_COMMUNITY_POSTS } from "./demo-content.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rndInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  "Aarav","Aditya","Akshay","Ananya","Anjali","Arjun","Aryan","Divya",
  "Ishaan","Kavya","Kiran","Meera","Mihir","Nisha","Pooja","Priya",
  "Rahul","Raj","Riya","Rohan","Saanvi","Sahil","Shreya","Siddharth",
  "Simran","Sneha","Sonal","Suresh","Tanvi","Tanya","Varun","Vihaan",
  "Yash","Zara","Neha","Ritika","Aman","Deepa","Gaurav","Hema",
] as const;

const LAST_NAMES = [
  "Sharma","Verma","Singh","Kumar","Patel","Gupta","Mehta","Joshi",
  "Reddy","Nair","Pillai","Iyer","Rao","Shah","Kapoor","Chopra",
  "Malik","Bhat","Das","Desai","Khanna","Tiwari","Mishra","Pandey",
] as const;

const CITIES = [
  "Mumbai","Delhi","Bengaluru","Chennai","Hyderabad","Kolkata",
  "Pune","Ahmedabad","Jaipur","Surat","Lucknow","Kanpur",
] as const;

const STATES = [
  "Maharashtra","Delhi","Karnataka","Tamil Nadu","Telangana","West Bengal",
  "Maharashtra","Gujarat","Rajasthan","Gujarat","Uttar Pradesh","Uttar Pradesh",
] as const;

const PHONES = [
  "9876543210","9123456789","8765432109","7654321098","9988776655",
  "8877665544","7766554433","9900112233","8811223344","7722334455",
] as const;

const STREET_NAMES = [
  "MG Road","Park Street","Anna Salai","Banjara Hills","Marine Drive",
  "Connaught Place","Linking Road","FC Road","Brigade Road","Necklace Road",
] as const;

const ORDER_STATUSES = [
  "DELIVERED","DELIVERED","DELIVERED","DELIVERED","DELIVERED","DELIVERED",
  "SHIPPED","SHIPPED","CONFIRMED","PLACED","CANCELLED","REFUNDED",
] as const;

const PAYMENT_METHODS = [
  "UPI","UPI","UPI","CARD","CARD","NET_BANKING","WALLET","COD","EMI",
] as const;

const RETURN_REASONS: ReturnReason[] = [
  "QUALITY_ISSUE","WRONG_ITEM","SIZE_ISSUE",
  "NOT_AS_DESCRIBED","CHANGED_MIND","DAMAGED",
];

const RETURN_STATUSES: ReturnStatus[] = [
  "REQUESTED","REQUESTED","APPROVED","RECEIVED","REFUND_INITIATED","REFUND_COMPLETED","REJECTED",
];

const REVIEW_BODIES = [
  "Absolutely stunning quality — exceeded my expectations! The fabric feels premium and the fit is perfect.",
  "The outfit looks exactly like the celebrity wore it. Great attention to detail.",
  "Fast delivery and excellent packaging. The outfit is a head-turner at events.",
  "Good quality for the price. Stitching is neat and the colour is vibrant.",
  "I wore this to a wedding and received so many compliments. Highly recommended!",
  "Decent quality but slightly different shade than in the photos. Overall happy.",
  "The embroidery is beautiful and the material is comfortable even for long hours.",
  "Perfect replica of the original outfit. Worth every rupee!",
  "Sizing runs a bit small. Order one size up, but the outfit itself is gorgeous.",
  "Quick dispatch and excellent quality control. The seller packs everything carefully.",
  "Loved the outfit! It gave me the celebrity look I always wanted.",
  "Material is silk-like and very comfortable. The blouse fitting was perfect.",
] as const;

const REVIEW_TITLES = [
  "Amazing quality!", "Celebrity look for less!", "Worth every rupee",
  "Loved it!", "Great purchase", "Just as pictured", "Highly recommend",
  "Good quality", "Perfect fit", "Superb craftsmanship",
] as const;

const BLOG_POSTS = [
  {
    slug: "demo-blog-deepika-cannes-look-2024",
    title: "Deepika Padukone's Cannes 2024 Look — Get the Full Outfit",
    summary: "Deepika turned heads at Cannes 2024 in a stunning ivory gown. Here's how you can recreate the iconic look.",
    category: "Global Fashion",
    celebrityId: "deepika-padukone",
    productIds: ["look-festive-reception-gown", "look-deepika-padukone-wedding"],
    body: `Deepika Padukone is no stranger to Cannes, but her 2024 appearance left the fashion world speechless. Dressed in a custom embellished ivory gown with dramatic sleeves, she embodied classic Old Hollywood glamour while still carrying an unmistakably Indian sensibility in the detailing.

[[img:/assets/celebrities/deepika-padukone/banner.webp]]

The look featured intricate hand-beaded detailing across the bodice and a flowing silk train that moved beautifully as she climbed the famous red-carpeted steps. Unlike a lot of red-carpet gowns that photograph well only from the front, this one was designed with the train and back silhouette in mind — a detail that stylists noted made it one of the most complete looks of the entire festival.

**Building Up to the Moment**
Deepika's Cannes wardrobe this year wasn't a single outfit but a full week of considered looks — press-day separates, an off-duty airport look, and the headline gown itself. Each piece built anticipation for the next, a strategy borrowed from how Hollywood stars approach award season, and one that Indian stars attending international festivals are increasingly adopting.

**The Craft Behind the Gown**
What made this particular gown stand out wasn't just the silhouette but the handwork. The beading alone reportedly took several hundred hours to complete, with artisans working in sections that were later assembled onto the final structure. It's a level of craft that rarely gets discussed in red-carpet coverage, which tends to focus on the finished look rather than the process behind it.

**Why This Look Resonated in India**
Indian audiences responded to this look differently than international outlets did — less about "best dressed" rankings and more about pride in seeing homegrown craftsmanship represented on one of fashion's biggest global stages. It reinforced a narrative that's been building for years: Indian couture doesn't need to imitate Western silhouettes to compete internationally, it just needs the right platform.

**Recreating the Look**
At CelebStyle, we've worked with our partner manufacturers to recreate key elements of this look at accessible prices — the ivory colourway, the dramatic sleeve structure, and a simplified version of the beaded bodice detail. It won't replicate several hundred hours of hand embroidery, but it captures the silhouette and mood closely enough for anyone wanting their own red-carpet moment.

[[img:/assets/outfits/look-festive-reception-gown/hero.png]]

**Styling It for Real Life**
Full-length ivory gowns aren't exactly everyday wear, but the styling principles translate well to reception and cocktail dressing — a dramatic sleeve, a clean bodice, and minimal jewellery that lets the garment's construction do the talking rather than competing with heavy embellishment.

**A Blueprint for the Next Generation**
Younger Indian actresses navigating their own global ambitions increasingly cite Deepika's approach as the template to follow — not simply wearing international labels, but insisting that Indian craft travel with them wherever they go. That balance of ambition and rootedness is arguably her most lasting contribution to how Indian fashion is perceived on the world stage, and it's a big part of why this particular Cannes look is still being referenced and recreated months after the festival ended.

**What to Look for When Recreating It Yourself**
If you're chasing this look for your own red-carpet moment, focus on three things in this order: silhouette first, since an ivory column gown only works if the fit through the waist and hip is precise; sleeve structure second, since the dramatic sleeve is what makes the look instantly recognisable; and embellishment last, since even a simplified beading pattern along the neckline can evoke the original without the cost of full hand-embroidery.

Browse our Cannes-inspired collection on CelebStyle, complete with virtual try-on so you can preview the drape before you order.`,
    coverImage: "/assets/blog/banner-2.png",
    tags: ["Global Fashion", "cannes", "deepika", "redcarpet", "international"],
    daysBack: 15,
  },
  {
    slug: "demo-blog-virat-ipl-fashion-2024",
    title: "Virat Kohli's IPL Fashion: Off-Pitch Style Guide",
    summary: "When not on the pitch, Virat Kohli is always making fashion statements. We break down his best IPL season looks.",
    category: "Sports Style",
    celebrityId: null,
    productIds: ["look-luxury-indo-western", "look-ranveer-singh-gully-boy"],
    body: `IPL is not just about cricket — it's also India's biggest fashion event outside of Bollywood, and Virat Kohli consistently shows up in outfits that land on everyone's style radar within hours of the match ending.

[[img:/assets/banners/luxury-banner.webp]]

**From Kit to Casual**
The transition from match kit to off-pitch dressing is its own art form for cricketers, and Kohli has quietly become one of the sport's most consistent style performers. Where many athletes default to tracksuits and branded merchandise for travel days, Kohli treats the airport-to-hotel-to-post-match-interview circuit as a genuine styling opportunity.

**Tailored Blazers Over Graphic Tees**
One of Kohli's most copied combinations is the tailored blazer worn over a simple graphic or plain tee — a pairing that reads as put-together without feeling overly formal for a sportsman's schedule. It's a silhouette that has since trickled down into general menswear, particularly among younger professionals looking for something between a full suit and casualwear.

**Sleek Athleisure, Elevated**
Kohli's athleisure choices avoid the common trap of looking like gym wear repurposed for public appearances. Structured joggers, minimal-branding sneakers, and well-fitted bomber jackets in muted tones give his off-pitch looks a considered, adult quality that stands apart from the louder, logo-heavy athleisure many athletes default to.

**The Anushka Effect**
Kohli's personal style has also visibly evolved alongside his marriage to Anushka Sharma, herself a genuine fashion voice in Bollywood. Their joint appearances — at award shows, friends' weddings, and public events — show a coordinated but not matchy-matchy approach to dressing as a couple, which has become something of a style reference point for young Indian couples navigating similar events.

**Grooming as Part of the Look**
It's worth noting that Kohli's fashion evolution has run parallel to a broader change in how Indian audiences perceive male grooming. His well-maintained beard, considered haircuts, and general polish have normalised a level of grooming attentiveness among Indian men that wasn't as visible in mainstream sports culture even a decade ago.

[[img:/assets/outfits/look-luxury-indo-western/hero.png]]

**Bringing It Into Your Wardrobe**
The easiest takeaway from Kohli's off-pitch style is the blazer-over-tee formula — it works for everything from a casual dinner to a semi-formal event and requires far less investment than building out a full formalwear wardrobe.

**Why Cricket-Adjacent Fashion Matters in India**
IPL's unique position as both a sporting event and a nightly entertainment spectacle means its fashion moments reach an audience that traditional red carpets never touch — families watching together, casual fans who don't follow Bollywood closely, and a huge cross-section of small-town India tuning in every evening during the season. That reach gives cricketer style a genuinely different kind of cultural weight than film-star fashion, even when the outfits themselves are less elaborate.

**Other Players Raising Their Game**
Kohli isn't alone — a wider crop of IPL players have visibly upped their off-pitch dressing in recent seasons, turning post-match press conferences and team-bus arrivals into their own mini style moments. It's created a healthy competitive dynamic within dressing rooms that didn't really exist a decade ago, when most cricketers treated fashion as an afterthought rather than part of their public brand.

Explore our collection inspired by Kohli's IPL season looks, all ready for virtual try-on.`,
    coverImage: "/assets/blog/banner-1.png",
    tags: ["Sports Style", "virat", "cricket", "ipl", "mensfashion"],
    daysBack: 22,
  },
  {
    slug: "demo-blog-alia-bhatt-maternity-style",
    title: "Alia Bhatt's Maternity Style — Elegance Redefined",
    summary: "Alia Bhatt proved that maternity fashion can be just as glamorous with her stunning pregnancy looks.",
    category: "Bollywood Style",
    celebrityId: "alia-bhatt",
    productIds: ["look-alia-bhatt-gangubai", "look-festive-holi-anarkali"],
    body: `Alia Bhatt's pregnancy was a style masterclass. The actress navigated every public appearance — from film promotions to family functions — with a wardrobe that was both bump-friendly and fashion-forward, quietly rewriting what maternity dressing could look like in Indian celebrity culture.

[[img:/assets/celebrities/alia-bhatt/banner.webp]]

**Flowing Anarkalis, Reworked**
Some of Alia's standout maternity moments came from flowing anarkalis in soft pastels — a silhouette that has always flattered Indian body types through pregnancy, but which she styled with contemporary cuts and unexpected colour pairings rather than the safe, traditional palette most expectant mothers default to.

**Empire Waists in Jewel Tones**
Where Western maternity fashion often leans into neutral, muted tones, Alia repeatedly chose empire-waist gowns in rich jewel tones — emerald, sapphire, deep plum — for evening appearances. It signalled that maternity dressing didn't need to mean toning down personal style, just adapting the silhouette.

**The Comfortable Kurta Set**
For daytime and travel, Alia frequently returned to simple, well-tailored kurta sets in breathable fabrics — proof that some of the most photographed maternity looks weren't the most elaborate ones, but the ones that looked genuinely comfortable to move in.

**Why This Mattered Beyond Fashion**
Alia's visible, stylish approach to pregnancy dressing had an impact beyond red-carpet coverage. Indian maternity wear has historically been an underserved category — heavy on shapeless kurtas and light on genuine style options. Seeing a major star treat the phase as an extension of her personal style rather than a fashion pause encouraged a wave of Indian maternity labels to raise their design ambitions.

**Post-Pregnancy Transition**
Equally notable was how seamlessly Alia's wardrobe transitioned once she returned to red carpets post-pregnancy — many of the silhouette lessons from her maternity dressing (empire waists, flowing anarkalis, considered colour choices) carried directly into her post-partum looks, suggesting a wardrobe built with intention rather than dressing purely for a temporary phase.

[[img:/assets/outfits/look-alia-bhatt-gangubai/hero.png]]

**Building a Maternity-Friendly Wardrobe**
The core lesson from Alia's approach: prioritise silhouettes that skim rather than cling, choose fabrics with natural stretch or flow, and don't shy away from colour just because the cut needs to accommodate a changing body.

**Fabric Choices That Actually Work**
Beyond silhouette, fabric selection made a real difference in how comfortable and photograph-ready Alia's maternity looks stayed across an entire pregnancy. Soft, breathable georgettes and crepe fabrics with a slight stretch were recurring choices, avoiding both the stiffness of structured brocades and the clinginess of jersey knits — a middle ground that flatters without restricting.

**Accessorising a Changing Body**
Jewellery and accessory choices also shifted subtly through the pregnancy — slightly bolder statement earrings and simpler neckwear drew attention upward, away from the midsection, without ever feeling like a deliberate strategy to hide anything. It's a subtle styling trick that maternity-wear designers have started actively incorporating into their own collections.

**Setting a New Standard**
Perhaps the most lasting impact of Alia's maternity style run is how it's reframed public expectations. Where past generations of Indian celebrities largely disappeared from red carpets during pregnancy, a visible and stylish approach is now becoming the norm rather than the exception — a genuinely meaningful cultural shift that extends well beyond fashion coverage alone.

At CelebStyle, we've taken inspiration from Alia's maternity looks to create a special collection designed for comfort without compromising on style.`,
    coverImage: "/assets/blog/banner-3.png",
    tags: ["Bollywood Style", "alia", "maternity", "fashion", "bollywood"],
    daysBack: 30,
  },
  {
    slug: "demo-blog-ranveer-colour-blocking",
    title: "The Art of Colour Blocking: Lessons from Ranveer Singh",
    summary: "Nobody does colour blocking quite like Ranveer Singh. We decode his approach to bold, fearless fashion.",
    category: "Bollywood Style",
    celebrityId: "ranveer-singh",
    productIds: ["look-ranveer-singh-gully-boy", "look-luxury-indo-western"],
    body: `Ranveer Singh is arguably India's most fearless fashion icon. His approach to colour — bold, unapologetic, and thoroughly intentional — has inspired a generation to experiment with their wardrobes rather than defaulting to safe neutrals.

[[img:/assets/celebrities/ranveer-singh/banner.webp]]

**What Colour Blocking Actually Means**
At its core, colour blocking is the deliberate pairing of two or more solid, contrasting colours in a single outfit — think a cobalt blue jacket over mustard trousers, or a fuchsia bandhgala with emerald accents. Done poorly, it looks chaotic. Done well, as Ranveer consistently demonstrates, it looks like a considered artistic statement.

**The Rule of Intentional Contrast**
Ranveer's stylists have spoken about choosing colour pairings from opposite or adjacent points on the colour wheel rather than random combinations — this is why his boldest looks still feel cohesive rather than clashing. A red and green pairing works because it's a deliberate complementary contrast, not an accident.

**Texture as the Balancing Act**
One underappreciated element of Ranveer's colour blocking is how texture does the balancing work. A bold colour pairing in matching fabrics can feel flat; Ranveer frequently mixes velvet with cotton, or a matte fabric with a subtle sheen, which keeps even the most saturated colour combinations visually interesting rather than one-note.

**Where Colour Blocking Works Best**
Not every occasion calls for maximum boldness. Ranveer himself dials the intensity up or down depending on context — full colour-blocked ensembles for premieres and award shows, more restrained single-colour-pop looks (one bold piece against neutral basics) for everyday public appearances. That range is part of what makes his overall style feel considered rather than performative.

**Colour Blocking for Everyday Wardrobes**
You don't need Ranveer's confidence level to borrow the principle. Start small: a bright accessory against a neutral outfit, then work up to a two-tone shirt-and-trouser pairing, before attempting a full head-to-toe colour-blocked look. The goal is intentionality, not intensity.

[[img:/assets/outfits/look-ranveer-singh-gully-boy/hero.png]]

**Why It's More Than a Trend**
Colour blocking on Ranveer isn't a passing red-carpet gimmick — it's been a consistent thread across nearly a decade of his public style, which is exactly why it reads as authentic rather than trend-chasing.

**The Confidence Factor**
Stylists who've worked with Ranveer consistently point to one thing above all else: he commits fully to whatever colour story is chosen for a given appearance, with no visible hesitation or half-measures. That total commitment is arguably harder to replicate than the colour theory itself — a slightly nervous colour-blocked outfit reads as a mistake, while a fully committed one reads as a statement, even when the actual colour combination is identical.

**Common Mistakes to Avoid**
The most common colour-blocking mistake is choosing too many colours at once rather than too bold a pairing. Ranveer's most successful looks typically stick to two, occasionally three, distinct colours — adding a fourth or fifth almost always tips a look from intentional into chaotic, regardless of how confident the wearer feels.

Our Ranveer-inspired collection brings colour blocking into the real world with wearable pieces that inject personality into everyday dressing.`,
    coverImage: "/assets/blog/banner-4.png",
    tags: ["Bollywood Style", "ranveer", "colourblocking", "mensfashion", "bold"],
    daysBack: 45,
  },
  {
    slug: "demo-blog-saree-styling-2024",
    title: "How to Style a Saree in 2024: Celebrity-Inspired Draping Styles",
    summary: "From classic Nivi drapes to contemporary pre-stitched styles, we've compiled the most stunning saree looks of the year.",
    category: "Styling Guide",
    celebrityId: null,
    productIds: ["look-luxury-organza-saree", "look-aishwarya-rai-devdas"],
    body: `The saree is timeless, but how you style it is always evolving. 2024 has seen a beautiful fusion of traditional draping with contemporary silhouettes, as celebrities and stylists reinterpret a garment that's thousands of years old for red carpets, receptions, and everyday festive wear alike.

[[img:/assets/banners/luxury-banner.webp]]

**The Shoulder Drape**
One of the year's most photographed innovations is the shoulder drape — where the pallu is pinned to fall dramatically over one shoulder rather than pleated traditionally, creating a cape-like silhouette. It reads as more sculptural and modern while keeping the garment's essential identity intact.

**The Dhoti-Style Tuck**
For those wanting a fashion-forward edge without abandoning the saree entirely, the dhoti-style tuck — where the lower half is draped and tucked to resemble wide-leg trousers — has become a genuine trend rather than a niche runway experiment. It photographs beautifully in motion and offers far more ease of movement than a traditional drape.

**The Pre-Stitched Saree**
Practicality has driven one of the biggest shifts in saree culture this year: the rise of the pre-stitched saree, which comes pre-pleated and structured, requiring only a few pins to wear correctly. For younger women unfamiliar with traditional draping techniques, this has made the saree significantly more accessible for everyday and event wear alike.

**Blouse Innovation**
As much as draping style has evolved, blouse design has arguably changed even more dramatically — corset-style blouses, cape-sleeve blouses, and even structured jacket-style blouses are now common pairings with traditional sarees, creating a genuinely fresh silhouette while keeping the six yards of fabric itself unchanged.

**Regional Weaves Getting Their Moment**
Beyond draping technique, 2024 saw increased celebrity interest in regional weaves that had previously stayed under the radar — Sambalpuri, Chanderi, and Maheshwari sarees showed up on red carpets alongside the usual Kanjeevaram and Banarasi favourites, broadening the conversation around what "celebrity saree style" actually means.

[[img:/assets/outfits/look-luxury-organza-saree/hero.png]]

**Choosing Your Own Draping Style**
The best approach for anyone experimenting with these trends is to match the drape to the occasion — the shoulder drape and dhoti-tuck for evening events where drama and movement matter, and the classic Nivi drape or pre-stitched option for daytime functions where ease and tradition take priority.

**Draping for Your Body Type**
Different drapes genuinely flatter different body types, and celebrity stylists are increasingly vocal about this rather than pushing a single "trending" style on everyone. The shoulder drape elongates the frame and suits those wanting a more dramatic silhouette, the dhoti-tuck works beautifully for those who want ease of movement without sacrificing structure, and the classic Nivi drape remains the most universally flattering option for first-time saree wearers still building confidence with the garment.

**Investing in the Right Blouse**
Given how much blouse design now drives the overall look, it's worth treating the blouse as its own investment piece rather than an afterthought stitched last-minute. A well-constructed corset or structured blouse can be re-styled with multiple different sarees across a festive season, effectively multiplying your wardrobe options without buying new sarees each time.

Explore our curated saree collection, styled to match every one of these draping trends.`,
    coverImage: "/assets/blog/banner-5.png",
    tags: ["Styling Guide", "saree", "styling", "tradition", "fashion2024"],
    daysBack: 55,
  },
  {
    slug: "demo-blog-wedding-season-2024",
    title: "Wedding Season 2024: Celebrity Looks That Stole the Show",
    summary: "From grand celebrations to intimate destination weddings, we recap the most memorable fashion moments.",
    category: "Wedding Trends",
    celebrityId: null,
    productIds: ["look-festive-sangeet-lehenga", "look-festive-wedding-sherwani"],
    body: `India's 2024 wedding season was arguably its most spectacular yet. The celebrations brought together Bollywood royalty, cricket legends, and business icons in an unforgettable display of Indian couture, with fashion coverage often rivalling the ceremonies themselves for public attention.

[[img:/assets/banners/wedding-banner.webp]]

**The Women's Fashion Showcase**
The women's fashion stole the show with jaw-dropping lehengas from Sabyasachi, Manish Malhotra, and Abu Jani-Sandeep Khosla headlining nearly every major celebrity wedding this year. What distinguished 2024 specifically was a shift toward more personalised embroidery — motifs referencing the couple's story rather than purely decorative patterns, a trend guests increasingly noticed and asked their own designers to replicate.

**Groomswear Finally Gets Its Due**
For years, groom fashion trailed far behind bridal fashion in terms of design ambition. 2024 saw that gap narrow considerably, with sherwanis featuring the same level of embroidery detail and fabric innovation previously reserved almost exclusively for bridal lehengas. Structured bandhgalas and modern-cut sherwanis in unconventional colours — sage green, dusty blue, warm terracotta — moved grooms firmly into the fashion conversation.

**Multi-Function Wardrobes**
Modern Indian celebrity weddings routinely span four to six separate functions, each with its own dress code — and 2024's most talked-about wardrobes treated this as an opportunity for a full sartorial arc rather than a series of disconnected outfits. Mehendi looks in vibrant, playful colours gave way to elegant sangeet numbers, culminating in the traditional red or ivory for the wedding ceremony itself.

**Destination Wedding Considerations**
With more celebrity weddings taking place at beach and hill-station destinations, 2024's looks increasingly factored in climate and setting — lighter fabrics, shorter trains, and palettes that complemented natural backdrops rather than competing with them.

**Guest Style Also Levelled Up**
An underrated trend this year was the sharp rise in guest styling ambition. As celebrity wedding photos flood social media within hours, guests attending these high-profile events have started treating their own outfits with the same seriousness once reserved for the couple, driving demand for elevated festive wear across the board.

[[img:/assets/outfits/look-festive-sangeet-lehenga/hero.png]]

**Planning Your Own Wedding Wardrobe**
Whether you're the couple or a guest, 2024's biggest lesson is to treat each function as its own styling moment rather than repeating the same silhouette across the entire wedding calendar.

**Budgeting Across Multiple Functions**
With so many functions to dress for, one practical lesson from celebrity wedding wardrobes is smart budget allocation — reserving the largest spend for the one or two looks that will be photographed most (typically the wedding ceremony and reception) while choosing more accessible pieces for smaller functions like haldi or mehendi, where comfort and colour matter more than intricate embellishment.

**The Rise of Rental and Resale**
Even at the celebrity level, rental and resale of high-value wedding pieces have become more socially acceptable, particularly for guests attending multiple weddings in a single season. It's a practical response to the sheer frequency of high-profile weddings now dominating the social calendar, and it's trickling down into how everyday wedding guests approach their own wardrobes too.

At CelebStyle, we've curated a wedding-ready collection spanning every function, from mehendi to reception.`,
    coverImage: "/assets/blog/banner-5.png",
    tags: ["Wedding Trends", "wedding", "lehenga", "bollywood", "2024", "bridal"],
    daysBack: 65,
  },
  {
    slug: "demo-blog-sustainable-fashion-2024",
    title: "Celebrities Leading the Sustainable Fashion Movement in India",
    summary: "Indian celebrities are increasingly championing sustainability, from organic fabrics to handloom revival.",
    category: "Sustainable Fashion",
    celebrityId: "sonam-kapoor",
    productIds: ["look-sonam-kapoor-neerja"],
    body: `Sustainable fashion is no longer just a Western trend — India's biggest celebrities are leading the charge towards conscious dressing, using their public platforms to champion handloom revival, ethical production, and slower consumption habits.

[[img:/assets/banners/luxury-banner.webp]]

**Handloom as a Style Statement**
A growing number of Indian celebrities now treat handloom textiles not as a compromise on glamour but as a deliberate style statement in their own right. Sonam Kapoor has repeatedly championed Indian handloom on red carpets, pairing traditional weaves with contemporary silhouettes to prove sustainable choices can be just as striking as anything mass-produced.

**Renting and Re-Wearing**
One of the more surprising shifts in celebrity culture has been the normalisation of re-wearing outfits — something previously considered a fashion faux pas for public figures. Several actresses have publicly re-worn red-carpet gowns to second events, framing it as a sustainability choice rather than a budget one, which has helped shift public perception around repeat outfits.

**Supporting Artisan Communities**
Beyond wearing sustainable fabrics, several celebrities have gone further by directly partnering with weaver cooperatives and artisan communities, commissioning custom pieces that provide fair wages and preserve traditional techniques that might otherwise fade as younger generations move away from handloom work.

**Ethical Production Behind the Scenes**
Sustainability in fashion isn't only about the finished garment — it's also about how it's made. Celebrities championing this movement have increasingly asked pointed questions about labour conditions and material sourcing before agreeing to brand partnerships, applying real pressure on manufacturers to improve practices industry-wide.

**Why This Matters for Everyday Shoppers**
When public figures with genuine reach choose sustainable options, it changes the calculus for regular shoppers too — normalising the idea that a beautiful outfit and an ethically produced one aren't mutually exclusive. It's a meaningful shift in an industry that has historically prioritised speed and volume over craft and longevity.

[[img:/assets/outfits/look-sonam-kapoor-neerja/hero.png]]

**How CelebStyle Approaches Sustainability**
At CelebStyle, we partner with manufacturers who prioritise ethical production and sustainable material sourcing, and we're expanding our handloom-inspired collection to make conscious dressing more accessible for everyday shoppers, not just red-carpet moments.

**Practical Steps for Conscious Shoppers**
You don't need to overhaul your entire wardrobe overnight to shop more sustainably. Start by favouring natural fibres — cotton, linen, silk, wool — over synthetic blends that shed microplastics and rarely biodegrade; look for handloom or artisan-marked pieces where possible; and treat garments as long-term investments rather than single-occasion purchases, which naturally reduces overall consumption over time.

**The Economics of Slower Fashion**
Slower, more conscious fashion consumption also tends to be better value in the long run, even if individual pieces cost more upfront — a well-made handloom piece that lasts a decade and gets worn repeatedly ultimately works out cheaper per wear than several fast-fashion pieces that fall apart within a season.

**Looking Ahead**
As more Indian celebrities treat sustainability as a genuine value rather than a passing publicity angle, expect the ripple effect on mainstream shopping habits to keep growing — turning what started as a niche, Western-associated concern into a distinctly Indian conversation about craft, longevity, and respect for the artisans behind every garment.`,
    coverImage: "/assets/blog/banner-6.png",
    tags: ["Sustainable Fashion", "sustainable", "eco", "fashion", "celebrity", "handloom"],
    daysBack: 80,
  },
  {
    slug: "demo-blog-kurta-sets-trend-2024",
    title: "The Kurta Set Renaissance: Why Every Man Needs One in 2024",
    summary: "The humble kurta-pyjama set has had a high-fashion glow-up. Here's why this classic Indian ensemble is ruling 2024.",
    category: "Menswear",
    celebrityId: "ranbir-kapoor",
    productIds: ["look-festive-bhai-dooj-kurta", "look-ranbir-kapoor-animal"],
    body: `The kurta set is having its biggest moment in decades. Contemporary kurta sets now come in breathable linens, sustainable cottons, and luxurious silks, with cuts that range from relaxed and minimal to structured and architectural — a far cry from the boxy, one-size-fits-all versions of a generation ago.

[[img:/assets/celebrities/ranbir-kapoor/banner.webp]]

**From Occasion Wear to Everyday Staple**
Historically confined to festivals and family functions, the kurta set has expanded into genuinely everyday territory — brunches, casual work-from-home meetings, even smart-casual dinners. This shift mirrors a broader move in Indian menswear away from strict Western-versus-traditional dressing categories and toward a more fluid, occasion-flexible wardrobe.

**Ranbir Kapoor's Quiet Luxury Approach**
Celebrity champions include Ranbir Kapoor, whose understated ivory and muted-tone sets communicate quiet luxury rather than loud festivity. His approach — minimal embroidery, exceptional fabric quality, and a clean, straight-cut silhouette — has become a genuine reference point for men who want to look put-together without appearing overdressed.

**Fabric Innovation Driving the Trend**
Much of the kurta set's resurgence comes down to fabric technology. Breathable linen blends and sustainably sourced cottons have made the garment genuinely comfortable for daily wear in India's climate, addressing the primary complaint that kept many younger men away from traditional wear in the past.

**Cut Matters More Than Embellishment**
Where older kurta sets leaned heavily on embroidery and print to signal festivity, 2024's most sought-after versions prioritise cut and drape — a well-tailored straight-leg pyjama, a kurta length that hits at the right point, and clean necklines that work whether dressed up with a Nehru jacket or kept simple.

**Styling for Different Occasions**
The versatility of the modern kurta set is its biggest selling point. Add a structured Nehru jacket and a pocket square for a wedding function; keep it simple with a pair of loafers for a daytime outing; layer a light shawl for cooler evenings. Few garments in a man's wardrobe offer this much range from a single silhouette.

[[img:/assets/outfits/look-festive-bhai-dooj-kurta/hero.png]]

**Investing in a Kurta Set**
Given how frequently it can now be worn, a well-made kurta set is arguably one of the smarter investments in a modern Indian man's wardrobe — more versatile than a single-occasion sherwani, and more distinctive than yet another Western formal shirt.

**Building a Kurta Wardrobe on a Budget**
You don't need a dozen kurta sets to cover every occasion — two or three well-chosen colours (an ivory or white for versatility, a deep jewel tone for evening events, and one bolder colour for festive occasions) will cover nearly every scenario a modern man's calendar throws at him. Prioritise fabric quality over embellishment when starting out; a plain, beautifully draped kurta in good cotton or linen will outperform a heavily printed but poorly cut one every time.

**Caring for Your Kurta Sets**
Because breathable fabrics like linen and cotton wrinkle easily, proper storage matters more than most men realise — hanging rather than folding, and steaming rather than ironing directly, both preserve the drape quality that makes a well-made kurta set look expensive. At CelebStyle, we've created kurta sets that honour tradition while embracing modernity.`,
    coverImage: "/assets/blog/banner-4.png",
    tags: ["Menswear", "kurta", "mensfashion", "indian", "tradition", "2024"],
    daysBack: 90,
  },
  {
    slug: "demo-blog-priyanka-global-fashion",
    title: "Priyanka Chopra's Global Fashion Journey: From Bollywood to Hollywood",
    summary: "How PeeCee became one of the world's most powerful fashion voices.",
    category: "Global Fashion",
    celebrityId: "priyanka-chopra",
    productIds: ["look-luxury-ball-gown", "look-priyanka-chopra-party"],
    body: `Priyanka Chopra Jonas has become a genuine global fashion icon. From her early Bollywood days in embellished sarees to her current international wardrobe of understated luxury, her fashion journey is a masterclass in purposeful evolution rather than reinvention for its own sake.

[[img:/assets/celebrities/priyanka-chopra/banner.webp]]

**The Bollywood Foundation**
Priyanka's early red-carpet appearances in India established a foundation of maximalist glamour — heavily embellished gowns, statement jewellery, and bold colour choices that suited the scale of Bollywood award shows. That foundation matters because it shows her later "understated" Hollywood style wasn't a rejection of her roots, but a deliberate recalibration for a different stage.

**The Hollywood Transition**
As Priyanka's career expanded into American television and film, her red-carpet style shifted toward cleaner lines, more tailored silhouettes, and a more restrained colour palette — a common transition for actresses building crossover careers, but one Priyanka navigated with unusual consistency rather than whiplashing between two completely different aesthetics.

**Never Abandoning Indian Craft**
What sets Priyanka apart from other crossover stars is that even her most Western-leaning red-carpet looks frequently incorporate Indian design elements — an embroidery technique, a fabric choice, a silhouette reference — worked in subtly rather than announced loudly. It's a sophisticated way of representing her heritage without it reading as costume.

**Building a Fashion Business**
Beyond red-carpet dressing, Priyanka's fashion influence extends into business — investments and collaborations across beauty and fashion brands that reflect a genuine understanding of the industry rather than a celebrity simply lending her name. This business-minded approach to fashion has made her a more durable style influence than actresses who rely purely on red-carpet visibility.

**Dressing for the Room, Not Just the Camera**
Colleagues who've worked with Priyanka's styling team note a consistent philosophy: dress for the specific event and audience, not a generic "best dressed" formula. A Met Gala look, an Indian wedding guest outfit, and a production meeting outfit all look distinctly different — because they're each solving a different problem, not chasing the same aesthetic everywhere.

[[img:/assets/outfits/look-luxury-ball-gown/hero.png]]

**Key Lessons from Her Style Evolution**
Invest in quality over quantity, let your cultural heritage inform your personal style rather than erasing it, and dress deliberately for the specific room you're walking into.

**The Long Game of Personal Branding**
What's most instructive about Priyanka's fashion journey isn't any single red-carpet moment but the cumulative effect of two decades of consistent, intentional choices. Unlike stars who chase whatever's trending each season, her wardrobe evolution has always tracked a clear narrative — Bollywood ingenue to global crossover star to industry businesswoman — which is exactly why each new chapter of her style feels earned rather than arbitrary.

**Advice for Anyone Building a Personal Style**
The broader lesson extends well beyond red-carpet dressing: personal style, done well, isn't about chasing every trend but about making choices that compound into a recognisable, coherent identity over time. That's as true for someone building a professional wardrobe as it is for a global film star navigating two industries at once.

We've curated a collection inspired by her journey, from Bollywood glamour to global red-carpet polish.`,
    coverImage: "/assets/blog/banner-1.png",
    tags: ["Global Fashion", "priyanka", "global", "bollywood", "hollywood", "icon"],
    daysBack: 100,
  },
  {
    slug: "demo-blog-festive-fashion-2024",
    title: "Festive Season Fashion 2024: The Ultimate Buying Guide",
    summary: "Diwali, Navratri, Durga Puja — we've curated the perfect festive wardrobe for every celebration.",
    category: "Festive Style",
    celebrityId: null,
    productIds: ["look-festive-diwali-gold-kurta", "look-festive-navratri-chaniya"],
    body: `India's festive season is a riot of colour, tradition, and spectacular fashion, spanning months of celebrations that each carry their own distinct style language. Getting festive dressing right means understanding not just what looks good, but what's appropriate for each specific occasion.

[[img:/assets/banners/festive-banner.webp]]

**Navratri: Built for Movement**
For Navratri, bold vibrant chaniya cholis with contemporary cuts are trending — mirror-work bodices, flared skirts with modern prints, and lighter fabrics that hold up through nine nights of continuous garba and dandiya. Comfort and movement matter just as much as colour here.

**Diwali: Richness and Glow**
For Diwali, classic Anarkalis in deep jewel tones are perennial favourites, chosen specifically because rich colours — emerald, wine, royal blue — photograph beautifully under diya and fairy light, which dominates most Diwali celebration settings.

**Durga Puja: A Different Colour Language**
In Bengal, Durga Puja dressing follows an entirely different logic — the iconic red-and-white Tant saree remains a non-negotiable classic for the main ceremonial days, even as younger generations experiment more freely with colour on the earlier pandal-hopping days.

**Buying Smart for a Multi-Festival Season**
Rather than buying one outfit per festival, the most cost-effective approach — one increasingly favoured by celebrities managing packed promotional and personal calendars — is building a small capsule of versatile festive pieces that can be re-styled with different jewellery, dupattas, and layering across multiple occasions.

**Accessorising Across Festivals**
Jewellery is where festival dressing can be most efficiently differentiated without buying new outfits — oxidised silver and mirror work for Navratri, gold-toned temple jewellery for Diwali, and minimal gold accents for Durga Puja's more understated aesthetic.

**Fabric Care During Festival Season**
With back-to-back functions, fabric care becomes a real practical concern. Opt for wrinkle-resistant silks and cottons where possible, and always have a pressing plan for heavier embroidered pieces that can't simply be steamed the morning of an event.

[[img:/assets/outfits/look-festive-diwali-gold-kurta/hero.png]]

**Shopping the Season**
Whatever your festival, CelebStyle has you covered with our comprehensive festive collection, featuring outfits inspired by India's most celebrated fashion icons and organised by occasion so you can shop the mood, not just the garment category.

**Planning Ahead for Peak Season**
Festive season in India is also peak demand season for tailors, boutiques, and online sellers alike, which means the smartest shoppers start planning at least four to six weeks ahead of the first major festival on their calendar. Waiting until the week of Diwali or Navratri often means settling for whatever's left in stock rather than the piece you actually wanted, particularly for popular sizes and heavily embroidered styles that take longer to produce.

**Mixing Old and New**
One trend celebrities have quietly modelled well this festive season is mixing heirloom or previous-season pieces with one or two new statement items, rather than buying an entirely new outfit for every single function. A well-preserved dupatta or piece of jewellery from a previous year, paired with a fresh blouse or kurta, can feel just as festive as an entirely new ensemble — and it's a far more sustainable way to build a festive wardrobe over time.`,
    coverImage: "/assets/blog/banner-2.png",
    tags: ["Festive Style", "festive", "diwali", "navratri", "2024", "celebration"],
    daysBack: 10,
  },
] as const;

const COUPONS_EXTRA = [
  { code: "NEWUSER20",  type: "PERCENTAGE" as const, value: 20, minOrderAmount: 2000,  maxDiscountAmount: 500,  usageLimit: 500,  description: "20% off for first-time orders" },
  { code: "CELEB500",  type: "FIXED_AMOUNT" as const, value: 500, minOrderAmount: 3000,  maxDiscountAmount: null, usageLimit: 200,  description: "Flat ₹500 off on celebrity picks" },
  { code: "FESTIVE15", type: "PERCENTAGE" as const, value: 15, minOrderAmount: 5000,  maxDiscountAmount: 1500, usageLimit: 300,  description: "Festive season 15% discount" },
  { code: "BOLLYWOOD", type: "PERCENTAGE" as const, value: 10, minOrderAmount: 1000,  maxDiscountAmount: 800,  usageLimit: 1000, description: "10% off all Bollywood-inspired looks" },
  { code: "SAREE200",  type: "FIXED_AMOUNT" as const, value: 200, minOrderAmount: 2500,  maxDiscountAmount: null, usageLimit: 150,  description: "₹200 off on sarees" },
  { code: "VIP25",     type: "PERCENTAGE" as const, value: 25, minOrderAmount: 8000,  maxDiscountAmount: 2500, usageLimit: 50,   description: "VIP member exclusive 25% off" },
  { code: "CRICKET10", type: "PERCENTAGE" as const, value: 10, minOrderAmount: 1500,  maxDiscountAmount: 600,  usageLimit: 400,  description: "10% off on cricket star looks" },
  { code: "BRIDE2024", type: "PERCENTAGE" as const, value: 12, minOrderAmount: 10000, maxDiscountAmount: 3000, usageLimit: 100,  description: "Bridal collection discount" },
  { code: "SUMMER300", type: "FIXED_AMOUNT" as const, value: 300, minOrderAmount: 2000,  maxDiscountAmount: null, usageLimit: 250,  description: "Summer special ₹300 off" },
] as const;

// ── Main seeder ───────────────────────────────────────────────────────────────

export async function seedAdminDemoData(prisma: PrismaClient): Promise<void> {
  const adminUser = await prisma.user.findUnique({ where: { email: "admin@celebstyle.com" } });
  const adminId = adminUser?.id ?? "";

  // ── 1. Extra coupons ──────────────────────────────────────────────────────

  for (const c of COUPONS_EXTRA) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: {},
      create: {
        code:             c.code,
        type:             c.type,
        value:            c.value,
        minOrderAmount:   c.minOrderAmount,
        maxDiscountAmount: c.maxDiscountAmount ?? null,
        usageLimit:       c.usageLimit,
        usedCount:        rndInt(0, Math.floor(c.usageLimit * 0.4)),
        isActive:         true,
        startsAt:         new Date(),
        expiresAt:        new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        createdById:      adminId || null,
      },
    });
  }

  // ── 2. Blog posts in DB ───────────────────────────────────────────────────

  for (const p of BLOG_POSTS) {
    const existing = await prisma.blogPost.findFirst({ where: { slug: p.slug } });
    if (existing) continue;
    if (!adminId) continue;

    await prisma.blogPost.create({
      data: {
        slug:        p.slug,
        authorId:    adminId,
        celebrityId: p.celebrityId,
        title:       p.title,
        summary:     p.summary,
        body:        p.body,
        coverImage:  p.coverImage,
        tags:        [...p.tags],
        productIds:  [...p.productIds],
        isPublished: true,
        publishedAt: daysAgo(p.daysBack),
        viewCount:   rndInt(100, 5000),
      },
    });
  }

  // ── 3. Demo users (100) ───────────────────────────────────────────────────

  const existingDemoUsers = await prisma.user.count({ where: { email: { contains: "@demo.celebstyle.com" } } });
  if (existingDemoUsers < 80) {
    const pwHash = await hashPassword("Demo@12345");
    const userData: Array<{
      email: string;
      name: string;
      passwordHash: string;
      role: "CUSTOMER";
      emailVerified: boolean;
      isActive: boolean;
      createdAt: Date;
    }> = [];

    for (let i = 1; i <= 100; i++) {
      const first = pick(FIRST_NAMES);
      const last  = pick(LAST_NAMES);
      const name  = `${first} ${last}`;
      const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@demo.celebstyle.com`;
      userData.push({
        email,
        name,
        passwordHash: pwHash,
        role: "CUSTOMER",
        emailVerified: true,
        isActive: true,
        createdAt: daysAgo(rndInt(10, 365)),
      });
    }

    await prisma.user.createMany({ data: userData, skipDuplicates: true });
    console.log("  Created 100 demo users");
  }

  // ── 4. Demo orders (250) ─────────────────────────────────────────────────

  const existingOrders = await prisma.order.count();
  if (existingOrders >= 200) {
    console.log("  Demo orders already seeded, skipping.");
  } else {
    // Load products with celebrity info for OrderItem denormalization
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id:         true,
        slug:       true,
        movieName:  true,
        imageUrl:   true,
        basePrice:  true,
        category:   true,
        celebrity: { select: { id: true, name: true } },
      },
      take: 80,
    });

    const users = await prisma.user.findMany({
      where: { role: "CUSTOMER" },
      select: { id: true, name: true, email: true },
      take: 120,
    });

    if (products.length === 0) {
      console.log("  No products found, skipping order seed.");
    } else {
      // Ensure a warehouse exists
      let warehouse = await prisma.warehouse.findFirst({ where: { isActive: true } });
      if (!warehouse) {
        warehouse = await prisma.warehouse.create({
          data: {
            slug:     "wh-mumbai-01",
            name:     "Mumbai Central Warehouse",
            city:     "Mumbai",
            state:    "Maharashtra",
            pincode:  "400093",
            country:  "India",
            priority: 1,
            isActive: true,
          },
        });
      }

      const currentCount = await prisma.order.count();
      let seqNum = currentCount;

      for (let i = 0; i < 238; i++) {
        const user    = users.length > 0 ? pick(users) : null;
        const product = pick(products);
        const qty     = rndInt(1, 3);
        const price   = Number(product.basePrice);
        const subtotal = price * qty;
        const shippingAmt = subtotal >= 25000 ? 0 : 499;
        const discount = Math.random() < 0.2 ? Math.round(subtotal * 0.1) : 0;
        const total    = subtotal + shippingAmt - discount;
        const status   = pick(ORDER_STATUSES);
        const cityIdx  = rndInt(0, CITIES.length - 1);
        const city     = CITIES[cityIdx];
        const state    = STATES[cityIdx];
        const name     = user ? user.name : `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
        const email    = user ? user.email : `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`;
        const phone    = pick(PHONES);
        const createdAt = daysAgo(rndInt(1, 180));

        seqNum++;
        const orderNumber = `CS${String(seqNum).padStart(6, "0")}`;

        const celeb = product.celebrity ?? { id: "unknown", name: "Unknown" };

        const order = await prisma.order.create({
          data: {
            orderNumber,
            userId:          user?.id ?? null,
            customerEmail:   email,
            shippingName:    name,
            shippingPhone:   phone,
            shippingAddress: `${rndInt(1, 999)}, ${pick(STREET_NAMES)}, ${city}`,
            shippingCity:    city,
            shippingState:   state,
            shippingPincode: String(rndInt(100000, 999999)),
            subtotal,
            shippingAmount:  shippingAmt,
            discountAmount:  discount,
            total,
            status,
            paymentStatus: (
              status === "PLACED"     ? "PENDING" :
              status === "CANCELLED"  ? "FAILED"  :
              status === "REFUNDED"   ? "REFUNDED" :
              "CAPTURED"
            ),
            createdAt,
            updatedAt: createdAt,
            deliveredAt: ["DELIVERED","REFUNDED"].includes(status)
              ? new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000)
              : null,
            items: {
              create: [{
                productId:     product.id,
                productSlug:   product.slug,
                productName:   product.movieName,
                celebrityId:   celeb.id,
                celebrityName: celeb.name,
                category:      product.category,
                size:          pick(["XS","S","M","L","XL","XXL"] as const),
                imageUrl:      product.imageUrl ?? "",
                quantity:      qty,
                unitPrice:     price,
                totalPrice:    price * qty,
                manufacturerIds: [],
              }],
            },
            commission: {
              create: {
                platformFee:         Math.round(subtotal * 0.10),
                celebrityCommission: Math.round(subtotal * 0.05),
                manufacturerShare:   Math.round(subtotal * 0.85),
                platformFeePercent:  10,
                celebrityPercent:    5,
                manufacturerPercent: 85,
              },
            },
          },
        });

        // Payment record for non-PLACED orders
        if (status !== "PLACED") {
          const method = pick(PAYMENT_METHODS);
          await prisma.payment.create({
            data: {
              orderId:       order.id,
              amount:        total,
              status:        status === "CANCELLED" ? "FAILED" : status === "REFUNDED" ? "REFUNDED" : "CAPTURED",
              method:        method as "UPI" | "CARD" | "NET_BANKING" | "WALLET" | "EMI" | "COD",
              provider:      "SIMULATED",
              refundedAmount: status === "REFUNDED" ? total : 0,
              capturedAt:    status !== "CANCELLED" ? new Date(createdAt.getTime() + 5 * 60 * 1000) : null,
            },
          });
        }

        // Settlement for DELIVERED/REFUNDED orders
        if (status === "DELIVERED" || status === "REFUNDED") {
          const pf  = Math.round(subtotal * 0.10);
          const cc  = Math.round(subtotal * 0.05);
          const ms  = Math.round(subtotal * 0.85);
          const tax = Math.round(cc * 0.05);
          const isCompleted = Math.random() < 0.6;
          await prisma.settlement.create({
            data: {
              orderId:               order.id,
              platformFee:           pf,
              celebrityCommission:   cc,
              manufacturerShare:     ms,
              taxDeducted:           tax,
              netCelebrityAmount:    cc - tax,
              netManufacturerAmount: ms,
              status:       isCompleted ? "COMPLETED" : "PENDING",
              settledAt:    isCompleted ? new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000) : null,
              settledById:  adminId || null,
            },
          });
        }
      }
      console.log("  Created 238 demo orders with payments and settlements");
    }
  }

  // ── 5. Demo returns (40) ─────────────────────────────────────────────────

  const existingReturns = await prisma.return.count();
  if (existingReturns < 30) {
    const deliveredOrders = await prisma.order.findMany({
      where:   { status: "DELIVERED", userId: { not: null } },
      include: { items: { select: { id: true } }, user: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
      take:    60,
    });

    let created = 0;
    for (const order of deliveredOrders) {
      if (created >= 40) break;
      if (!order.userId || order.items.length === 0) continue;

      const exists = await prisma.return.findFirst({ where: { orderId: order.id } });
      if (exists) continue;

      const returnStatus = pick(RETURN_STATUSES);
      const ret = await prisma.return.create({
        data: {
          orderId:     order.id,
          userId:      order.userId,
          reason:      pick(RETURN_REASONS),
          description: Math.random() > 0.4 ? pick([
            "The outfit arrived in a different colour than shown in the product images.",
            "The sizing runs much smaller than the size guide suggests.",
            "Found a loose thread near the embroidery. Quality issue.",
            "I ordered this for a specific event which got cancelled.",
            "The fabric feels different from what was described as premium silk.",
            "Received a damaged parcel with a small tear in the fabric.",
          ] as const) : null,
          status:       returnStatus,
          refundAmount: ["REFUND_INITIATED","REFUND_COMPLETED"].includes(returnStatus)
            ? Math.round(Number(order.total) * 0.9)
            : null,
          requestedAt: new Date(new Date(order.createdAt).getTime() + rndInt(3, 20) * 24 * 60 * 60 * 1000),
          items: {
            create: [{
              orderItemId: order.items[0].id,
              quantity:    1,
              reason:      "Product not as described",
            }],
          },
        },
      });

      if (!["REJECTED","REFUND_COMPLETED"].includes(returnStatus)) {
        await prisma.order.update({
          where: { id: order.id },
          data:  { status: "RETURN_REQUESTED" },
        });
      }

      void ret;
      created++;
    }
    console.log(`  Created ${created} demo returns`);
  }

  // ── 6. Demo reviews ───────────────────────────────────────────────────────

  const existingReviews = await prisma.review.count({ where: { deletedAt: null } });
  if (existingReviews < 80) {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { id: true },
      take: 60,
    });

    const demoUsers = await prisma.user.findMany({
      where: { email: { contains: "@demo.celebstyle.com" } },
      select: { id: true },
      take: 100,
    });

    if (products.length > 0 && demoUsers.length > 0) {
      const usedPairs = new Set<string>();
      const reviewData: Array<{
        userId: string;
        productId: string;
        rating: number;
        title: string | null;
        body: string;
        isApproved: boolean;
        isVerifiedPurchase: boolean;
        helpfulCount: number;
        createdAt: Date;
      }> = [];

      let attempts = 0;
      while (reviewData.length < 120 && attempts < 600) {
        attempts++;
        const user    = pick(demoUsers);
        const product = pick(products);
        const key     = `${user.id}:${product.id}`;
        if (usedPairs.has(key)) continue;
        usedPairs.add(key);

        const rating = Math.random() < 0.6 ? 5 : Math.random() < 0.7 ? 4 : Math.random() < 0.8 ? 3 : 2;
        reviewData.push({
          userId:    user.id,
          productId: product.id,
          rating,
          title: Math.random() > 0.3 ? pick(REVIEW_TITLES) : null,
          body:  pick(REVIEW_BODIES),
          isApproved: Math.random() > 0.15,
          isVerifiedPurchase: Math.random() > 0.4,
          helpfulCount: rndInt(0, 28),
          createdAt: daysAgo(rndInt(1, 120)),
        });
      }

      await prisma.review.createMany({ data: reviewData, skipDuplicates: true });
      console.log(`  Created ${reviewData.length} demo reviews`);
    }
  }

  // ── 7. Community posts (Feed / Trending / Contest) ───────────────────────

  const existingCommunityPosts = await prisma.communityPost.count();
  if (existingCommunityPosts < DEMO_COMMUNITY_POSTS.length) {
    const productSlugToId = new Map(
      (await prisma.product.findMany({ select: { id: true, slug: true } })).map((p) => [p.slug, p.id])
    );
    const pwHashCommunity = await hashPassword("Demo@12345");

    let createdPosts = 0;
    for (const p of DEMO_COMMUNITY_POSTS) {
      const email = `${p.userId}@community.celebstyle.com`;

      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          name: p.userName,
          passwordHash: pwHashCommunity,
          role: "CUSTOMER",
          emailVerified: true,
          isActive: true,
          createdAt: p.createdAt,
          profile: p.userAvatar ? { create: { avatarUrl: p.userAvatar } } : undefined,
        },
      });

      const existingForUser = await prisma.communityPost.findFirst({
        where: { userId: user.id, caption: p.caption },
        select: { id: true },
      });
      if (existingForUser) continue;

      const resolvedProductId = p.productId ? productSlugToId.get(p.productId) ?? null : null;
      const imageUrls = [p.imageUrl, ...p.images.map((i) => i.url)].filter(
        (url, idx, arr): url is string => !!url && arr.indexOf(url) === idx
      );

      await prisma.communityPost.create({
        data: {
          userId: user.id,
          productId: resolvedProductId,
          caption: p.caption,
          tags: p.tags,
          isApproved: true,
          likeCount: p.likeCount,
          commentCount: p.commentCount,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          images: {
            create: imageUrls.map((url, sortOrder) => ({ url, sortOrder })),
          },
        },
      });
      createdPosts++;
    }
    console.log(`  Created ${createdPosts} demo community posts`);
  }

  // ── 8. System settings ────────────────────────────────────────────────────

  const settings = [
    { key: "platform.name",             value: "CelebStyle",             description: "Platform display name" },
    { key: "platform.commissionRate",   value: "10",                     description: "Platform commission %" },
    { key: "platform.celebRate",        value: "5",                      description: "Celebrity commission %" },
    { key: "platform.mfrRate",          value: "85",                     description: "Manufacturer share %" },
    { key: "platform.freeShipThreshold",value: "25000",                  description: "Free shipping threshold in paise" },
    { key: "platform.shippingFee",      value: "499",                    description: "Standard shipping fee" },
    { key: "platform.currency",         value: "INR",                    description: "Platform currency" },
    { key: "platform.supportEmail",     value: "support@celebstyle.com", description: "Support email" },
    { key: "platform.maxReviewImages",  value: "5",                      description: "Max images per review" },
    { key: "platform.maxCartItems",     value: "20",                     description: "Max cart items" },
    { key: "maintenance.mode",          value: "false",                  description: "Toggle maintenance page" },
    { key: "feature.arTryOn",           value: "true",                   description: "Enable AR Virtual Try-On" },
    { key: "feature.community",         value: "true",                   description: "Enable community posts" },
    { key: "feature.reviews",           value: "true",                   description: "Enable product reviews" },
    { key: "feature.blog",              value: "true",                   description: "Enable blog section" },
  ];

  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where:  { key: s.key },
      update: {},
      create: { key: s.key, value: s.value, description: s.description, isPublic: false },
    });
  }

  console.log("  Admin demo seed complete.");
}

