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
  liked: boolean;
  bookmarked: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

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

**The Bandhgala Era**
The last five years have seen SRK champion Indian formalwear on global stages. His collaboration with designers like Manish Malhotra and Tarun Tahiliani has resulted in some of the most photographed looks in Bollywood history.

**CelebStyle recommends:** Recreate SRK's Filmfare 2023 bandhgala look from our Pathaan collection — available in sizes S to XXL.`,
    coverImage:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Shah_Rukh_Khan_graces_the_launch_of_the_new_Santro.jpg/330px-Shah_Rukh_Khan_graces_the_launch_of_the_new_Santro.jpg",
    tags: ["SRK", "Bollywood", "Style", "Bandhgala", "Trending"],
    productIds: ["look-shah-rukh-khan-red-carpet"],
    celebrityId: "shah-rukh-khan",
    authorId: "demo-author-1",
    authorName: "Priya Mehta",
    authorAvatar: "https://i.pravatar.cc/100?img=5",
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

**Shop her looks on CelebStyle** — including the Cannes-inspired ivory gown and her signature Sabyasachi lehenga replica.`,
    coverImage:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Deepika_Padukone_2018.jpg/330px-Deepika_Padukone_2018.jpg",
    tags: ["Deepika", "Bollywood", "Fashion", "Sabyasachi", "Cannes"],
    productIds: ["look-deepika-padukone-cannes"],
    celebrityId: "deepika-padukone",
    authorId: "demo-author-2",
    authorName: "Arjun Kapoor",
    authorAvatar: "https://i.pravatar.cc/100?img=12",
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

Browse all our traditional wedding looks on CelebStyle and book a virtual try-on to see how they look on you!`,
    coverImage:
      "https://images.unsplash.com/photo-1609340550603-0b7e5a8e2e3c?w=600&q=80",
    tags: ["Wedding", "Traditional", "Lehenga", "Sherwani", "Bridal", "2024"],
    productIds: [],
    celebrityId: null,
    authorId: "demo-author-1",
    authorName: "Priya Mehta",
    authorAvatar: "https://i.pravatar.cc/100?img=5",
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
Build a full look by adding multiple pieces — top, bottom, jacket, shoes, accessories. The AI scores your outfit on colour harmony, occasion fit, and trending score.`,
    coverImage:
      "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=600&q=80",
    tags: ["TryOn", "AR", "HowTo", "VirtualFashion", "CelebStyle"],
    productIds: [],
    celebrityId: null,
    authorId: "demo-author-3",
    authorName: "CelebStyle Team",
    authorAvatar: "https://i.pravatar.cc/100?img=68",
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

**Verdict: 5/5**
A collection that reinforces why Sabyasachi remains the gold standard of Indian bridal fashion.`,
    coverImage:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Sabyasachi_at_FDCI.jpg/330px-Sabyasachi_at_FDCI.jpg",
    tags: ["Sabyasachi", "Bridal", "SS24", "Lehenga", "Review"],
    productIds: [],
    celebrityId: null,
    authorId: "demo-author-2",
    authorName: "Arjun Kapoor",
    authorAvatar: "https://i.pravatar.cc/100?img=12",
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

