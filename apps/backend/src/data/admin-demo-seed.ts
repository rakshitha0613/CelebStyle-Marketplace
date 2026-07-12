/**
 * Admin demo seed — populates realistic data for the admin panel.
 * Idempotent: uses upsert/skipDuplicates where possible.
 */

import { PrismaClient, type ReturnReason, type ReturnStatus } from "@prisma/client";
import { hashPassword } from "../auth/password.service.js";

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
    summary: "Deepika turned heads at Cannes 2024 in a stunning Louis Vuitton ensemble. Here's how you can recreate the iconic look.",
    body: "Deepika Padukone is no stranger to Cannes, but her 2024 appearance left the fashion world speechless. Dressed in a custom embellished ivory gown with dramatic sleeves, she embodied classic Old Hollywood glamour.\n\nThe look featured intricate hand-beaded detailing across the bodice and a flowing silk train. At CelebStyle, we've worked with our partner manufacturers to recreate key elements of this look at accessible prices.",
    coverImage: "/assets/blog/banner-2.svg",
    tags: ["cannes","deepika","redcarpet","international"],
    daysBack: 15,
  },
  {
    slug: "demo-blog-virat-ipl-fashion-2024",
    title: "Virat Kohli's IPL Fashion: Off-Pitch Style Guide",
    summary: "When not on the pitch, Virat Kohli is always making fashion statements. We break down his best IPL season looks.",
    body: "IPL is not just about cricket — it's also India's biggest fashion event. Virat Kohli consistently showed up in outfits that landed on everyone's style radar.\n\nFrom tailored blazers over graphic tees to sleek athleisure combinations, Virat's off-pitch wardrobe is a masterclass in effortless style. Explore our collection inspired by Virat's IPL season looks.",
    coverImage: "/assets/blog/banner-1.svg",
    tags: ["virat","cricket","ipl","mensfashion"],
    daysBack: 22,
  },
  {
    slug: "demo-blog-alia-bhatt-maternity-style",
    title: "Alia Bhatt's Maternity Style — Elegance Redefined",
    summary: "Alia Bhatt proved that maternity fashion can be just as glamorous with her stunning pregnancy looks.",
    body: "Alia Bhatt's pregnancy was a style masterclass. The actress navigated every event with a wardrobe that was both bump-friendly and fashion-forward.\n\nSome standout moments included flowing anarkalis in soft pastels, empire-waist gowns in jewel tones, and comfortable kurta sets. At CelebStyle, we've taken inspiration from Alia's maternity looks to create a special collection.",
    coverImage: "/assets/blog/banner-3.svg",
    tags: ["alia","maternity","fashion","bollywood"],
    daysBack: 30,
  },
  {
    slug: "demo-blog-ranveer-colour-blocking",
    title: "The Art of Colour Blocking: Lessons from Ranveer Singh",
    summary: "Nobody does colour blocking quite like Ranveer Singh. We decode his approach to bold, fearless fashion.",
    body: "Ranveer Singh is arguably India's most fearless fashion icon. His approach to colour — bold, unapologetic, and thoroughly intentional — has inspired a generation to experiment with their wardrobes.\n\nColour blocking is one of Ranveer's most identifiable style signatures. Our Ranveer-inspired collection brings colour blocking into the real world with wearable pieces that inject personality into everyday dressing.",
    coverImage: "/assets/blog/banner-4.svg",
    tags: ["ranveer","colourblocking","mensfashion","bold"],
    daysBack: 45,
  },
  {
    slug: "demo-blog-saree-styling-2024",
    title: "How to Style a Saree in 2024: Celebrity-Inspired Draping Styles",
    summary: "From classic Nivi drapes to contemporary pre-stitched styles, we've compiled the most stunning saree looks of the year.",
    body: "The saree is timeless, but how you style it is always evolving. 2024 has seen a beautiful fusion of traditional draping with contemporary silhouettes.\n\nKey trends this year: the shoulder drape for a dramatic silhouette, the dhoti-style tuck for a fashion-forward edge, and the pre-stitched saree for those who prioritise ease. Explore our curated saree collection.",
    coverImage: "/assets/blog/banner-5.svg",
    tags: ["saree","styling","tradition","fashion2024"],
    daysBack: 55,
  },
  {
    slug: "demo-blog-wedding-season-2024",
    title: "Wedding Season 2024: Celebrity Looks That Stole the Show",
    summary: "From grand celebrations to intimate destination weddings, we recap the most memorable fashion moments.",
    body: "India's 2024 wedding season was arguably its most spectacular yet. The celebrations brought together Bollywood royalty, cricket legends, and business icons in an unforgettable display of Indian couture.\n\nThe women's fashion stole the show with jaw-dropping lehengas from Sabyasachi, Manish Malhotra, and Abu Jani-Sandeep Khosla. At CelebStyle, we've curated a wedding-ready collection.",
    coverImage: "/assets/blog/banner-5.svg",
    tags: ["wedding","lehenga","bollywood","2024","bridal"],
    daysBack: 65,
  },
  {
    slug: "demo-blog-sustainable-fashion-2024",
    title: "Celebrities Leading the Sustainable Fashion Movement in India",
    summary: "From Dia Mirza to Sonam Kapoor, Indian celebrities are championing sustainability in fashion.",
    body: "Sustainable fashion is no longer just a Western trend — India's biggest celebrities are leading the charge towards conscious dressing.\n\nDia Mirza has long been an advocate for environmental causes, consistently choosing organic fabrics and Indian handloom. At CelebStyle, we partner with manufacturers who prioritise ethical production and sustainable material sourcing.",
    coverImage: "/assets/blog/banner-6.svg",
    tags: ["sustainable","eco","fashion","celebrity","handloom"],
    daysBack: 80,
  },
  {
    slug: "demo-blog-kurta-sets-trend-2024",
    title: "The Kurta Set Renaissance: Why Every Man Needs One in 2024",
    summary: "The humble kurta-pyjama set has had a high-fashion glow-up. Here's why this classic Indian ensemble is ruling 2024.",
    body: "The kurta set is having its biggest moment in decades. Contemporary kurta sets now come in breathable linens, sustainable cottons, and luxurious silks, with cuts that range from relaxed and minimal to structured and architectural.\n\nCelebrity champions include Ranbir Kapoor, whose understated ivory sets communicate quiet luxury. At CelebStyle, we've created kurta sets that honour tradition while embracing modernity.",
    coverImage: "/assets/blog/banner-4.svg",
    tags: ["kurta","mensfashion","indian","tradition","2024"],
    daysBack: 90,
  },
  {
    slug: "demo-blog-priyanka-global-fashion",
    title: "Priyanka Chopra's Global Fashion Journey: From Bollywood to Hollywood",
    summary: "How PeeCee became one of the world's most powerful fashion voices.",
    body: "Priyanka Chopra Jonas has become a genuine global fashion icon. From her early Bollywood days in embellished sarees to her current international wardrobe of understated luxury, her fashion journey is a masterclass in purposeful evolution.\n\nKey lessons from Priyanka's style evolution: invest in quality over quantity, let your cultural heritage inform your personal style, and dress for the role you want. We've curated a collection inspired by her journey.",
    coverImage: "/assets/blog/banner-1.svg",
    tags: ["priyanka","global","bollywood","hollywood","icon"],
    daysBack: 100,
  },
  {
    slug: "demo-blog-festive-fashion-2024",
    title: "Festive Season Fashion 2024: The Ultimate Buying Guide",
    summary: "Diwali, Navratri, Durga Puja — we've curated the perfect festive wardrobe for every celebration.",
    body: "India's festive season is a riot of colour, tradition, and spectacular fashion. For Navratri, bold vibrant chaniya cholis with contemporary cuts are trending. For Diwali, classic Anarkalis in deep jewel tones are perennial favourites.\n\nWhatever your festival, CelebStyle has you covered with our comprehensive festive collection, featuring outfits inspired by India's most celebrated fashion icons.",
    coverImage: "/assets/blog/banner-2.svg",
    tags: ["festive","diwali","navratri","2024","celebration"],
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
        title:       p.title,
        summary:     p.summary,
        body:        p.body,
        coverImage:  p.coverImage,
        tags:        [...p.tags],
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

  // ── 7. System settings ────────────────────────────────────────────────────

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

