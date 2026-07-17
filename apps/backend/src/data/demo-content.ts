/**
 * Static demo content used as in-memory fallback for Prisma-backed routes
 * when the database is empty or unavailable.
 * All IDs use a "demo-" prefix so they won't collide with real DB records.
 */

export type DemoBlogPost = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  coverImage: string | null;
  images: string[];
  category: string;
  tags: string[];
  productIds: string[];
  celebrityId: string | null;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  isPublished: boolean;
  publishedAt: Date;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type DemoReview = {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  productId: string;
  orderId: string | null;
  rating: number;
  title: string | null;
  body: string;
  verified: boolean;
  images: Array<{ id: string; url: string; sortOrder: number }>;
  helpfulCount: number;
  helpful: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type DemoCommunityPost = {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  caption: string;
  imageUrl: string | null;
  images: Array<{ id: string; url: string; sortOrder: number }>;
  productId: string | null;
  tags: string[];
  likeCount: number;
  commentCount: number;
  shares: number;
  liked: boolean;
  bookmarked: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

// Shapes a raw demo post for API responses: derives the fields the frontend's
// CommunityPost type expects but that DemoCommunityPost doesn't store directly
// (outfitId/outfitName mirror productId so "Shop this look" links work on
// demo data exactly like they do on DB-backed posts; contestEntry mirrors the
// "contest" tag the same way toPublicPost() derives it for real posts).
export function toPublicDemoPost(p: DemoCommunityPost) {
  return {
    ...p,
    outfitId: p.productId,
    outfitName: null as string | null,
    reportCount: 0,
    contestEntry: p.tags.includes("contest"),
  };
}

// ─── Blog Posts ───────────────────────────────────────────────────────────────

const now = new Date();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

export const DEMO_BLOG_POSTS: DemoBlogPost[] = [
  {
    id: "demo-blog-1",
    slug: "srk-style-evolution-2024",
    title: "Shah Rukh Khan's Style Evolution: From Baazigar to Jawan",
    summary:
      "Three decades, countless looks, one iconic star. We trace SRK's fashion journey from 90s oversized blazers to the sleek bandhgalas of 2024.",
    body: `Shah Rukh Khan has been synonymous with Bollywood for over three decades, and his fashion choices have evolved just as dramatically as his filmography. In the early 90s, SRK defined the 'casual cool' era — oversized shirts, acid-washed jeans, and a devil-may-care attitude. Fast forward to 2024, and the King of Bollywood commands the red carpet in bespoke bandhgalas and Sabyasachi sherwanis worth lakhs.

The transformation didn't happen overnight. Each film brought a new style chapter: the suave suits of Dilwale Dulhania Le Jayenge, the rugged military aesthetic of Jawan, and the street-smart swagger of Don. What remains constant is SRK's ability to make any outfit look effortless.

**The 90s: Effortless Chaos**
Long before he was "King Khan," SRK's early screen wardrobe mirrored the restless energy of the characters he played — Raj and Rahul's varsity jackets and untucked shirts, Baazigar's leather jackets and dark denims. Off-screen, he leaned into the same loose, unstructured silhouettes that defined the decade: high-waisted trousers, boxy blazers with shoulder pads, and the occasional questionable pair of sunglasses. It wasn't polished, but it was authentic to the era, and audiences loved him for it precisely because he looked like he wasn't trying too hard.

**The 2000s: The Suit Era**
As SRK's box-office dominance grew through Kabhi Khushi Kabhie Gham and Kal Ho Naa Ho, his wardrobe matured alongside his star status. Tailored suits became his off-screen uniform — sharp shoulders, structured lapels, and a palette that leaned heavily on navy and charcoal. This was the decade SRK became a genuine style reference for Indian men navigating the shift from casual dressing to boardroom-ready formalwear.

**The Bandhgala Era**
The last five years have seen SRK champion Indian formalwear on global stages. His collaboration with designers like Manish Malhotra and Tarun Tahiliani has resulted in some of the most photographed looks in Bollywood history. The bandhgala — once considered strictly ceremonial — has become his go-to for everything from film premieres to award shows, proof that traditional Indian tailoring can feel just as sharp as a Savile Row suit when cut correctly.

**Jawan and the Return of Rugged Cool**
Jawan marked an interesting full-circle moment: SRK's promotional wardrobe for the film leaned back into the rugged, textured looks of his early career, but executed with three decades of added polish. Cargo jackets, muted olive tones, and combat-inspired silhouettes proved that even at the height of his bandhgala era, SRK could still channel the same devil-may-care energy that made him a star in the first place.

**What Makes SRK's Style Endure**
Unlike stars who chase trends, SRK's fashion evolution has always tracked his own career arc rather than the industry's fads. Each phase feels like a natural extension of where he was as an actor and a public figure, which is why his looks — from the Baazigar leather jacket to the Pathaan bandhgala — remain endlessly referenced by stylists and fans alike, decades after they first appeared on screen.

**CelebStyle recommends:** Recreate SRK's Filmfare 2023 bandhgala look from our Pathaan collection — available in sizes S to XXL, with virtual try-on so you can see exactly how the silver zari detailing catches the light before you order.`,
    coverImage: "/assets/blog/banner-1.png",
    images: [
      "/assets/celebrities/shah-rukh-khan/banner.webp",
      "/assets/outfits/look-luxury-bandhgala/hero.png",
    ],
    category: "Bollywood Style",
    tags: ["SRK", "Bollywood", "Style", "Bandhgala", "Trending"],
    productIds: ["look-shah-rukh-khan-red-carpet", "look-luxury-bandhgala"],
    celebrityId: "shah-rukh-khan",
    authorId: "demo-author-1",
    authorName: "Priya Mehta",
    authorAvatar: "/assets/avatars/avatar-01.png",
    isPublished: true,
    publishedAt: daysAgo(2),
    viewCount: 12847,
    createdAt: daysAgo(3),
    updatedAt: daysAgo(2),
  },
  {
    id: "demo-blog-2",
    slug: "deepika-padukone-fashion-icon",
    title: "Deepika Padukone: How She Became India's Global Style Ambassador",
    summary:
      "From Cannes to Met Gala to Wimbledon — Deepika's fashion choices have made headlines worldwide. Here's everything you need to know.",
    body: `When Deepika Padukone walked the Cannes red carpet in Sabyasachi's ivory column gown, the world took notice. But her journey to global fashion icon status began long before the French Riviera.

Deepika's style DNA is defined by three pillars: confidence, experimentation, and a deep respect for Indian craftsmanship. Whether she's in a Louis Vuitton campaign or the front row at Paris Fashion Week, she brings the same quiet assurance that made her a star.

**The Sabyasachi Connection**
Her long-standing relationship with Sabyasachi Mukherjee has produced some of the most iconic wedding looks in Bollywood history. The crimson Benarasi lehenga she wore for her wedding to Ranveer Singh remains one of the most-searched bridal looks of the decade.

**Global Crossovers**
Deepika's appointment as Louis Vuitton's brand ambassador marked a turning point — she became the first Indian actress in decades to hold such a prominent luxury fashion role. Her looks for LV campaigns, styled with her trademark poise, have been celebrated in Vogue, Harper's Bazaar, and WWD.

**The Cannes Years**
Deepika's multiple appearances at the Cannes Film Festival have become an annual style event in their own right. Each year, her looks balance high drama with restraint — a floor-sweeping gown here, a structured cape there — never veering into costume territory the way some red carpet looks do. Her stylists have spoken about deliberately choosing pieces that photograph as well in motion as they do in a still frame, which is part of why her Cannes looks dominate best-dressed lists within hours of the photos going live.

**Bridging Bollywood and the West**
What sets Deepika apart from other Indian actresses attempting global crossover appeal is that she doesn't abandon her roots to fit Western red carpets — she brings Indian craftsmanship with her. Whether it's a Sabyasachi silhouette reimagined for Cannes or a temple jewellery-inspired accessory paired with a Western gown, her styling team consistently finds ways to make Indian design language feel completely at home on any global stage.

**The Business Power Suit**
Away from red carpets, Deepika's appearances as a producer and businesswoman have introduced another dimension to her style: the structured power suit. Tailored blazers in muted tones, paired with minimal jewellery, signal a deliberate shift from "movie star" to "industry leader" — a wardrobe choice that has influenced how young professional women in India think about dressing for boardrooms.

**Everyday Deepika**
Perhaps most influential of all is her off-duty style — oversized shirts, relaxed denims, and classic white sneakers, photographed at airports and coffee runs. It's proof that a global fashion icon doesn't need to be dressed up at all times, and it's arguably the version of her style that's most imitated by everyday shoppers looking for effortless, put-together basics.

**A Blueprint for the Next Generation**
Younger Indian actresses navigating their own global ambitions increasingly cite Deepika's approach as the template to follow — not simply wearing international labels, but insisting that Indian craft travel with them wherever they go. That balance of ambition and rootedness is arguably her most lasting contribution to how Indian fashion is perceived on the world stage.

**Shop her looks on CelebStyle** — including the Cannes-inspired ivory gown and her signature Sabyasachi lehenga replica, both available with our virtual try-on so you can preview the drape and fit before ordering.`,
    coverImage: "/assets/blog/banner-2.png",
    images: [
      "/assets/celebrities/deepika-padukone/banner.webp",
      "/assets/outfits/look-festive-reception-gown/hero.png",
    ],
    category: "Global Fashion",
    tags: ["Deepika", "Bollywood", "Fashion", "Sabyasachi", "Cannes"],
    productIds: ["look-festive-reception-gown", "look-deepika-padukone-wedding"],
    celebrityId: "deepika-padukone",
    authorId: "demo-author-2",
    authorName: "Arjun Kapoor",
    authorAvatar: "/assets/avatars/avatar-02.png",
    isPublished: true,
    publishedAt: daysAgo(5),
    viewCount: 9341,
    createdAt: daysAgo(6),
    updatedAt: daysAgo(5),
  },
  {
    id: "demo-blog-3",
    slug: "top-10-traditional-wedding-looks-2024",
    title: "Top 10 Celebrity Traditional Wedding Looks of 2024",
    summary:
      "India's biggest stars set wedding fashion trends in 2024. From velvet sherawanies to silk Kanjeevaram sarees — here are the looks everyone was talking about.",
    body: `Indian weddings are a festival of fashion, and 2024 was no exception. Celebrities set the bar impossibly high with bespoke bridal and groomal looks that filtered down to real weddings across the country.

**1. The Velvet Sherwani Revival**
Several top Bollywood actors opted for rich jewel-toned velvet sherwanis this wedding season, channeling the grandeur of Mughal courts with modern cuts.

**2. Pastel Lehenga Dominance**
Gone are the days of exclusively red bridal wear. Pastels — dusty rose, sage green, lavender — dominated celebrity bridal looks in 2024.

**3. The Return of Zardozi**
Heavy zardozi embroidery made a triumphant comeback on both sherwanis and lehengas, with artisans from Lucknow and Varanasi seeing a surge in custom orders.

**4. Minimal Bridal Jewellery**
In contrast to the heavy embroidery, many brides opted for cleaner jewellery: a single statement maang tikka instead of the traditional full set.

**5. Sustainable Heirlooms**
The most talked-about trend was the revival of heirloom pieces — brides and grooms incorporating vintage sarees, dupattas, and jewellery into their wedding looks.

**6. Regional Silhouettes Go Pan-India**
2024 also saw a genuine cross-pollination of regional wedding wear. Kanjeevaram silks traditionally worn in the south showed up at Punjabi wedding receptions, while Bengali Tant sarees found fans among Gujarati brides. Celebrities documenting multi-city, multi-ceremony weddings on social media accelerated this trend, giving audiences across India direct exposure to styles they might never have encountered otherwise.

**7. The Rise of the Co-ord Groom Set**
Grooms embraced matching co-ord sets — a kurta and bottom cut from the exact same fabric and embroidery — as an alternative to the traditional sherwani-and-churidar pairing. It reads as slightly more contemporary while still respecting ceremonial dress codes, and tailors reported a significant uptick in requests for this silhouette through the back half of the year.

**8. Statement Dupattas**
As bridal necklines got simpler, dupattas got bolder. Heavily bordered, contrast-coloured, and sometimes embroidered with the couple's initials or wedding date, the dupatta became its own statement piece rather than an afterthought draped over the shoulder.

**9. Destination Wedding Palettes**
For beach and hill-station weddings, celebrities favoured lighter fabrics in unconventional bridal colours — powder blue, seafoam, and champagne — that photographed beautifully against natural backdrops without sacrificing the formality expected of Indian wedding wear.

**10. The Comeback of the Waistcoat**
Bridal-party menswear saw waistcoats return in a big way — worn over kurtas for daytime functions and over shirts for cocktail evenings, offering a lighter, more breathable alternative to full sherwanis during peak wedding season.

Every trend on this list points to the same underlying shift: 2024's wedding fashion rewarded personalisation over convention. Whether it was a groom mixing regional silhouettes or a bride pairing an heirloom dupatta with contemporary jewellery, the most photographed looks of the year were the ones that felt specific to the couple wearing them.

**Planning Your Own Wedding Wardrobe**
Whichever trend speaks to you, the biggest lesson from 2024's celebrity weddings is to start with the ceremony's mood and setting before choosing embellishment level or colour. A daytime haldi calls for a completely different silhouette than an evening reception, and the celebrities who dressed best this year were the ones who let each function dictate its own look rather than repeating a single aesthetic across the entire wedding calendar.

Browse all our traditional wedding looks on CelebStyle and book a virtual try-on to see how they look on you!`,
    coverImage: "/assets/blog/banner-3.png",
    images: [
      "/assets/banners/wedding-banner.webp",
      "/assets/outfits/look-festive-sangeet-lehenga/hero.png",
    ],
    category: "Wedding Trends",
    tags: ["Wedding", "Traditional", "Lehenga", "Sherwani", "Bridal", "2024"],
    productIds: ["look-festive-wedding-sherwani", "look-festive-sangeet-lehenga"],
    celebrityId: null,
    authorId: "demo-author-1",
    authorName: "Priya Mehta",
    authorAvatar: "/assets/avatars/avatar-03.png",
    isPublished: true,
    publishedAt: daysAgo(8),
    viewCount: 22103,
    createdAt: daysAgo(9),
    updatedAt: daysAgo(8),
  },
  {
    id: "demo-blog-4",
    slug: "virtual-tryon-guide-celebstyle",
    title: "How to Get the Most from CelebStyle's Virtual Try-On",
    summary:
      "Our AI-powered try-on feature lets you see exactly how a celebrity look fits your body before you buy. Here's everything you need to know.",
    body: `CelebStyle's Virtual Try-On is the most accurate fashion preview tool available in India — and it runs entirely on your device, with no data ever leaving your browser. Here's how to get the best experience.

**Camera Mode**
For live try-on, make sure you're in a well-lit room with your full upper body visible. Stand about 2 metres from your camera. The AI will detect your shoulders and body proportions in real time.

*Tips:*
- Wear form-fitting clothes under the overlay for the most realistic preview
- Use the "Mirror" button to see yourself as you'd appear in a mirror
- Switch to rear camera on mobile for higher resolution

**Upload Photo Mode**
Prefer a static preview? Upload a full-body photo and the AI will map the garment to your body. This mode works even without camera access.

*Best practices for upload mode:*
- Use a photo where you're standing straight, facing forward
- Natural lighting produces the most accurate colour match
- Full-body photos give the best garment placement

**Saving Your Try-On**
Use the countdown capture (◎ button) to save a clean screenshot. Download via the ↓ button.

**Outfit Composer**
Build a full look by adding multiple pieces — top, bottom, jacket, shoes, accessories. The AI scores your outfit on colour harmony, occasion fit, and trending score.

**Why Virtual Try-On Beats Guessing**
Online fashion shopping has always had one fundamental problem: you can't feel the fabric or see the fit until it arrives at your door. Returns driven by "it didn't look like the photos" remain one of the biggest costs in Indian e-commerce fashion. Virtual Try-On closes that gap by giving you a realistic preview of drape, proportion, and colour against your own body — not a model's — before you commit to a purchase.

**Getting Accurate Body Detection**
The accuracy of your preview depends heavily on the initial setup. Beyond lighting and distance, make sure your camera is roughly at chest height rather than angled up or down, which can distort proportions. If you're using a phone, prop it against a stable surface rather than holding it — even small amounts of camera shake can affect how precisely the AI maps garment edges to your silhouette.

**Choosing the Right Size Before You Try On**
Pair Virtual Try-On with our Size Recommendation tool for the most accurate preview. Entering your measurements once means every future try-on session automatically renders the garment at your correct size, rather than a generic default that might not reflect how the outfit will actually fit.

**Common Questions**
*Does this work for sarees and dupattas?* Yes — the AI handles draped garments differently from stitched ones, accounting for how fabric falls rather than treating them as rigid shapes.
*Can I try on multiple outfits and compare?* Yes — save multiple screenshots and use the side-by-side comparison in your Wardrobe's Try-On History tab.
*Is my photo stored anywhere?* No — all processing happens locally in your browser session and nothing is uploaded to our servers unless you explicitly choose to save a screenshot to your account.

**Getting the Most Out of Every Session**
Treat Virtual Try-On the way you'd treat an actual fitting room visit: try a few genuinely different silhouettes rather than five variations of the same cut, and use the countdown capture to build a personal lookbook you can revisit before big occasions. The more you use it, the better a sense you'll build of which categories and colours consistently work for your body type.`,
    coverImage: "/assets/blog/banner-4.png",
    images: [
      "/assets/banners/home-hero.webp",
      "/assets/banners/red-carpet-banner.webp",
    ],
    category: "Try-On Guide",
    tags: ["TryOn", "AR", "HowTo", "VirtualFashion", "CelebStyle"],
    productIds: [],
    celebrityId: null,
    authorId: "demo-author-3",
    authorName: "CelebStyle Team",
    authorAvatar: "/assets/avatars/avatar-01.png",
    isPublished: true,
    publishedAt: daysAgo(12),
    viewCount: 15672,
    createdAt: daysAgo(13),
    updatedAt: daysAgo(12),
  },
  {
    id: "demo-blog-5",
    slug: "sabyasachi-collection-2024-review",
    title: "Sabyasachi SS24 Collection: Royal Bengal Meets Modern India",
    summary:
      "Sabyasachi Mukherjee's Spring/Summer 2024 collection draws on Bengal's royal heritage with contemporary silhouettes. We review every look.",
    body: `Sabyasachi's Spring/Summer 2024 collection, unveiled at his Calcutta flagship, is a love letter to Bengal's artistic heritage. Titled 'Royal Bengal', the 45-piece collection weaves together Baluchari weaves, terracotta motifs, and Kantha embroidery with modern draping.

**Standout Pieces**
The ivory Banarasi tissue lehenga with hand-stitched Bengal motifs opened the show and set the tone — majestic but wearable. The collection also featured a range of men's kurta sets in earthy tones that would translate beautifully to both wedding and festival contexts.

**Price Point**
As expected from India's most celebrated couturier, prices range from ₹85,000 for lighter kurta sets to ₹5 lakh+ for the heavily embroidered bridal pieces. CelebStyle offers faithful replicas starting at ₹18,999.

**The Jewellery**
Sabyasachi's jewellery line — bangles, necklaces, and maang tikas in oxidised silver with semi-precious stones — paired perfectly with the muted colour palette.

**The Textile Story**
What makes this collection stand apart from Sabyasachi's previous work is how deliberately it foregrounds Bengal's textile heritage rather than treating it as decoration. Baluchari weaves — traditionally used for saree borders depicting mythological scenes — were reworked into blouse panels and dupatta borders for the first time in his archive. The result feels less like a bridal collection borrowing from craft, and more like the craft itself being given a runway.

**Menswear Deserves More Attention**
While bridal pieces inevitably dominate the conversation, the men's kurta sets in 'Royal Bengal' quietly did some of the collection's most interesting work. Cut with a slightly shorter length than the traditional silhouette and paired with narrow-leg trousers, they felt distinctly modern while still using the same hand-block-printed cottons that define Sabyasachi's heritage lines. Expect to see this silhouette copied widely across the bridal menswear market over the next year.

**How It Compares to Previous Collections**
Against Sabyasachi's 2022 and 2023 bridal lines, 'Royal Bengal' is noticeably more restrained in embellishment while being more ambitious in textile technique. Where past collections leaned on heavy zardozi as the primary showstopper, this one lets the weave itself carry the visual weight — a shift that critics have read as a maturing of the label's design language rather than a simple seasonal refresh.

**Who This Collection Is For**
Given the price point, 'Royal Bengal' is squarely aimed at brides planning at least one heavily ceremonial event — a wedding day look or a reception centrepiece — rather than an entire trousseau. For everyday festive wear, the lighter kurta sets and dupattas offer a more accessible entry point into the aesthetic without the five-figure investment.

**Styling It for Real Weddings**
Even brides who can't stretch to the full couture price point can borrow the collection's core lesson: let one exceptional textile moment — a heavily worked border, a hand-embroidered panel — anchor the outfit, and keep everything else around it deliberately simple. It's a more sustainable and more elegant approach than layering embellishment on embellishment, and it's exactly why CelebStyle's replica pieces from this collection focus on faithfully recreating that one standout textile detail.

**Verdict: 5/5**
A collection that reinforces why Sabyasachi remains the gold standard of Indian bridal fashion — not because it's the most ornate option on the market, but because it treats regional craft as the main event rather than a footnote.`,
    coverImage: "/assets/blog/banner-5.png",
    images: [
      "/assets/banners/luxury-banner.webp",
      "/assets/collections/luxury-atelier/cover.webp",
    ],
    category: "Designer Spotlight",
    tags: ["Sabyasachi", "Bridal", "SS24", "Lehenga", "Review"],
    productIds: ["look-luxury-crystal-lehenga"],
    celebrityId: null,
    authorId: "demo-author-2",
    authorName: "Arjun Kapoor",
    authorAvatar: "/assets/avatars/avatar-02.png",
    isPublished: true,
    publishedAt: daysAgo(15),
    viewCount: 8920,
    createdAt: daysAgo(16),
    updatedAt: daysAgo(15),
  },
  {
    id: "demo-blog-6",
    slug: "tollywood-style-guide-prabhas-allu-arjun",
    title: "Tollywood Style Guide: Prabhas, Allu Arjun and the Rise of South Indian Fashion",
    summary:
      "Telugu cinema stars are setting fashion trends that rival Bollywood. From Allu Arjun's street style to Prabhas's regal sherwanis — here's the complete guide.",
    body: `The fashion world used to look north for trend-setting. Not anymore. Tollywood stars have built massive style followings that now rival — and in some cases surpass — their Bollywood counterparts.

**Allu Arjun: The People's Style Icon**
Allu Arjun's fashion evolution from flamboyant early films to the nuanced, character-driven choices in Pushpa has been remarkable. His off-screen style — understated luxury with streetwear accents — has spawned thousands of imitation looks.

**Prabhas: Royal Simplicity**
Where Allu Arjun goes bold, Prabhas embraces restraint. His love for Anand Bhaskar's classic kurtas and well-fitted sherwanis has made him a reference point for grooms looking for effortless elegance.

**Jr. NTR: Fashion Forward**
Junior NTR's RRR promotional looks sparked a pan-India conversation about traditional Indian formalwear for young men. The printed kurta sets and dhoti combinations he wore during the promotions sold out within weeks.

**Why Tollywood's Rise Matters**
Part of what makes Tollywood's fashion influence so significant is reach. Pushpa and RRR weren't just regional hits — they were dubbed, marketed, and consumed pan-India and internationally, meaning their stars' wardrobe choices got exposure that used to be reserved almost exclusively for Bollywood A-listers. That shift has real consequences for how fashion trends now spread: a look that debuts at a Hyderabad premiere can be trending on Mumbai social media by the next morning.

**The Character-First Approach**
Unlike red carpet dressing built purely around personal branding, much of Tollywood's biggest style moments stay tethered to character. Allu Arjun's Pushpa looks work specifically because they echo the character's rustic, red-sandalwood-smuggler aesthetic; Rana Daggubati's and Ram Charan's RRR-era looks borrowed period-appropriate silhouettes rather than modern red-carpet trends. This character-first approach gives Tollywood style a narrative depth that purely personality-driven fashion often lacks.

**Regional Craft on a National Stage**
Alongside the individual style icons, Tollywood's rise has put a spotlight on Andhra and Telangana textile traditions — ikat weaves, Pochampally silks, and Kalamkari prints — that hadn't previously had this level of national visibility. Stylists working with Tollywood stars have increasingly leaned into these regional textiles for red-carpet and premiere looks, giving audiences a reason to seek out crafts they might never have encountered through Bollywood alone.

**What to Expect Next**
With more Telugu productions eyeing global theatrical releases, expect the fashion crossover to accelerate further. Costume designers on these films are already being credited and interviewed the way Bollywood stylists have been for years — a sign that Tollywood's influence on Indian fashion conversation is far from a passing moment.

**A Style Conversation Without Borders**
Ten years ago, "pan-India cinema" wasn't really a phrase anyone used. Today it describes both a box-office strategy and a fashion phenomenon, and Tollywood's style icons are at the centre of it — proof that great costuming and confident personal style travel just as far as a great story does. As more Telugu stars sign pan-India projects and international brand deals, expect their off-screen wardrobes to keep drawing the same scrutiny and imitation once reserved almost exclusively for Bollywood's biggest names.

**Get the Look**
Browse our Tollywood collection on CelebStyle — from Pushpa-inspired casual looks to RRR premiere-ready outfits, all available with virtual try-on.`,
    coverImage: "/assets/blog/banner-6.png",
    images: [
      "/assets/celebrities/allu-arjun/banner.webp",
      "/assets/outfits/look-prabhas-bahubali/hero.png",
    ],
    category: "Regional Cinema",
    tags: ["Tollywood", "Prabhas", "AlluArjun", "JrNTR", "Style", "South"],
    productIds: ["look-allu-arjun-pushpa", "look-prabhas-bahubali"],
    celebrityId: "allu-arjun",
    authorId: "demo-author-1",
    authorName: "Priya Mehta",
    authorAvatar: "/assets/avatars/avatar-03.png",
    isPublished: true,
    publishedAt: daysAgo(20),
    viewCount: 19234,
    createdAt: daysAgo(21),
    updatedAt: daysAgo(20),
  },
  {
    id: "demo-blog-7",
    slug: "ranveer-singh-boldest-dresser-bollywood",
    title: "Ranveer Singh: Bollywood's Boldest Dresser and How to Wear His Looks",
    summary:
      "From gully boy streetwear to zardozi sherwanis, Ranveer Singh treats every red carpet like a runway. We break down his signature style codes.",
    body: `No one in Indian cinema takes more sartorial risks than Ranveer Singh — and somehow, he makes it work every single time. Where most A-listers play it safe on the red carpet, Ranveer treats fashion as performance art, and audiences can't look away.

**The Gully Boy Effect**
Ranveer's breakout style moment came with Gully Boy, where his off-screen wardrobe started mirroring the film's street-smart energy — bomber jackets, statement sneakers, and layered chains. That look resonated so strongly with young Indian men that CelebStyle still sees search spikes for "Gully Boy jacket" every few months.

**Indo-Western Fusion, Perfected**
What sets Ranveer apart from other bold dressers is his command over Indo-Western silhouettes. A bandhgala jacket paired with tailored trousers, or a Nehru-collar blazer over a kurta — he treats traditional Indian tailoring as a canvas rather than a costume. This fusion approach has influenced an entire generation of wedding-guest dressing, moving men away from safe black suits toward colour and texture.

**The Zardozi Sherwani Moment**
His wedding to Deepika Padukone introduced the world to a masterclass in groom dressing: a heavily embroidered zardozi sherwani in deep ivory, finished with a traditional safa. It became one of the most replicated groom looks of the year, and remains one of CelebStyle's best-selling sherwani styles.

**How to Wear It Without Overdoing It**
The trick to channeling Ranveer's energy without looking costume-y is to pick ONE bold element per outfit — a statement jacket, a bright colour, or ornate embroidery — and keep everything else tailored and clean. Confidence, as Ranveer proves daily, is the real accessory.

**The Colour Fearlessness Factor**
While most Bollywood leading men default to black, navy, and grey for red-carpet appearances, Ranveer treats colour as a core part of his identity — cobalt blue tuxedos, canary yellow bandhgalas, even head-to-toe pastel ensembles that would look costume-like on almost anyone else. Stylists point to his willingness to commit fully to a colour story, rather than adding it as a small accent, as the real differentiator. A half-hearted pop of colour reads as an accessory; Ranveer's full commitment reads as a statement.

**Accessorising Like Ranveer**
Where most men treat accessories as an afterthought, Ranveer uses them as the finishing exclamation point on an outfit — oversized statement rings, layered chains, and the occasional brooch pinned to a lapel. The lesson for anyone borrowing from his playbook isn't to buy everything at once, but to choose one strong accessory and let it do the work, rather than overwhelming a look with too many competing pieces.

**A Style That Ages With Him**
What's notable about Ranveer's fashion journey is that his boldness hasn't mellowed with age or box-office pressure the way it does for many stars once they hit leading-man status. If anything, his choices have become more confident and more specific over time, suggesting his style is a genuine extension of his personality rather than a calculated persona — which is exactly why fans keep responding to it.

**Shop the Look**
Explore our Ranveer-inspired edit, from his Gully Boy-era streetwear to the wedding-ready zardozi sherwani, all available with virtual try-on so you can see the fit before you commit to the boldness.`,
    coverImage: "/assets/celebrities/ranveer-singh/banner.webp",
    images: [
      "/assets/outfits/look-ranveer-singh-gully-boy/hero.png",
      "/assets/outfits/look-luxury-zardosi-sherwani/hero.png",
    ],
    category: "Bollywood Style",
    tags: ["RanveerSingh", "Bollywood", "IndoWestern", "Sherwani", "Trending"],
    productIds: ["look-ranveer-singh-gully-boy", "look-luxury-zardosi-sherwani", "look-luxury-indo-western"],
    celebrityId: "ranveer-singh",
    authorId: "demo-author-2",
    authorName: "Arjun Kapoor",
    authorAvatar: "/assets/avatars/avatar-06.png",
    isPublished: true,
    publishedAt: daysAgo(4),
    viewCount: 14209,
    createdAt: daysAgo(5),
    updatedAt: daysAgo(4),
  },
  {
    id: "demo-blog-8",
    slug: "kgf-to-kantara-sandalwood-style-renaissance",
    title: "KGF to Kantara: The Sandalwood Style Renaissance",
    summary:
      "Kannada cinema's biggest exports aren't just box-office numbers — Yash's KGF swagger and Rishab Shetty's earthy Kantara aesthetic are reshaping pan-India style.",
    body: `For years, Sandalwood (the Kannada film industry) flew under the radar of India's fashion conversation. That changed the moment Yash walked on screen as Rocky Bhai in KGF, and it's been rewritten again with Rishab Shetty's raw, rooted look in Kantara.

**Rocky Bhai: Rugged Maximalism**
Yash's KGF persona popularised a very specific silhouette — open shirts, heavy jewellery, layered jackets, and an unapologetic swagger that felt like nothing else on Indian screens at the time. Off-screen, Yash has translated this into a more refined version: sharp black-on-black formalwear with just enough edge to still feel like Rocky Bhai underneath the polish.

**Kantara and the Return of the Rustic**
Rishab Shetty's Kantara flipped the script entirely. Instead of glamour, the film — and Shetty's own promotional wardrobe — leaned into earthy, artisanal clothing: handwoven cottons, natural dyes, and silhouettes rooted in coastal Karnataka's Bhoota Kola tradition. It sparked a genuine appreciation for regional textile craft that Bollywood's red carpets rarely showcase.

**Why This Matters for Indian Fashion**
Sandalwood's rise signals something bigger: audiences are responding to authenticity over polish. Whether it's Rocky Bhai's larger-than-life bravado or Kantara's grounded rusticity, both looks succeed because they feel specific to a story and a place, not manufactured for a red carpet.

**Bringing It Into Your Wardrobe**
You don't need a gold chain collection to borrow from KGF energy — a well-tailored dark jacket with minimal accessories captures the mood. For Kantara-inspired dressing, look for handloom kurtas in earthy tones with minimal embellishment.

**The Business Suit Side of Yash**
Away from Rocky Bhai, Yash's public appearances at award shows and brand events reveal a more conventional but equally sharp sensibility — single-breasted suits in deep charcoal and midnight blue, worn with minimal jewellery. It's a deliberate contrast that keeps his on-screen larger-than-life persona from bleeding into every public appearance, and it's a useful reminder that a strong personal brand doesn't require the same aesthetic in every context.

**Kantara's Ripple Effect on Coastal Karnataka Crafts**
Beyond Rishab Shetty's own wardrobe, Kantara's success generated a genuine commercial ripple effect for the handloom weavers and artisans of coastal Karnataka whose techniques inspired the film's costuming. Several small-scale weaving cooperatives reported increased orders in the months following the film's release — a rare instance of a blockbuster's fashion influence translating directly into support for the regional craftspeople who originated the aesthetic.

**Two Icons, One Industry**
Yash and Rishab Shetty represent genuinely different lanes within Sandalwood's current moment — one maximalist and internationally scaled, the other minimalist and culturally specific — and that range is itself part of the story. It shows an industry confident enough to produce global blockbusters and hyper-local passion projects side by side, with fashion following each film's own internal logic rather than a single house style.

**What's Next for Sandalwood Style**
With more Kannada productions gaining national distribution, expect the industry's influence on Indian fashion conversations to keep growing. Costume choices that once stayed regional are now getting the same scrutiny and imitation previously reserved for Bollywood and Tollywood, and Sandalwood shows no signs of slowing that momentum down.

Explore our Sandalwood collection on CelebStyle, featuring KGF-inspired formalwear and Kantara-style handloom pieces, both ready for virtual try-on.`,
    coverImage: "/assets/celebrities/yash-kannada/banner.webp",
    images: [
      "/assets/outfits/look-yash-kgf/hero.png",
      "/assets/outfits/look-rishab-shetty-kantara/hero.png",
    ],
    category: "Regional Cinema",
    tags: ["Sandalwood", "KGF", "Kantara", "Yash", "RishabShetty", "Kannada"],
    productIds: ["look-yash-kgf", "look-rishab-shetty-kantara", "look-yash-kgf-formal"],
    celebrityId: "yash-kannada",
    authorId: "demo-author-1",
    authorName: "Priya Mehta",
    authorAvatar: "/assets/avatars/avatar-07.png",
    isPublished: true,
    publishedAt: daysAgo(7),
    viewCount: 11056,
    createdAt: daysAgo(8),
    updatedAt: daysAgo(7),
  },
  {
    id: "demo-blog-9",
    slug: "hollywood-red-carpet-decoded-zendaya-margot-robbie",
    title: "Hollywood Red Carpet Decoded: Zendaya, Margot Robbie and the Art of Fashion Risk",
    summary:
      "Two of Hollywood's sharpest dressers approach the red carpet completely differently. We decode what makes Zendaya and Margot Robbie's styling teams so effective.",
    body: `Every awards season, two names dominate best-dressed lists for very different reasons: Zendaya, fashion's reigning risk-taker, and Margot Robbie, whose Barbie press tour turned costume dressing into a cultural phenomenon.

**Zendaya: Fashion as Storytelling**
Working with stylist Law Roach, Zendaya treats every red carpet as a narrative moment rather than a single outfit choice. Her looks often reference cinema history, architecture, or even her own past looks, rewarding fans who follow the throughline across an entire awards season. It's a masterclass in using fashion to build a public persona with intention.

**Margot Robbie: The Power of Concept Dressing**
The 2023 Barbie press tour redefined what a movie promotion cycle could look like. Robbie and her stylist recreated iconic Barbie doll outfits — down to the exact shade of pink and the plastic-inspired accessories — for nearly every appearance. It was playful, meticulously researched, and instantly memorable, proving that concept-driven dressing can generate as much conversation as the film itself.

**What They Have in Common**
Despite very different approaches, both stars share one thing: a styling team that treats each appearance as part of a bigger story, not an isolated event. That's the biggest lesson for anyone dressing for a big occasion — think about the full picture, not just one outfit in isolation.

**Bringing Red Carpet Thinking Home**
You don't need a stylist to borrow this mindset. Before a wedding season or a big event calendar, plan your looks together — colour palettes, silhouettes, and accessories that complement each other — rather than choosing each outfit in isolation.

**The Rise of the Stylist as Public Figure**
One underappreciated shift behind both Zendaya's and Robbie's success is how visible their stylists have become. Law Roach built a public persona nearly as recognisable as some of his clients, and Barbie's costume design team gave extensive interviews about their reference research. This transparency has changed how audiences engage with red-carpet fashion — it's no longer just about admiring an outfit, but about understanding the reasoning and craft behind it, which makes the fashion moments themselves more memorable and more analysed than ever before.

**Risk Versus Reliability**
Zendaya and Robbie also illustrate two different philosophies of "getting it right" on a red carpet. Zendaya's approach thrives on unpredictability — you genuinely don't know what reference point she'll pull from next. Robbie's Barbie run, by contrast, built anticipation through reliability — audiences knew roughly what to expect (another perfect Barbie recreation) and the thrill was in the precision of execution rather than the surprise. Both approaches generated equal amounts of conversation, proving there's more than one way to dominate a fashion news cycle.

**What Indian Audiences Can Take From This**
Indian celebrity fashion has its own strong red-carpet tradition, but the Zendaya and Robbie playbooks offer a useful lens: audiences respond as much to intentionality as to individual outfits. A single stunning gown gets admired for a day; a wardrobe that tells a coherent story across an entire promotional cycle gets remembered for years. Expect more Indian stylists to adopt this longer-arc approach as celebrity fashion coverage continues to globalise.

**Building Your Own Red Carpet Moment**
For anyone dressing for a milestone event — a wedding reception, an awards function, a big anniversary party — the biggest takeaway from both stars is to define your "why" before you define your outfit. Once you know the mood or story you want your look to tell, choosing the right silhouette, colour, and accessories becomes far more straightforward.

Browse our Hollywood-inspired red carpet edit on CelebStyle, featuring Zendaya and Margot Robbie-inspired gowns ready for virtual try-on.`,
    coverImage: "/assets/celebrities/zendaya/banner.webp",
    images: [
      "/assets/outfits/look-zendaya-red-carpet/hero.png",
      "/assets/outfits/look-margot-robbie-barbie/hero.png",
    ],
    category: "Global Fashion",
    tags: ["Zendaya", "MargotRobbie", "Hollywood", "RedCarpet", "Style"],
    productIds: ["look-zendaya-red-carpet", "look-margot-robbie-barbie", "look-luxury-french-gown"],
    celebrityId: "zendaya",
    authorId: "demo-author-4",
    authorName: "Meera Iyer",
    authorAvatar: "/assets/avatars/avatar-09.png",
    isPublished: true,
    publishedAt: daysAgo(10),
    viewCount: 17845,
    createdAt: daysAgo(11),
    updatedAt: daysAgo(10),
  },
  {
    id: "demo-blog-10",
    slug: "festive-dressing-2024-festival-by-festival-guide",
    title: "Festive Dressing 2024: A Festival-by-Festival Style Guide",
    summary:
      "From Diwali gold to Onam whites and Pongal's traditional veshti — India's festival calendar calls for very different wardrobes. Here's how celebrities dress for each one.",
    body: `India's festival calendar is a style calendar in disguise — each celebration comes with its own colour language, silhouette, and mood. Celebrities know this better than anyone, and their festive looks offer a genuinely useful style reference for the rest of us.

**Diwali: Gold, Always Gold**
Diwali dressing leans into richness — gold-threaded kurtas, zari-bordered sarees, and jewel tones like deep maroon and emerald that photograph beautifully under diya light. Ranveer Singh's gold-embroidered kurta sets have become a template for festive menswear every October.

**Navratri: Colour as Celebration**
Navratri is the one festival where maximalist colour is not just accepted but expected. Deepika Padukone's mirror-work chaniya cholis capture the spirit perfectly — vibrant, swishy, and built for nine nights of dancing.

**Onam: The Elegance of White and Gold**
Onam flips the festive colour code entirely. The traditional Kerala mundu and kasavu saree — off-white with a gold border — is a study in restraint. Nayanthara's Onam looks consistently favour this understated palette, proving festive dressing doesn't have to be loud to make an impact.

**Pongal: Rooted in Tradition**
Pongal calls for the classic veshti-shirt combination in Tamil Nadu, and stars like Rajinikanth have made the crisp white veshti with a simple angavastram a look that feels both humble and iconic on the biggest stages.

**Durga Puja: Red and White Reign**
In Bengal, Durga Puja dressing is inseparable from the red-and-white Tant saree, worn with minimal gold jewellery. It's one of the most recognisable festive silhouettes in the country.

**Eid: Understated Refinement**
Eid dressing across the country favours pastel and jewel-toned anarkalis and sharara sets, often in delicate chikankari or gota-patti work. Salman Khan's pathani-suit Eid appearances have become an annual style moment, favouring crisp whites and off-whites that photograph beautifully alongside family celebrations.

**Ganesh Chaturthi: Maharashtrian Tradition Meets Festive Colour**
In Maharashtra, Ganesh Chaturthi dressing leans into the traditional dhoti-kurta for men and the classic nauvari saree draping style for women, typically in vibrant yellows, oranges, and greens that echo the festival's celebratory energy.

**Karva Chauth: Red, Always Red**
Karva Chauth remains one of the few festivals where the colour code has barely shifted over decades — red and maroon dominate, often paired with heavy gold jewellery and a matching bindi. It's a look built for close-up moments: the aarti, the moon-sighting, the traditional thali — all of which photograph best in rich, saturated colour.

**Mixing Regional Traditions Respectfully**
As festival celebrations increasingly cross regional lines — a Bengali family celebrating Onam with south Indian friends, or a Punjabi household hosting a Pongal gathering — more people are experimenting with festival dressing outside their own cultural tradition. The general etiquette celebrities model well: lean into the correct silhouette and colour story for that specific festival rather than generically "Indian" festive wear, which signals genuine appreciation rather than costume-like approximation.

**Planning a Festival-Heavy Season**
For anyone facing back-to-back festivals in the same month, the celebrity approach is instructive: build a small capsule of versatile pieces — a good silk kurta, a well-fitted saree blouse, one statement dupatta — that can be restyled with different jewellery and draping for each occasion, rather than buying one look per festival.

**Building Your Festive Wardrobe**
The easiest way to dress for any festival is to start with its signature colour story, then choose a silhouette that lets you move comfortably through a full day of celebration. CelebStyle's festive collection is organised exactly this way — by festival, not just by category — so you can shop the mood, not just the garment.`,
    coverImage: "/assets/banners/festive-banner.webp",
    images: [
      "/assets/collections/festive-edit/cover.webp",
      "/assets/outfits/look-festive-navratri-chaniya/hero.png",
    ],
    category: "Festive Style",
    tags: ["Festive", "Diwali", "Navratri", "Onam", "Pongal", "2024"],
    productIds: [
      "look-festive-diwali-gold-kurta",
      "look-festive-navratri-chaniya",
      "look-festive-onam-saree",
      "look-festive-pongal-veshti",
    ],
    celebrityId: null,
    authorId: "demo-author-3",
    authorName: "CelebStyle Team",
    authorAvatar: "/assets/avatars/avatar-12.png",
    isPublished: true,
    publishedAt: daysAgo(1),
    viewCount: 6218,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
];

// ─── Reviews ──────────────────────────────────────────────────────────────────

export function getDemoReviews(productId: string): DemoReview[] {
  const all: DemoReview[] = [
    {
      id: "demo-rev-1",
      userId: "demo-user-1",
      userName: "Rahul Sharma",
      userAvatar: "/assets/avatars/avatar-08.png",
      productId,
      orderId: "demo-order-1",
      rating: 5,
      title: "Absolutely stunning! Exceeded expectations",
      body: "The fabric quality is exceptional — you can feel the craftsmanship. The stitching is immaculate and the fit is perfect for my body type. I wore this to my cousin's reception and received compliments all evening. Will definitely order again!",
      verified: true,
      images: [],
      helpfulCount: 47,
      helpful: false,
      status: "APPROVED",
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
    {
      id: "demo-rev-2",
      userId: "demo-user-2",
      userName: "Priya Nair",
      userAvatar: "/assets/avatars/avatar-09.png",
      productId,
      orderId: null,
      rating: 4,
      title: "Great quality, slightly longer delivery",
      body: "The outfit itself is gorgeous — colours are vibrant and exactly as shown in the photos. My only feedback is that delivery took 12 days instead of the promised 7-8. But once it arrived, I was very happy. The virtual try-on on this site helped me pick the right size too!",
      verified: false,
      images: [],
      helpfulCount: 23,
      helpful: false,
      status: "APPROVED",
      createdAt: daysAgo(7),
      updatedAt: daysAgo(7),
    },
    {
      id: "demo-rev-3",
      userId: "demo-user-3",
      userName: "Vikram Mehta",
      userAvatar: "/assets/avatars/avatar-10.png",
      productId,
      orderId: "demo-order-2",
      rating: 5,
      title: "Perfect replica — worth every rupee",
      body: "I was sceptical at first about buying a celebrity-inspired outfit online, but this completely changed my mind. The bandhgala is beautifully tailored and the silver zari work is stunning. Wore it to an awards dinner and felt like a million dollars. Highly recommend.",
      verified: true,
      images: [],
      helpfulCount: 61,
      helpful: false,
      status: "APPROVED",
      createdAt: daysAgo(14),
      updatedAt: daysAgo(14),
    },
    {
      id: "demo-rev-4",
      userId: "demo-user-4",
      userName: "Ananya Krishnan",
      userAvatar: "/assets/avatars/avatar-11.png",
      productId,
      orderId: null,
      rating: 4,
      title: "Beautiful but runs slightly large",
      body: "The outfit is gorgeous — the fabric drape is exactly right and the embroidery work is intricate. I ordered a medium but it runs slightly large on me. I'd suggest going a size down if you're between sizes. The CelebStyle team was very helpful when I contacted them about this.",
      verified: false,
      images: [],
      helpfulCount: 35,
      helpful: false,
      status: "APPROVED",
      createdAt: daysAgo(21),
      updatedAt: daysAgo(21),
    },
    {
      id: "demo-rev-5",
      userId: "demo-user-5",
      userName: "Rohan Gupta",
      userAvatar: "/assets/avatars/avatar-04.png",
      productId,
      orderId: "demo-order-3",
      rating: 5,
      title: "My wedding sherwani — perfect in every way",
      body: "Got this for my wedding and it was absolutely perfect. The tailoring is outstanding and the colour saturation is incredible in person — much better than the photos. My wife loved it too. The virtual try-on feature on this site let me preview it before buying, which gave me the confidence to place the order. Couldn't be happier.",
      verified: true,
      images: [],
      helpfulCount: 82,
      helpful: false,
      status: "APPROVED",
      createdAt: daysAgo(30),
      updatedAt: daysAgo(30),
    },
  ];
  return all;
}

// ─── Community Posts ──────────────────────────────────────────────────────────

export const DEMO_COMMUNITY_POSTS: DemoCommunityPost[] = [
  {
    id: "demo-post-1",
    userId: "demo-user-6",
    userName: "StyleQueen_Mumbai",
    userAvatar: "/assets/avatars/avatar-05.png",
    caption:
      "Finally got my Deepika-inspired lehenga from CelebStyle and I'm OBSESSED! The virtual try-on told me to go with the dusty rose and honestly best decision ever 🌸 #CelebStyle #Lehenga #WeddingVibes",
    imageUrl:
      "/assets/community/post-1.png",
    images: [
      {
        id: "demo-img-1",
        url: "/assets/community/post-2.png",
        sortOrder: 0,
      },
    ],
    productId: "look-deepika-padukone-wedding",
    tags: ["Lehenga", "WeddingVibes", "CelebStyle", "Deepika"],
    likeCount: 1234,
    commentCount: 89,
    shares: 64,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
  {
    id: "demo-post-2",
    userId: "demo-user-7",
    userName: "FashionForwardDelhi",
    userAvatar: "/assets/avatars/avatar-06.png",
    caption:
      "My reception look inspired by SRK's Filmfare bandhgala! Used the AR try-on feature — literally couldn't have picked this without seeing it on me first. Thanks @CelebStyle! 🙌 #Bandhgala #Reception #MensFashion",
    imageUrl:
      "/assets/community/post-3.png",
    images: [
      {
        id: "demo-img-2",
        url: "/assets/community/post-4.png",
        sortOrder: 0,
      },
    ],
    productId: "look-shah-rukh-khan-red-carpet",
    tags: ["Bandhgala", "MensFashion", "Reception", "SRK"],
    likeCount: 892,
    commentCount: 56,
    shares: 41,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },
  {
    id: "demo-post-3",
    userId: "demo-user-8",
    userName: "HyderabadFashionista",
    userAvatar: "/assets/avatars/avatar-07.png",
    caption:
      "Prabhas inspired sherwani for my best friend's sangeet! The fabric quality from CelebStyle is unreal — you can feel it's handcrafted. Absolutely worth it! 💙 #Prabhas #Sherwani #Sangeet #Tollywood",
    imageUrl:
      "/assets/community/post-5.png",
    images: [
      {
        id: "demo-img-3",
        url: "/assets/community/post-6.png",
        sortOrder: 0,
      },
    ],
    productId: "look-prabhas-bahubali",
    tags: ["Sherwani", "Sangeet", "Tollywood", "Prabhas"],
    likeCount: 2341,
    commentCount: 145,
    shares: 128,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(4),
    updatedAt: daysAgo(4),
  },
  {
    id: "demo-post-4",
    userId: "demo-user-9",
    userName: "PushpaMoments",
    userAvatar: "/assets/avatars/avatar-08.png",
    caption:
      "Channelling Allu Arjun's energy in this amazing kurta set! 🔥 The embroidery detailing is next level. Using the virtual try-on helped me visualise the full outfit. #AlluArjun #Pushpa #StylishStar #CelebStyle",
    imageUrl:
      "/assets/community/post-7.png",
    images: [
      {
        id: "demo-img-4",
        url: "/assets/community/post-8.png",
        sortOrder: 0,
      },
    ],
    productId: "look-allu-arjun-pushpa",
    tags: ["AlluArjun", "Pushpa", "StylishStar", "Kurta"],
    likeCount: 4782,
    commentCount: 312,
    shares: 276,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(6),
    updatedAt: daysAgo(6),
  },
  {
    id: "demo-post-5",
    userId: "demo-user-10",
    userName: "BridalDreamsAhmedabad",
    userAvatar: "/assets/avatars/avatar-09.png",
    caption:
      "My bridal lehenga arrived and it's even more beautiful than the virtual try-on showed! The Benarasi silk is exquisite. Couldn't have chosen without the AR feature. Thank you CelebStyle 🧡 #Bride #BenaraSilk #WeddingSeason",
    imageUrl:
      "/assets/community/post-1.png",
    images: [
      {
        id: "demo-img-5",
        url: "/assets/community/post-2.png",
        sortOrder: 0,
      },
    ],
    productId: "look-aishwarya-rai-devdas",
    tags: ["Bride", "Lehenga", "WeddingSeason", "BridalVibes"],
    likeCount: 6123,
    commentCount: 423,
    shares: 389,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
  },
  {
    id: "demo-post-6",
    userId: "demo-user-11",
    userName: "KollywoodKumar",
    userAvatar: "/assets/avatars/avatar-10.png",
    caption:
      "Rajinikanth-inspired veshti-shirt combo for Pongal at home! Looked amazing on the virtual try-on and even better in person 😎 #Rajinikanth #Pongal #Kollywood #CelebStyle",
    imageUrl:
      "/assets/community/post-3.png",
    images: [
      {
        id: "demo-img-6",
        url: "/assets/community/post-4.png",
        sortOrder: 0,
      },
    ],
    productId: "look-festive-pongal-veshti",
    tags: ["Rajinikanth", "Pongal", "Kollywood", "VeshtiStyle"],
    likeCount: 3487,
    commentCount: 198,
    shares: 201,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(11),
    updatedAt: daysAgo(11),
  },
  {
    id: "demo-post-7",
    userId: "demo-user-12",
    userName: "DelhiBrideToBeRohan",
    userAvatar: "/assets/avatars/avatar-11.png",
    caption:
      "Sherwani shopping made EASY with CelebStyle's virtual try-on 💙 Tried 8 different looks from my couch. No stepping into overpriced boutiques. Ordered this beauty and it arrived in 9 days! #Sherwani #GroomPrep #Groom",
    imageUrl:
      "/assets/community/post-5.png",
    images: [
      {
        id: "demo-img-7",
        url: "/assets/community/post-6.png",
        sortOrder: 0,
      },
    ],
    productId: "look-festive-wedding-sherwani",
    tags: ["Sherwani", "Groom", "GroomPrep", "WeddingFashion"],
    likeCount: 1876,
    commentCount: 103,
    shares: 97,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(15),
    updatedAt: daysAgo(15),
  },
  {
    id: "demo-post-8",
    userId: "demo-user-13",
    userName: "PriyaMumbaiStylist",
    userAvatar: "/assets/avatars/avatar-04.png",
    caption:
      "Style tip: the AR try-on feature shows you how a lehenga moves, not just how it looks static. Game changer for bridal shopping! Used it to pick this Sabyasachi-inspired silk for my client 🌟 #StylistLife #Sabyasachi #BridalShopping",
    imageUrl:
      "/assets/community/post-7.png",
    images: [
      {
        id: "demo-img-8",
        url: "/assets/community/post-8.png",
        sortOrder: 0,
      },
    ],
    productId: "look-festive-sangeet-lehenga",
    tags: ["StylistLife", "Sabyasachi", "BridalShopping", "Lehenga"],
    likeCount: 2954,
    commentCount: 187,
    shares: 156,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(18),
    updatedAt: daysAgo(18),
  },

  // ── Festive Style Challenge entries (contest) ─────────────────────────────
  {
    id: "demo-post-9",
    userId: "demo-user-14",
    userName: "DiwaliDiva_Pune",
    userAvatar: "/assets/avatars/avatar-13.png",
    caption:
      "Entry for the #FestiveStyleChallenge 🪔 Recreated Ranveer's gold-embroidered Diwali kurta and the AR try-on nailed the drape before I even ordered! Fingers crossed for the win #FestiveStyleChallenge #Diwali #Contest",
    imageUrl: "/assets/outfits/look-festive-diwali-gold-kurta/hero.png",
    images: [{ id: "demo-img-9", url: "/assets/outfits/look-festive-diwali-gold-kurta/detail1.jpg", sortOrder: 0 }],
    productId: "look-festive-diwali-gold-kurta",
    tags: ["FestiveStyleChallenge", "contest", "Diwali", "RanveerSingh"],
    likeCount: 1543,
    commentCount: 92,
    shares: 88,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
  },
  {
    id: "demo-post-10",
    userId: "demo-user-15",
    userName: "NavratriNoor",
    userAvatar: "/assets/avatars/avatar-14.png",
    caption:
      "My #FestiveStyleChallenge entry — Deepika's mirror-work chaniya choli recreated for all nine nights of garba! Danced in this for 4 hours straight and it held up perfectly 💃 #Navratri #Contest #CelebStyle",
    imageUrl: "/assets/outfits/look-festive-navratri-chaniya/hero.png",
    images: [{ id: "demo-img-10", url: "/assets/outfits/look-festive-navratri-chaniya/detail1.jpg", sortOrder: 0 }],
    productId: "look-festive-navratri-chaniya",
    tags: ["FestiveStyleChallenge", "contest", "Navratri", "Deepika"],
    likeCount: 2087,
    commentCount: 134,
    shares: 119,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
  },
  {
    id: "demo-post-11",
    userId: "demo-user-16",
    userName: "OnamOptics_Kochi",
    userAvatar: "/assets/avatars/avatar-15.png",
    caption:
      "#FestiveStyleChallenge entry from Kochi 🌼 Nayanthara's kasavu saree look, styled for Onam sadya. Simple, elegant, and the gold border photographs beautifully. #Onam #Contest #Kerala",
    imageUrl: "/assets/outfits/look-festive-onam-saree/hero.png",
    images: [{ id: "demo-img-11", url: "/assets/outfits/look-festive-onam-saree/detail1.jpg", sortOrder: 0 }],
    productId: "look-festive-onam-saree",
    tags: ["FestiveStyleChallenge", "contest", "Onam", "Nayanthara"],
    likeCount: 1298,
    commentCount: 77,
    shares: 63,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },
  {
    id: "demo-post-12",
    userId: "demo-user-17",
    userName: "PongalPrideChennai",
    userAvatar: "/assets/avatars/avatar-01.png",
    caption:
      "Submitting this for the #FestiveStyleChallenge — Rajinikanth-style veshti and angavastram for Pongal. My grandfather said I wore it better than he did 😂 #Pongal #Contest #TamilNadu",
    imageUrl: "/assets/outfits/look-festive-pongal-veshti/hero.png",
    images: [{ id: "demo-img-12", url: "/assets/outfits/look-festive-pongal-veshti/detail1.jpg", sortOrder: 0 }],
    productId: "look-festive-pongal-veshti",
    tags: ["FestiveStyleChallenge", "contest", "Pongal", "Rajinikanth"],
    likeCount: 987,
    commentCount: 54,
    shares: 41,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },

  // ── Wedding Look Contest 2024 entries (contest) ───────────────────────────
  {
    id: "demo-post-13",
    userId: "demo-user-18",
    userName: "RadhikaWeds2024",
    userAvatar: "/assets/avatars/avatar-02.png",
    caption:
      "My #WeddingLookContest2024 entry! My husband wore Hrithik's War-inspired sherwani for our wedding and honestly he's never looked better. Virtual try-on saved us three boutique visits. #Wedding #Contest #Sherwani",
    imageUrl: "/assets/outfits/look-festive-wedding-sherwani/hero.png",
    images: [{ id: "demo-img-13", url: "/assets/outfits/look-festive-wedding-sherwani/detail1.jpg", sortOrder: 0 }],
    productId: "look-festive-wedding-sherwani",
    tags: ["WeddingLookContest2024", "contest", "Sherwani", "HrithikRoshan"],
    likeCount: 3210,
    commentCount: 211,
    shares: 178,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
  },
  {
    id: "demo-post-14",
    userId: "demo-user-19",
    userName: "SnehaBridalDiaries",
    userAvatar: "/assets/avatars/avatar-03.png",
    caption:
      "#WeddingLookContest2024 entry — Kiara Advani's Shershaah sangeet lehenga recreated for my own sangeet night! The AR try-on let me test three colourways before deciding on this one 💕 #Bridal #Contest #Lehenga",
    imageUrl: "/assets/outfits/look-festive-sangeet-lehenga/hero.png",
    images: [{ id: "demo-img-14", url: "/assets/outfits/look-festive-sangeet-lehenga/detail1.jpg", sortOrder: 0 }],
    productId: "look-festive-sangeet-lehenga",
    tags: ["WeddingLookContest2024", "contest", "Sangeet", "KiaraAdvani"],
    likeCount: 4102,
    commentCount: 267,
    shares: 231,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
  },
  {
    id: "demo-post-15",
    userId: "demo-user-20",
    userName: "ArjunGroomStyle",
    userAvatar: "/assets/avatars/avatar-04.png",
    caption:
      "Entering the #WeddingLookContest2024 with my bhai-dooj look inspired by Ranbir Kapoor — deep maroon kurta with a modern cut. Got so many compliments at the function! #Groom #Contest #CelebStyle",
    imageUrl: "/assets/outfits/look-festive-bhai-dooj-kurta/hero.png",
    images: [{ id: "demo-img-15", url: "/assets/outfits/look-festive-bhai-dooj-kurta/detail1.jpg", sortOrder: 0 }],
    productId: "look-festive-bhai-dooj-kurta",
    tags: ["WeddingLookContest2024", "contest", "Kurta", "RanbirKapoor"],
    likeCount: 1654,
    commentCount: 98,
    shares: 72,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(4),
    updatedAt: daysAgo(4),
  },
  {
    id: "demo-post-16",
    userId: "demo-user-21",
    userName: "MeeraBanarasiBride",
    userAvatar: "/assets/avatars/avatar-05.png",
    caption:
      "My #WeddingLookContest2024 submission — Aishwarya Rai's Devdas-inspired organza saree for my reception. The zari work is unbelievable in person. This is the one, I just know it 🏆 #Bridal #Contest #Saree",
    imageUrl: "/assets/outfits/look-luxury-organza-saree/hero.png",
    images: [{ id: "demo-img-16", url: "/assets/outfits/look-luxury-organza-saree/detail1.jpg", sortOrder: 0 }],
    productId: "look-luxury-organza-saree",
    tags: ["WeddingLookContest2024", "contest", "Saree", "AishwaryaRai"],
    likeCount: 2876,
    commentCount: 176,
    shares: 143,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(4),
    updatedAt: daysAgo(4),
  },

  // ── Red Carpet Recreation Contest entries (contest) ───────────────────────
  {
    id: "demo-post-17",
    userId: "demo-user-22",
    userName: "RedCarpetReeta",
    userAvatar: "/assets/avatars/avatar-06.png",
    caption:
      "#RedCarpetRecreation entry: Zendaya's red carpet gown recreated for my cousin's engagement party. Felt like I actually walked a red carpet lol. Try-on preview matched the real thing perfectly ✨ #Contest #Zendaya",
    imageUrl: "/assets/outfits/look-zendaya-red-carpet/hero.png",
    images: [{ id: "demo-img-17", url: "/assets/outfits/look-zendaya-red-carpet/detail1.jpg", sortOrder: 0 }],
    productId: "look-zendaya-red-carpet",
    tags: ["RedCarpetRecreation", "contest", "Zendaya", "Hollywood"],
    likeCount: 1789,
    commentCount: 112,
    shares: 94,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(6),
    updatedAt: daysAgo(6),
  },
  {
    id: "demo-post-18",
    userId: "demo-user-23",
    userName: "GlamGarimaBLR",
    userAvatar: "/assets/avatars/avatar-07.png",
    caption:
      "Submitting to #RedCarpetRecreation — Priyanka Chopra's ball gown moment for my office annual day! Never thought I'd wear something this dramatic but the AR preview convinced me to go for it 👑 #Contest #PriyankaChopra",
    imageUrl: "/assets/outfits/look-luxury-ball-gown/hero.png",
    images: [{ id: "demo-img-18", url: "/assets/outfits/look-luxury-ball-gown/detail1.jpg", sortOrder: 0 }],
    productId: "look-luxury-ball-gown",
    tags: ["RedCarpetRecreation", "contest", "PriyankaChopra", "Gown"],
    likeCount: 1432,
    commentCount: 88,
    shares: 67,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(4),
    updatedAt: daysAgo(4),
  },
  {
    id: "demo-post-19",
    userId: "demo-user-24",
    userName: "CannesCraze_Del",
    userAvatar: "/assets/avatars/avatar-08.png",
    caption:
      "My #RedCarpetRecreation entry — Deepika's Cannes-inspired ivory gown recreated for a friend's reception. The AR try-on nailed the drape length before I even placed the order! #Contest #Deepika #Cannes",
    imageUrl: "/assets/outfits/look-festive-reception-gown/hero.png",
    images: [{ id: "demo-img-19", url: "/assets/outfits/look-festive-reception-gown/detail1.jpg", sortOrder: 0 }],
    productId: "look-festive-reception-gown",
    tags: ["RedCarpetRecreation", "contest", "Deepika", "Cannes"],
    likeCount: 2543,
    commentCount: 165,
    shares: 138,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(6),
    updatedAt: daysAgo(6),
  },
  {
    id: "demo-post-20",
    userId: "demo-user-25",
    userName: "AwardNightAnaya",
    userAvatar: "/assets/avatars/avatar-09.png",
    caption:
      "#RedCarpetRecreation submission — my fiancé in Hrithik's black-tie tux for our award-night themed pre-wedding shoot. He scrubbed up incredibly well 🖤 #Contest #HrithikRoshan #BlackTie",
    imageUrl: "/assets/outfits/look-luxury-black-tie-tux/hero.png",
    images: [{ id: "demo-img-20", url: "/assets/outfits/look-luxury-black-tie-tux/detail1.jpg", sortOrder: 0 }],
    productId: "look-luxury-black-tie-tux",
    tags: ["RedCarpetRecreation", "contest", "HrithikRoshan", "Tuxedo"],
    likeCount: 1121,
    commentCount: 69,
    shares: 52,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
  },

  // ── Regular feed posts ─────────────────────────────────────────────────────
  {
    id: "demo-post-21",
    userId: "demo-user-26",
    userName: "SouthCinemaSiri",
    userAvatar: "/assets/avatars/avatar-10.png",
    caption:
      "Rishab Shetty's Kantara look recreated for a college fest! The handloom texture came through beautifully even in photos. So many people asked where I got it 🌿 #Kantara #RishabShetty #Sandalwood",
    imageUrl: "/assets/outfits/look-rishab-shetty-kantara/hero.png",
    images: [{ id: "demo-img-21", url: "/assets/outfits/look-rishab-shetty-kantara/detail1.jpg", sortOrder: 0 }],
    productId: "look-rishab-shetty-kantara",
    tags: ["Kantara", "RishabShetty", "Sandalwood", "Handloom"],
    likeCount: 1897,
    commentCount: 121,
    shares: 84,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(10),
    updatedAt: daysAgo(10),
  },
  {
    id: "demo-post-22",
    userId: "demo-user-27",
    userName: "KGFKrazyKarthik",
    userAvatar: "/assets/avatars/avatar-11.png",
    caption:
      "Rocky Bhai energy for a friend's birthday bash 🔥 Yash's KGF-inspired look, tried on virtually first so I knew exactly how the jacket would sit. Zero regrets. #KGF #Yash #RockyBhai",
    imageUrl: "/assets/outfits/look-yash-kgf/hero.png",
    images: [{ id: "demo-img-22", url: "/assets/outfits/look-yash-kgf/detail1.jpg", sortOrder: 0 }],
    productId: "look-yash-kgf",
    tags: ["KGF", "Yash", "Sandalwood", "PartyLook"],
    likeCount: 2210,
    commentCount: 143,
    shares: 96,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(13),
    updatedAt: daysAgo(13),
  },
  {
    id: "demo-post-23",
    userId: "demo-user-28",
    userName: "QueenVibesKanika",
    userAvatar: "/assets/avatars/avatar-12.png",
    caption:
      "Channelling Kangana's Queen era for my solo trip photos ✈️ This look travels SO well and the virtual try-on helped me pack with confidence instead of guessing. #Queen #KanganaRanaut #SoloTravel",
    imageUrl: "/assets/outfits/look-kangana-ranaut-queen/hero.png",
    images: [{ id: "demo-img-23", url: "/assets/outfits/look-kangana-ranaut-queen/detail1.jpg", sortOrder: 0 }],
    productId: "look-kangana-ranaut-queen",
    tags: ["Queen", "KanganaRanaut", "TravelStyle", "CelebStyle"],
    likeCount: 1345,
    commentCount: 79,
    shares: 58,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(16),
    updatedAt: daysAgo(16),
  },
  {
    id: "demo-post-24",
    userId: "demo-user-29",
    userName: "ThappadTaraLucknow",
    userAvatar: "/assets/avatars/avatar-13.png",
    caption:
      "Taapsee's Thappad-inspired beaded saree for my sister's roka ceremony 💫 Understated but the beadwork catches the light beautifully in every photo. Highly recommend for daytime functions. #Thappad #TaapseePannu #Saree",
    imageUrl: "/assets/outfits/look-luxury-beaded-saree/hero.png",
    images: [{ id: "demo-img-24", url: "/assets/outfits/look-luxury-beaded-saree/detail1.jpg", sortOrder: 0 }],
    productId: "look-luxury-beaded-saree",
    tags: ["TaapseePannu", "Saree", "RokaCeremony", "CelebStyle"],
    likeCount: 967,
    commentCount: 61,
    shares: 39,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(19),
    updatedAt: daysAgo(19),
  },
  {
    id: "demo-post-25",
    userId: "demo-user-30",
    userName: "BarbieCoreBhavya",
    userAvatar: "/assets/avatars/avatar-14.png",
    caption:
      "Went full Barbiecore for a themed birthday using Margot Robbie's iconic look as reference 💗 The AR try-on made picking the exact pink shade so much easier. Best party outfit I've ever ordered! #Barbie #MargotRobbie #Hollywood",
    imageUrl: "/assets/outfits/look-margot-robbie-barbie/hero.png",
    images: [{ id: "demo-img-25", url: "/assets/outfits/look-margot-robbie-barbie/detail1.jpg", sortOrder: 0 }],
    productId: "look-margot-robbie-barbie",
    tags: ["Barbie", "MargotRobbie", "Hollywood", "PartyLook"],
    likeCount: 3021,
    commentCount: 204,
    shares: 187,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(20),
    updatedAt: daysAgo(20),
  },
];

void now;
