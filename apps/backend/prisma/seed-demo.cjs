/**
 * CelebStyle Demo Data Seed Script
 * Run: node prisma/seed-demo.js
 * Idempotent — safe to run multiple times.
 */
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const ADMIN_ID = "cmr7fnjd5000awqucxlnad8pl"; // janedev@celebstyle.com

async function main() {
  console.log("🌱 Seeding demo data...\n");

  // ── 1. Warehouses ─────────────────────────────────────────────────────────
  console.log("1. Warehouses...");
  const [wh1, wh2] = await Promise.all([
    p.warehouse.upsert({
      where: { slug: "wh-mumbai" },
      update: {},
      create: { slug: "wh-mumbai", name: "Mumbai Central Warehouse", city: "Mumbai", state: "Maharashtra", pincode: "400001", priority: 1 },
    }),
    p.warehouse.upsert({
      where: { slug: "wh-delhi" },
      update: {},
      create: { slug: "wh-delhi", name: "Delhi NCR Warehouse", city: "New Delhi", state: "Delhi", pincode: "110001", priority: 2 },
    }),
  ]);
  console.log("   ✓ 2 warehouses");

  // ── 2. Product Variants + Inventory ────────────────────────────────────────
  console.log("2. Product variants & inventory...");
  const products = await p.product.findMany({ select: { id: true, slug: true, basePrice: true }, take: 52 });
  const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
  let variantCount = 0;
  let inventoryCount = 0;

  for (const prod of products) {
    for (let si = 0; si < sizes.length; si++) {
      const size = sizes[si];
      const sku = `${prod.slug}-${size}`.slice(0, 60);
      let variant;
      try {
        variant = await p.productVariant.upsert({
          where: { sku },
          update: {},
          create: {
            productId: prod.id,
            sku,
            size,
            priceAdjustment: si > 3 ? 500 : 0,
            sortOrder: si,
          },
        });
        variantCount++;
      } catch {
        variant = await p.productVariant.findUnique({ where: { sku } });
      }
      if (!variant) continue;

      // Inventory in both warehouses
      for (const wh of [wh1, wh2]) {
        const qty = Math.floor(Math.random() * 30) + 5;
        try {
          await p.inventory.upsert({
            where: { variantId_warehouseId: { variantId: variant.id, warehouseId: wh.id } },
            update: {},
            create: {
              productId: prod.id,
              variantId: variant.id,
              warehouseId: wh.id,
              quantity: qty,
              lowStockThreshold: 5,
            },
          });
          inventoryCount++;
        } catch { /* already exists */ }
      }
    }
  }
  console.log(`   ✓ ${variantCount} variants, ${inventoryCount} inventory records`);

  // ── 3. Coupons ─────────────────────────────────────────────────────────────
  console.log("3. Coupons...");
  const coupons = [
    { code: "WELCOME20", type: "PERCENTAGE", value: 20, minOrderAmount: 5000, maxDiscountAmount: 2000, usageLimit: 500, description: "20% off on first order" },
    { code: "FLAT500",   type: "FIXED_AMOUNT", value: 500, minOrderAmount: 3000, usageLimit: 1000 },
    { code: "CELEB10",   type: "PERCENTAGE", value: 10, minOrderAmount: 10000, maxDiscountAmount: 3000, usageLimit: 200 },
    { code: "FREESHIP",  type: "FREE_SHIPPING", value: 499, minOrderAmount: 1000, usageLimit: 2000 },
    { code: "NEWLOOK15", type: "PERCENTAGE", value: 15, minOrderAmount: 8000, maxDiscountAmount: 1500, usageLimit: 300 },
    { code: "FESTIVAL25",type: "PERCENTAGE", value: 25, minOrderAmount: 15000, maxDiscountAmount: 5000, usageLimit: 100 },
  ];
  for (const c of coupons) {
    await p.coupon.upsert({
      where: { code: c.code },
      update: { isActive: true },
      create: {
        code: c.code,
        type: c.type,
        value: c.value,
        minOrderAmount: c.minOrderAmount ?? 0,
        maxDiscountAmount: c.maxDiscountAmount ?? null,
        usageLimit: c.usageLimit ?? null,
        startsAt: new Date("2026-01-01"),
        expiresAt: new Date("2027-12-31"),
        isActive: true,
        createdById: ADMIN_ID,
      },
    });
  }
  console.log(`   ✓ ${coupons.length} coupons`);

  // ── 4. System Settings ─────────────────────────────────────────────────────
  console.log("4. System settings...");
  const settings = [
    { key: "PLATFORM_FEE_PERCENT", value: "10", description: "Platform fee as % of order subtotal" },
    { key: "CELEBRITY_COMMISSION_PERCENT", value: "5", description: "Celebrity commission as % of order subtotal" },
    { key: "FREE_SHIPPING_THRESHOLD", value: "25000", description: "Order total in paise above which shipping is free" },
    { key: "SHIPPING_FLAT_RATE", value: "499", description: "Flat shipping rate in INR" },
    { key: "MAX_CART_ITEMS", value: "20", description: "Maximum items allowed in a single cart" },
    { key: "REVIEW_APPROVAL_REQUIRED", value: "true", description: "Whether reviews require admin approval before publish" },
    { key: "COMMUNITY_POST_MODERATION", value: "true", description: "Require moderation for community posts" },
    { key: "LOW_STOCK_ALERT_THRESHOLD", value: "5", description: "Units below which low-stock alert is triggered" },
    { key: "AI_RECOMMENDATIONS_ENABLED", value: "true", description: "Enable AI-powered product recommendations" },
    { key: "AR_TRYON_ENABLED", value: "true", description: "Enable AR virtual try-on feature" },
  ];
  for (const s of settings) {
    await p.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: { key: s.key, value: s.value, description: s.description, isPublic: false },
    });
  }
  console.log(`   ✓ ${settings.length} system settings`);

  // ── 5. Blog Posts ──────────────────────────────────────────────────────────
  console.log("5. Blog posts...");
  const blogPosts = [
    {
      slug: "deepika-padukone-style-guide-2026",
      title: "Deepika Padukone's Iconic Style: A Complete Guide for 2026",
      summary: "From her Gehraiyaan-era minimalism to red carpet maximalism — decode every era of Deepika's fashion evolution.",
      body: "Deepika Padukone has long been the benchmark of Indian celebrity style. In 2026, her approach to fashion has matured into a sophisticated blend of traditional craftsmanship and contemporary silhouettes.\n\n## The Sabyasachi Era\nDeepika's bridal looks in real life set trends that fans still replicate today. The deep-hued Benarasi lehengas, paired with uncut diamond jewellery, became the blueprint for thousands of Indian brides.\n\n## Pathaan & Action Chic\nFor Pathaan, stylist Shaleena Nathani crafted a wardrobe that was equal parts tactical and glamorous. The olive co-ord sets and leather jackets spawned a wave of 'action-hero casual' across Indian high streets.\n\n## Red Carpet Royalty\nNo other Indian actress walks the Cannes carpet with the same authority. Her 2022 Abu Jani Sandeep Khosla lehenga — a three-dimensional floral masterpiece — became the most pinned Indian celebrity look of the decade.\n\n## How to Shop the Looks\nEvery iconic Deepika look is available as a premium replica on CelebStyle, crafted by the same ateliers that supply India's biggest fashion houses.",
      tags: ["deepika", "bollywood", "style-guide", "fashion", "2026"],
      coverImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Deepika_Padukone_at_Cannes_2022_%2801%29.jpg/800px-Deepika_Padukone_at_Cannes_2022_%2801%29.jpg",
      published: true,
    },
    {
      slug: "shah-rukh-khan-pathaan-look-breakdown",
      title: "The Pathaan Look: Breaking Down Shah Rukh Khan's Most Iconic Outfits",
      summary: "Aviators, statement watches, and that YRF action wardrobe — everything you need to nail the Pathaan aesthetic.",
      body: "When Pathaan released in January 2023, it didn't just break box office records — it launched a thousand style searches. Shah Rukh Khan's wardrobe in the film became a cultural phenomenon.\n\n## The White Outfit That Broke the Internet\nThe sheer white tank + low-waist jeans combination in the 'Besharam Rang' sequence generated over 50 million social media impressions in 72 hours. It was a Gucci tank and a vintage pair of Levi's, but the replicas on CelebStyle sold out within hours.\n\n## The Mission Jacket\nThe olive mission jacket became the most requested piece. Our manufacturing partner Rohit Bal Designs recreated it stitch-for-stitch in premium ripstop nylon.\n\n## Accessories That Made the Outfit\nThe IWC Pilot's Watch, the chrome aviators, the combat boots — each piece was chosen by stylist Shaleena Nathani to communicate a specific character quality. Find all Pathaan-inspired accessories in our curated Pathaan collection.",
      tags: ["shah-rukh-khan", "pathaan", "bollywood", "menswear"],
      coverImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Shah_Rukh_Khan_graces_the_launch_of_Kolkata_Knight_Riders_jersey_%28cropped%29.jpg/800px-Shah_Rukh_Khan_graces_the_launch_of_Kolkata_Knight_Riders_jersey_%28cropped%29.jpg",
      published: true,
    },
    {
      slug: "how-to-style-sabyasachi-replica-lehenga",
      title: "How to Style a Sabyasachi-Inspired Lehenga Without Breaking the Bank",
      summary: "The ultimate guide to wearing bridal red — from choosing the right silhouette to accessorising like a Bollywood bride.",
      body: "Sabyasachi Mukherjee's lehengas retail for ₹5–25 lakhs. CelebStyle's premium replicas start at ₹18,999. But price isn't the only difference — and understanding what makes the originals special will help you get the most from your purchase.\n\n## The Sabyasachi Signature\nDeep jewel tones (crimson, emerald, cobalt), intricate zardosi embroidery, and structured blouses with vintage-inspired hooks — these are the hallmarks.\n\n## Styling the Look\n**Jewellery**: Uncut diamonds or polki kundan. Avoid anything too shiny or modern — Sabyasachi's aesthetic is deliberately antique.\n**Makeup**: Red lips, kohl-rimmed eyes, and a dewy base. Stay away from heavy contouring.\n**Hair**: A low bun adorned with jasmine strings is the canonical choice.\n\n## Occasion Mapping\n- Deep crimson: weddings and sangeets\n- Peacock teal: reception and mehendi\n- Ivory with gold: engagement ceremonies\n\nShop the collection by occasion to find your perfect match.",
      tags: ["sabyasachi", "bridal", "lehenga", "styling", "wedding"],
      coverImage: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800",
      published: true,
    },
    {
      slug: "celebrity-fashion-trends-2026",
      title: "Celebrity Fashion Trends Dominating 2026",
      summary: "From quiet luxury to maximalist bollywood glam — here are the 5 trends every Indian fashion lover needs to know.",
      body: "Indian celebrity fashion in 2026 is a study in contrasts — and that's exactly what makes it so exciting.\n\n## 1. Quiet Luxury Goes Desi\nThe global quiet luxury trend has found its Indian expression: understated Chanderi sarees in muted tones, minimal zari, and no excessive embellishment. Alia Bhatt has been the biggest proponent.\n\n## 2. Maximalist Bridal Comeback\nIn direct counterpoint, bridal fashion has never been more maximalist. Triple-layered lehengas with 3D floral work are dominating wedding season.\n\n## 3. Gender-Fluid Menswear\nFrom Ranveer Singh's flamboyant sherwani-gowns to Vijay Deverakonda's kilt-over-dhoti combinations, the boundaries of Indian menswear are dissolving.\n\n## 4. South Indian Resurgence\nWith Tamil and Telugu cinema dominating OTT platforms globally, Kanjeevaram silk sarees and temple jewellery are having their biggest moment since the 1990s.\n\n## 5. Streetwear Meets Ethnic\nOversized kurtas with cargo pants, kolhapuri chappals with bomber jackets — the urban-ethnic fusion is officially mainstream.",
      tags: ["trends", "2026", "bollywood", "fashion", "ethnic"],
      coverImage: "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=800",
      published: true,
    },
    {
      slug: "ar-tryon-how-it-works",
      title: "How CelebStyle's AR Try-On Works — and Why It Changes Everything",
      summary: "Virtual dressing rooms are no longer science fiction. Here's how our AI-powered try-on technology ensures the perfect fit before you buy.",
      body: "Buying a ₹30,000 lehenga online requires a leap of faith — or it used to. CelebStyle's AR Try-On, built on proprietary computer vision technology, lets you see exactly how any outfit will look on your body before you commit.\n\n## The Technology\nOur model uses a combination of body landmark detection (17 keypoints), garment segmentation, and physics-based cloth simulation to drape digital fabric realistically over your live camera feed.\n\n## How to Use It\n1. Navigate to any outfit page and tap 'Try On'\n2. Allow camera access\n3. Stand 1.5–2 metres from the camera in good lighting\n4. The outfit will be draped over your silhouette in real time\n5. Switch between sizes to see the fit difference\n6. Share or save the result\n\n## Accuracy\nIn a 3,000-user beta, 87% of customers who used AR Try-On before purchase reported satisfaction with fit — vs 62% for non-AR purchases.\n\n## Privacy\nAll processing happens on-device. No images are uploaded to our servers unless you explicitly choose to save a try-on session.",
      tags: ["ar", "technology", "try-on", "innovation"],
      coverImage: "https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?w=800",
      published: false,
    },
  ];

  for (const bp of blogPosts) {
    await p.blogPost.upsert({
      where: { slug: bp.slug },
      update: { published: bp.published },
      create: {
        slug: bp.slug,
        title: bp.title,
        summary: bp.summary,
        body: bp.body,
        tags: bp.tags,
        coverImage: bp.coverImage,
        published: bp.published,
        publishedAt: bp.published ? new Date() : null,
        authorId: ADMIN_ID,
        readTime: Math.ceil(bp.body.split(" ").length / 200),
      },
    });
  }
  console.log(`   ✓ ${blogPosts.length} blog posts`);

  // ── 6. Community Posts ─────────────────────────────────────────────────────
  console.log("6. Community posts...");
  const users = await p.user.findMany({ select: { id: true }, take: 12 });
  const prods = await p.product.findMany({ select: { id: true, movieName: true, imageUrl: true }, take: 12 });

  const communityData = [
    { caption: "Finally got my Deepika Padukone Pathaan look! The quality is absolutely stunning 🔥 Wearing size M and it fits perfectly.", tags: ["deepika", "pathaan", "celebstyle"], imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600" },
    { caption: "Wore the Ranveer Singh Gully Boy outfit to a college event and everyone was asking where I got it from. CelebStyle never disappoints! 🎤", tags: ["ranveer", "gullyboy", "menswear"], imageUrl: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=600" },
    { caption: "The Alia Bhatt saree is even more beautiful in person. The zari work is so intricate. Perfect for my friend's wedding!", tags: ["aliabhatt", "saree", "wedding"], imageUrl: "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=600" },
    { caption: "Styling the SRK red carpet look for my cousin's reception. The fabric quality is exactly as described. 10/10 would recommend!", tags: ["ShahRukhKhan", "redcarpet", "reception"], imageUrl: "https://images.unsplash.com/photo-1622470953794-aa9c70b0fb9d?w=600" },
    { caption: "The Hrithik War look arrived today. Packaged beautifully and the stitching is immaculate. Already planning my next order! 💪", tags: ["hrithik", "war", "action"], imageUrl: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=600" },
    { caption: "Ordered the Priyanka Chopra party outfit for New Year's Eve. It's absolutely gorgeous! The colour is even more vibrant than the photos.", tags: ["priyanka", "partyoutfit", "NYE"], imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600" },
    { caption: "My daughter's sangeet look inspired by Deepika's wedding — we ordered both the lehenga and the blouse separately. Fit is perfect!", tags: ["sangeet", "bridal", "deepika"], imageUrl: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600" },
    { caption: "Recreating the Vijay Deverakonda Liger outfit for a theme party. The replica quality is insane for this price point 🐯", tags: ["vijay", "liger", "tollywood"], imageUrl: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600" },
    { caption: "Got the Tamannaah festival look for Navratri. The embroidery is hand-done and absolutely stunning. Worth every rupee!", tags: ["tamannaah", "navratri", "festival"], imageUrl: "https://images.unsplash.com/photo-1617627143233-15f59d3a03ec?w=600" },
    { caption: "Styling challenge: SRK vs Ranveer fashion — both outfits are from CelebStyle! The fabric quality on both is exceptional. Which one wins?", tags: ["comparison", "srk", "ranveer", "stylechallenge"], imageUrl: "https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?w=600" },
  ];

  let postCount = 0;
  for (let i = 0; i < communityData.length; i++) {
    const user = users[i % users.length];
    const prod = prods[i % prods.length];
    const data = communityData[i];

    try {
      const post = await p.communityPost.create({
        data: {
          userId: user.id,
          productId: prod?.id ?? null,
          caption: data.caption,
          tags: data.tags,
          isApproved: true,
          approvedAt: new Date(),
          approvedById: ADMIN_ID,
          likeCount: Math.floor(Math.random() * 150) + 10,
          commentCount: Math.floor(Math.random() * 20),
        },
      });
      if (data.imageUrl) {
        await p.communityPostImage.create({
          data: { postId: post.id, url: data.imageUrl, sortOrder: 0 },
        });
      }
      postCount++;
    } catch { /* skip duplicates */ }
  }
  console.log(`   ✓ ${postCount} community posts`);

  // ── 7. Reviews ─────────────────────────────────────────────────────────────
  console.log("7. Reviews...");
  const reviewData = [
    { rating: 5, title: "Absolutely perfect!", body: "The quality is indistinguishable from the original. Stitching is immaculate and the fabric has a beautiful drape. Ordered size M and it fits like a dream. Will definitely order more!" },
    { rating: 5, title: "Exceeded expectations", body: "I was nervous ordering such an expensive replica online but the photos don't do it justice. The zari work is so detailed and the colour is exactly as shown. Fast delivery too." },
    { rating: 4, title: "Beautiful but runs slightly large", body: "The outfit is gorgeous — fabric quality is excellent and the embroidery is stunning. Only reason for 4 stars is the sizing runs about half a size large. Order a size down." },
    { rating: 5, title: "Best purchase this year", body: "Wore this to my cousin's wedding and got so many compliments. Everyone asked where I got it and couldn't believe it was a replica. CelebStyle is the real deal." },
    { rating: 4, title: "Great quality, minor delay", body: "The outfit quality is fantastic — definitely 5-star fabric and construction. Took 2 extra days to arrive but the packaging was beautiful and everything was perfect inside." },
    { rating: 5, title: "Worth every rupee", body: "I've ordered from 3 other celebrity replica sites and this is the only one that actually delivers what it promises. The attention to detail is remarkable." },
    { rating: 3, title: "Good but not great", body: "The fabric quality is decent and the delivery was on time. The embroidery is a bit uneven in places which I didn't expect at this price point. Customer service was helpful when I reached out." },
    { rating: 5, title: "Stunningly beautiful", body: "This is my third order from CelebStyle and they consistently deliver. The Deepika look is absolutely stunning in person — photos simply cannot capture the richness of the fabric." },
    { rating: 4, title: "Lovely outfit, helpful team", body: "Had a question about sizing and the team responded within an hour. The outfit itself is beautiful — exactly as described. Would recommend to anyone." },
    { rating: 5, title: "Perfect for my event", body: "Ordered this for my brother's wedding reception. Fit was perfect in size L and the colour was exactly as shown. Everyone was amazed at the quality. Already planning my next order!" },
  ];

  let reviewCount = 0;
  for (let i = 0; i < reviewData.length; i++) {
    const user = users[i % users.length];
    const prod = prods[i % prods.length];
    if (!user || !prod) continue;
    try {
      await p.review.upsert({
        where: { userId_productId: { userId: user.id, productId: prod.id } },
        update: {},
        create: {
          userId: user.id,
          productId: prod.id,
          rating: reviewData[i].rating,
          title: reviewData[i].title,
          body: reviewData[i].body,
          isVerifiedPurchase: i % 3 === 0,
          isApproved: i % 7 !== 0,
          approvedAt: i % 7 !== 0 ? new Date() : null,
          approvedById: i % 7 !== 0 ? ADMIN_ID : null,
          helpfulCount: Math.floor(Math.random() * 40),
        },
      });
      reviewCount++;
    } catch { /* skip duplicate */ }
  }
  // Update product averageRating
  for (const prod of prods) {
    const agg = await p.review.aggregate({ where: { productId: prod.id, isApproved: true }, _avg: { rating: true }, _count: { rating: true } });
    if (agg._count.rating > 0) {
      await p.product.update({ where: { id: prod.id }, data: { averageRating: agg._avg.rating ?? null, reviewCount: agg._count.rating } });
    }
  }
  console.log(`   ✓ ${reviewCount} reviews`);

  // ── 8. Demo Orders ─────────────────────────────────────────────────────────
  console.log("8. Demo orders...");
  const manufacturers = await p.manufacturer.findMany({ select: { id: true, name: true }, take: 6 });
  const orderStatuses = ["DELIVERED", "SHIPPED", "CONFIRMED", "PLACED", "DELIVERED", "DELIVERED", "PRODUCTION_STARTED"];
  let orderCount = 0;

  for (let i = 0; i < 8; i++) {
    const user = users[i % users.length];
    const prod = prods[i % prods.length];
    if (!prod) continue;

    const subtotal = prod.basePrice;
    const shipping = subtotal >= 25000 ? 0 : 499;
    const total = subtotal + shipping;
    const status = orderStatuses[i % orderStatuses.length];
    const mfr = manufacturers[i % manufacturers.length];
    const orderNum = `CS2026${String(1000 + i).padStart(4, "0")}`;

    // Check if already exists
    const exists = await p.order.findUnique({ where: { orderNumber: orderNum } });
    if (exists) { orderCount++; continue; }

    const order = await p.order.create({
      data: {
        orderNumber: orderNum,
        userId: user.id,
        shippingName: `Demo Customer ${i + 1}`,
        shippingPhone: `9${String(800000000 + i)}`,
        shippingAddress: `${i + 1} MG Road, Bandra West`,
        shippingCity: "Mumbai",
        shippingState: "Maharashtra",
        shippingPincode: "400050",
        customerEmail: `demo${i}@celebstyle.test`,
        subtotal,
        shippingAmount: shipping,
        total,
        status: status,
        paymentStatus: "CAPTURED",
        deliveredAt: status === "DELIVERED" ? new Date(Date.now() - i * 86400000) : null,
        createdAt: new Date(Date.now() - (i + 1) * 3 * 86400000),
      },
    });

    const variant = await p.productVariant.findFirst({ where: { productId: prod.id } });

    const orderItem = await p.orderItem.create({
      data: {
        orderId: order.id,
        productId: prod.id,
        variantId: variant?.id ?? null,
        productSlug: prod.id,
        productName: prod.movieName ?? "Look",
        celebrityId: (await p.product.findUnique({ where: { id: prod.id }, select: { celebrityId: true } }))?.celebrityId ?? "",
        celebrityName: "Celebrity",
        category: "outfit",
        size: variant?.size ?? "M",
        imageUrl: prod.imageUrl ?? "",
        unitPrice: prod.basePrice,
        quantity: 1,
        totalPrice: prod.basePrice,
        manufacturerIds: mfr ? [mfr.id] : [],
      },
    });

    // Payment
    await p.payment.create({
      data: {
        orderId: order.id,
        provider: "SIMULATED",
        method: "UPI",
        amount: total,
        status: "CAPTURED",
        capturedAt: new Date(Date.now() - (i + 1) * 3 * 86400000),
        providerPaymentId: `sim_pay_${orderNum}`,
      },
    });

    // Manufacturer routing
    if (mfr) {
      await p.manufacturerRouting.upsert({
        where: { orderItemId: orderItem.id },
        update: {},
        create: {
          orderId: order.id,
          orderItemId: orderItem.id,
          manufacturerId: mfr.id,
          manufacturerName: mfr.name,
          status: status === "DELIVERED" ? "DISPATCHED" : status === "SHIPPED" ? "DISPATCHED" : "IN_PRODUCTION",
          assignedAt: new Date(Date.now() - (i + 1) * 2 * 86400000),
        },
      });
    }

    // Commission
    const platformFee = Math.round(subtotal * 0.10);
    const celebComm = Math.round(subtotal * 0.05);
    const mfrShare = subtotal - platformFee - celebComm;
    await p.orderCommission.upsert({
      where: { orderId: order.id },
      update: {},
      create: {
        orderId: order.id,
        platformFee,
        celebrityCommission: celebComm,
        manufacturerShare: mfrShare,
        platformFeePercent: 10,
        celebrityPercent: 5,
        manufacturerPercent: 85,
      },
    });

    // Settlement
    await p.settlement.upsert({
      where: { orderId: order.id },
      update: {},
      create: {
        orderId: order.id,
        platformFee,
        celebrityCommission: celebComm,
        manufacturerShare: mfrShare,
        netCelebrityAmount: celebComm,
        netManufacturerAmount: mfrShare,
        status: status === "DELIVERED" ? "COMPLETED" : "PENDING",
        settledAt: status === "DELIVERED" ? new Date() : null,
      },
    });

    orderCount++;
  }
  console.log(`   ✓ ${orderCount} orders (with payments, commissions, settlements)`);

  // ── 9. Notifications ───────────────────────────────────────────────────────
  console.log("9. Notifications...");
  const notifTemplates = [
    { type: "ORDER_PLACED",   title: "Order Confirmed!", body: "Your order CS2026 has been placed successfully. We'll start production within 24 hours.", actionUrl: "/orders" },
    { type: "ORDER_SHIPPED",  title: "Your order is on the way!", body: "Your celebrity-inspired outfit has been shipped. Track your order to see the latest status.", actionUrl: "/orders" },
    { type: "ORDER_DELIVERED",title: "Delivered! ✨", body: "Your order has been delivered. We hope you love the look! Leave a review to help others.", actionUrl: "/orders" },
    { type: "PROMOTION",      title: "Festival Sale — Up to 25% Off!", body: "Shop the FESTIVAL25 look collection this season. Use code FESTIVAL25 at checkout.", actionUrl: "/search" },
    { type: "NEW_COLLECTION", title: "New Looks Added", body: "10 new celebrity looks have just been added to the catalogue. Be the first to shop them!", actionUrl: "/search" },
    { type: "PRICE_DROP",     title: "Price Drop Alert!", body: "A look on your wishlist just got cheaper. Shop now before it sells out.", actionUrl: "/wishlist" },
    { type: "SYSTEM",         title: "Welcome to CelebStyle! 🌟", body: "Your account is all set. Browse 50+ celebrity looks and find your perfect style.", actionUrl: "/" },
  ];

  let notifCount = 0;
  for (const user of users.slice(0, 8)) {
    for (const tmpl of notifTemplates.slice(0, 3)) {
      try {
        await p.notification.create({
          data: {
            userId: user.id,
            type: tmpl.type,
            title: tmpl.title,
            body: tmpl.body,
            actionUrl: tmpl.actionUrl,
            isRead: Math.random() > 0.5,
            createdAt: new Date(Date.now() - Math.random() * 7 * 86400000),
          },
        });
        notifCount++;
      } catch { /* skip */ }
    }
  }
  console.log(`   ✓ ${notifCount} notifications`);

  // ── 10. Trending Products ──────────────────────────────────────────────────
  console.log("10. Trending products...");
  let trendCount = 0;
  for (let i = 0; i < Math.min(prods.length, 10); i++) {
    const prod = prods[i];
    try {
      await p.trendingProduct.upsert({
        where: { productId: prod.id },
        update: { score: 100 - i * 8, rank: i + 1 },
        create: {
          productId: prod.id,
          score: 100 - i * 8,
          rank: i + 1,
          period: "WEEK",
          viewCount: (10 - i) * 120 + Math.floor(Math.random() * 50),
          wishlistCount: (10 - i) * 30,
          orderCount: (10 - i) * 5,
        },
      });
      trendCount++;
    } catch { /* skip */ }
  }
  console.log(`   ✓ ${trendCount} trending products`);

  // ── 11. Saved Looks ────────────────────────────────────────────────────────
  console.log("11. Saved looks...");
  let savedCount = 0;
  for (let i = 0; i < Math.min(users.length, 6); i++) {
    const user = users[i];
    const savedProds = prods.slice(i, i + 3);
    for (const prod of savedProds) {
      try {
        await p.savedLook.create({
          data: { userId: user.id, productId: prod.id, note: "Love this look!" },
        });
        savedCount++;
      } catch { /* already exists */ }
    }
  }
  console.log(`   ✓ ${savedCount} saved looks`);

  console.log("\n✅ Demo seed complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const final = await Promise.all([
    p.warehouse.count(), p.productVariant.count(), p.inventory.count(),
    p.coupon.count(), p.blogPost.count(), p.communityPost.count(),
    p.review.count(), p.order.count(), p.notification.count(),
    p.settlement.count(), p.systemSetting.count(), p.trendingProduct.count(),
  ]);
  const labels = ["Warehouses","Variants","Inventory","Coupons","Blog Posts","Community Posts","Reviews","Orders","Notifications","Settlements","Settings","Trending"];
  labels.forEach((l, i) => console.log(`  ${l}: ${final[i]}`));
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e.message); process.exit(1); })
  .finally(() => p.$disconnect());