**Get the Look**
Browse our Tollywood collection on CelebStyle — from Pushpa-inspired casual looks to RRR premiere-ready outfits.`,
    coverImage:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Allu_Arjun_at_Sarileru_Neekevvaru_event.jpg/330px-Allu_Arjun_at_Sarileru_Neekevvaru_event.jpg",
    tags: ["Tollywood", "Prabhas", "AlluArjun", "JrNTR", "Style", "South"],
    productIds: [],
    celebrityId: "allu-arjun",
    authorId: "demo-author-1",
    authorName: "Priya Mehta",
    authorAvatar: "https://i.pravatar.cc/100?img=5",
    isPublished: true,
    publishedAt: daysAgo(20),
    viewCount: 19234,
    createdAt: daysAgo(21),
    updatedAt: daysAgo(20),
  },
];

// ─── Reviews ──────────────────────────────────────────────────────────────────

export function getDemoReviews(productId: string): DemoReview[] {
  const all: DemoReview[] = [
    {
      id: "demo-rev-1",
      userId: "demo-user-1",
      userName: "Rahul Sharma",
      userAvatar: "https://i.pravatar.cc/100?img=33",
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
      userAvatar: "https://i.pravatar.cc/100?img=44",
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
      userAvatar: "https://i.pravatar.cc/100?img=55",
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
      userAvatar: "https://i.pravatar.cc/100?img=22",
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
      userAvatar: "https://i.pravatar.cc/100?img=11",
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
    userAvatar: "https://i.pravatar.cc/100?img=9",
    caption:
      "Finally got my Deepika-inspired lehenga from CelebStyle and I'm OBSESSED! The virtual try-on told me to go with the dusty rose and honestly best decision ever 🌸 #CelebStyle #Lehenga #WeddingVibes",
    imageUrl:
      "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400&q=80",
    images: [
      {
        id: "demo-img-1",
        url: "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400&q=80",
        sortOrder: 0,
      },
    ],
    productId: "look-deepika-padukone-cannes",
    tags: ["Lehenga", "WeddingVibes", "CelebStyle", "Deepika"],
    likeCount: 1234,
    commentCount: 89,
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
    userAvatar: "https://i.pravatar.cc/100?img=15",
    caption:
      "My reception look inspired by SRK's Filmfare bandhgala! Used the AR try-on feature — literally couldn't have picked this without seeing it on me first. Thanks @CelebStyle! 🙌 #Bandhgala #Reception #MensFashion",
    imageUrl:
      "https://images.unsplash.com/photo-1594938298603-c8148c4b4157?w=400&q=80",
    images: [
      {
        id: "demo-img-2",
        url: "https://images.unsplash.com/photo-1594938298603-c8148c4b4157?w=400&q=80",
        sortOrder: 0,
      },
    ],
    productId: "look-shah-rukh-khan-red-carpet",
    tags: ["Bandhgala", "MensFashion", "Reception", "SRK"],
    likeCount: 892,
    commentCount: 56,
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
    userAvatar: "https://i.pravatar.cc/100?img=26",
    caption:
      "Prabhas inspired sherwani for my best friend's sangeet! The fabric quality from CelebStyle is unreal — you can feel it's handcrafted. Absolutely worth it! 💙 #Prabhas #Sherwani #Sangeet #Tollywood",
    imageUrl:
      "https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=400&q=80",
    images: [
      {
        id: "demo-img-3",
        url: "https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=400&q=80",
        sortOrder: 0,
      },
    ],
    productId: "look-prabhas-baahubali",
    tags: ["Sherwani", "Sangeet", "Tollywood", "Prabhas"],
    likeCount: 2341,
    commentCount: 145,
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
    userAvatar: "https://i.pravatar.cc/100?img=37",
    caption:
      "Channelling Allu Arjun's energy in this amazing kurta set! 🔥 The embroidery detailing is next level. Using the virtual try-on helped me visualise the full outfit. #AlluArjun #Pushpa #StylishStar #CelebStyle",
    imageUrl:
      "https://images.unsplash.com/photo-1610664921890-b9e4f3fb5e7d?w=400&q=80",
    images: [
      {
        id: "demo-img-4",
        url: "https://images.unsplash.com/photo-1610664921890-b9e4f3fb5e7d?w=400&q=80",
        sortOrder: 0,
      },
    ],
    productId: "look-allu-arjun-pushpa",
    tags: ["AlluArjun", "Pushpa", "StylishStar", "Kurta"],
    likeCount: 4782,
    commentCount: 312,
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
    userAvatar: "https://i.pravatar.cc/100?img=48",
    caption:
      "My bridal lehenga arrived and it's even more beautiful than the virtual try-on showed! The Benarasi silk is exquisite. Couldn't have chosen without the AR feature. Thank you CelebStyle 🧡 #Bride #BenaraSilk #WeddingSeason",
    imageUrl:
      "https://images.unsplash.com/photo-1617793695-a64f85bdb481?w=400&q=80",
    images: [
      {
        id: "demo-img-5",
        url: "https://images.unsplash.com/photo-1617793695-a64f85bdb481?w=400&q=80",
        sortOrder: 0,
      },
    ],
    productId: null,
    tags: ["Bride", "Lehenga", "WeddingSeason", "BridalVibes"],
    likeCount: 6123,
    commentCount: 423,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(9),
    updatedAt: daysAgo(9),
  },
  {
    id: "demo-post-6",
    userId: "demo-user-11",
    userName: "KollywoodKumar",
    userAvatar: "https://i.pravatar.cc/100?img=59",
    caption:
      "Vijay inspired look for the Leo premiere! The veshti-shirt combo looked amazing on the virtual try-on and even better in person 😎 #Vijay #Leo #Kollywood #CelebStyle",
    imageUrl:
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&q=80",
    images: [
      {
        id: "demo-img-6",
        url: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&q=80",
        sortOrder: 0,
      },
    ],
    productId: "look-vijay-leo",
    tags: ["Vijay", "Leo", "Kollywood", "VeshtiStyle"],
    likeCount: 3487,
    commentCount: 198,
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
    userAvatar: "https://i.pravatar.cc/100?img=63",
    caption:
      "Sherwani shopping made EASY with CelebStyle's virtual try-on 💙 Tried 8 different looks from my couch. No stepping into overpriced boutiques. Ordered this beauty and it arrived in 9 days! #Sherwani #GroomPrep #Groom",
    imageUrl:
      "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=400&q=80",
    images: [
      {
        id: "demo-img-7",
        url: "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=400&q=80",
        sortOrder: 0,
      },
    ],
    productId: null,
    tags: ["Sherwani", "Groom", "GroomPrep", "WeddingFashion"],
    likeCount: 1876,
    commentCount: 103,
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
    userAvatar: "https://i.pravatar.cc/100?img=71",
    caption:
      "Style tip: the AR try-on feature shows you how a lehenga moves, not just how it looks static. Game changer for bridal shopping! Used it to pick this Sabyasachi-inspired silk for my client 🌟 #StylistLife #Sabyasachi #BridalShopping",
    imageUrl:
      "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400&q=80",
    images: [
      {
        id: "demo-img-8",
        url: "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400&q=80",
        sortOrder: 0,
      },
    ],
    productId: null,
    tags: ["StylistLife", "Sabyasachi", "BridalShopping", "Lehenga"],
    likeCount: 2954,
    commentCount: 187,
    liked: false,
    bookmarked: false,
    status: "ACTIVE",
    createdAt: daysAgo(18),
    updatedAt: daysAgo(18),
  },
];

void now;
