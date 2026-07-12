/**
 * CelebStyle Content Seed — fast supplementary seed for non-inventory data.
 * Uses createMany + skipDuplicates where possible.
 */
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const ADMIN_ID = "cmr7fnjd5000awqucxlnad8pl";

async function main() {
  console.log("🌱 Seeding content data...\n");

  const users = await p.user.findMany({ select: { id: true, email: true }, take: 16 });
  const prods = await p.product.findMany({ select: { id: true, slug: true, movieName: true, imageUrl: true, basePrice: true, celebrityId: true }, take: 16 });
  const manufacturers = await p.manufacturer.findMany({ select: { id: true, name: true } });

  // ── 1. Coupons ────────────────────────────────────────────────────────────
  console.log("1. Coupons...");
  const coupons = [
    { code: "WELCOME20", type: "PERCENTAGE",   value: 20,  minOrderAmount: 5000,  maxDiscountAmount: 2000, usageLimit: 500 },
    { code: "FLAT500",   type: "FIXED_AMOUNT", value: 500, minOrderAmount: 3000,  maxDiscountAmount: null, usageLimit: 1000 },
    { code: "CELEB10",   type: "PERCENTAGE",   value: 10,  minOrderAmount: 10000, maxDiscountAmount: 3000, usageLimit: 200 },
    { code: "FREESHIP",  type: "FREE_SHIPPING",value: 499, minOrderAmount: 1000,  maxDiscountAmount: null, usageLimit: 2000 },
    { code: "NEWLOOK15", type: "PERCENTAGE",   value: 15,  minOrderAmount: 8000,  maxDiscountAmount: 1500, usageLimit: 300 },
    { code: "FESTIVAL25",type: "PERCENTAGE",   value: 25,  minOrderAmount: 15000, maxDiscountAmount: 5000, usageLimit: 100 },
  ];
  for (const c of coupons) {
    await p.coupon.upsert({
      where:  { code: c.code },
      update: { isActive: true },
      create: { code: c.code, type: c.type, value: c.value, minOrderAmount: c.minOrderAmount, maxDiscountAmount: c.maxDiscountAmount, usageLimit: c.usageLimit, startsAt: new Date("2026-01-01"), expiresAt: new Date("2027-12-31"), isActive: true, createdById: ADMIN_ID },
    });
  }
  console.log(`   ✓ ${coupons.length} coupons`);

  // ── 2. System Settings ────────────────────────────────────────────────────
  console.log("2. System settings...");
  const settings = [
    ["PLATFORM_FEE_PERCENT",           "10",   "Platform fee as % of order subtotal"],
    ["CELEBRITY_COMMISSION_PERCENT",   "5",    "Celebrity commission as % of order subtotal"],
    ["FREE_SHIPPING_THRESHOLD",        "25000","Order total in INR above which shipping is free"],
    ["SHIPPING_FLAT_RATE",             "499",  "Flat shipping rate in INR"],
    ["MAX_CART_ITEMS",                 "20",   "Maximum items per cart"],
    ["REVIEW_APPROVAL_REQUIRED",       "true", "Reviews require admin approval"],
    ["COMMUNITY_POST_MODERATION",      "true", "Community posts require moderation"],
    ["LOW_STOCK_ALERT_THRESHOLD",      "5",    "Units below which low-stock alert triggers"],
    ["AI_RECOMMENDATIONS_ENABLED",     "true", "Enable AI recommendations"],
    ["AR_TRYON_ENABLED",               "true", "Enable AR virtual try-on"],
  ];
  for (const [key, value, description] of settings) {
    await p.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value, description, isPublic: false } });
  }
  console.log(`   ✓ ${settings.length} settings`);

  // ── 3. Blog Posts ─────────────────────────────────────────────────────────
  console.log("3. Blog posts...");
  const blogData = [
    { slug: "deepika-padukone-style-guide-2026", title: "Deepika Padukone's Iconic Style: A Complete Guide for 2026", summary: "From Gehraiyaan-era minimalism to red carpet maximalism — decode every era of Deepika's fashion evolution.", body: "Deepika Padukone has long been the benchmark of Indian celebrity style. Her 2022 Abu Jani Sandeep Khosla lehenga at Cannes became the most-pinned Indian celebrity look of the decade.\n\n## The Sabyasachi Era\nDeepika's bridal looks set trends fans still replicate. Deep-hued Benarasi lehengas with uncut diamond jewellery became the blueprint for thousands of Indian brides.\n\n## Pathaan & Action Chic\nFor Pathaan, stylist Shaleena Nathani crafted a wardrobe equal parts tactical and glamorous. The olive co-ord sets and leather jackets spawned a wave of action-hero casual across Indian high streets.\n\n## How to Shop the Looks\nEvery iconic Deepika look is available as a premium replica on CelebStyle, crafted by ateliers that supply India's biggest fashion houses.", tags: ["deepika","bollywood","style-guide","fashion","2026"], coverImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Deepika_Padukone_at_Cannes_2022_%2801%29.jpg/800px-Deepika_Padukone_at_Cannes_2022_%2801%29.jpg", isPublished: true },
    { slug: "shah-rukh-khan-pathaan-look-breakdown", title: "The Pathaan Look: Breaking Down SRK's Most Iconic Outfits", summary: "Aviators, statement watches, and that YRF action wardrobe — everything you need to nail the Pathaan aesthetic.", body: "When Pathaan released in January 2023, it didn't just break box office records — it launched a thousand style searches.\n\n## The White Outfit That Broke the Internet\nThe sheer white tank + low-waist jeans combination in 'Besharam Rang' generated over 50M social media impressions in 72 hours.\n\n## The Mission Jacket\nThe olive mission jacket became the most requested piece. Our manufacturing partner Rohit Bal Designs recreated it stitch-for-stitch in premium ripstop nylon.\n\n## Accessories That Made the Outfit\nThe IWC Pilot's Watch, chrome aviators, combat boots — each piece communicates a specific character quality.", tags: ["shah-rukh-khan","pathaan","bollywood","menswear"], coverImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Shah_Rukh_Khan_graces_the_launch_of_Kolkata_Knight_Riders_jersey_%28cropped%29.jpg/800px-Shah_Rukh_Khan_graces_the_launch_of_Kolkata_Knight_Riders_jersey_%28cropped%29.jpg", isPublished: true },
    { slug: "how-to-style-sabyasachi-replica-lehenga", title: "How to Style a Sabyasachi-Inspired Lehenga Without Breaking the Bank", summary: "The ultimate guide to wearing bridal red — silhouette, accessories, hair, and occasion mapping.", body: "Sabyasachi lehengas retail for ₹5–25 lakhs. CelebStyle replicas start at ₹18,999. Understanding what makes the originals special will help you get the most from your purchase.\n\n## The Sabyasachi Signature\nDeep jewel tones, intricate zardosi embroidery, structured blouses with vintage hooks.\n\n## Styling the Look\n**Jewellery**: Uncut diamonds or polki kundan — avoid anything too modern.\n**Makeup**: Red lips, kohl eyes, dewy base.\n**Hair**: Low bun with jasmine strings.\n\n## Occasion Mapping\n- Deep crimson: weddings and sangeets\n- Peacock teal: reception and mehendi\n- Ivory with gold: engagement ceremonies", tags: ["sabyasachi","bridal","lehenga","styling","wedding"], coverImage: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800", isPublished: true },
    { slug: "celebrity-fashion-trends-2026", title: "Celebrity Fashion Trends Dominating 2026", summary: "Quiet luxury, maximalist bridal, gender-fluid menswear — the 5 trends every Indian fashion lover needs to know.", body: "Indian celebrity fashion in 2026 is a study in contrasts.\n\n## 1. Quiet Luxury Goes Desi\nUnderstated Chanderi sarees in muted tones, minimal zari. Alia Bhatt leads this aesthetic.\n\n## 2. Maximalist Bridal Comeback\nTriple-layered lehengas with 3D floral work dominate wedding season.\n\n## 3. Gender-Fluid Menswear\nFrom Ranveer Singh's sherwani-gowns to Vijay Deverakonda's kilt-over-dhoti — Indian menswear boundaries dissolve.\n\n## 4. South Indian Resurgence\nKanjeevaram silk sarees and temple jewellery are having their biggest moment since the 1990s.\n\n## 5. Streetwear Meets Ethnic\nOversized kurtas with cargo pants, kolhapuri chappals with bomber jackets — officially mainstream.", tags: ["trends","2026","bollywood","fashion","ethnic"], coverImage: "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=800", isPublished: true },
    { slug: "ar-tryon-how-it-works", title: "How CelebStyle's AR Try-On Works — and Why It Changes Everything", summary: "Virtual dressing rooms are no longer science fiction. Our AI-powered try-on ensures the perfect fit before you buy.", body: "Buying a ₹30,000 lehenga online required a leap of faith — until now. CelebStyle's AR Try-On uses computer vision to drape digital fabric realistically over your live camera feed.\n\n## The Technology\nBody landmark detection (17 keypoints), garment segmentation, and physics-based cloth simulation.\n\n## How to Use It\n1. Navigate to any outfit page and tap 'Try On'\n2. Allow camera access\n3. Stand 1.5–2 metres away in good lighting\n4. The outfit drapes in real time\n5. Switch sizes to see the fit difference\n\n## Accuracy\nIn a 3,000-user beta, 87% of customers who used AR Try-On reported satisfaction with fit vs 62% for non-AR purchases.", tags: ["ar","technology","try-on","innovation"], coverImage: "https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?w=800", isPublished: true },
  ];
  for (const bp of blogData) {
    await p.blogPost.upsert({
      where:  { slug: bp.slug },
      update: { isPublished: bp.isPublished },
      create: { slug: bp.slug, title: bp.title, summary: bp.summary, body: bp.body, tags: bp.tags, coverImage: bp.coverImage, isPublished: bp.isPublished, publishedAt: bp.isPublished ? new Date() : null, authorId: ADMIN_ID },
    });
  }
  console.log(`   ✓ ${blogData.length} blog posts`);

  // ── 4. Community Posts ────────────────────────────────────────────────────
  console.log("4. Community posts...");
  const postData = [
    { caption: "Finally got my Deepika Padukone Pathaan look! The quality is absolutely stunning 🔥 Wearing size M and fits perfectly.", tags: ["deepika","pathaan","celebstyle"], imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600" },
    { caption: "Wore the Ranveer Singh Gully Boy outfit to a college event. Everyone was asking where I got it! 🎤", tags: ["ranveer","gullyboy","menswear"], imageUrl: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=600" },
    { caption: "The Alia Bhatt saree is even more beautiful in person. Perfect for my friend's wedding! 💛", tags: ["aliabhatt","saree","wedding"], imageUrl: "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=600" },
    { caption: "Styling the SRK red carpet look for my cousin's reception. Fabric quality is exactly as described. 10/10!", tags: ["srk","redcarpet","reception"], imageUrl: "https://images.unsplash.com/photo-1622470953794-aa9c70b0fb9d?w=600" },
    { caption: "The Hrithik War look arrived today. Packaged beautifully — stitching is immaculate. Already planning my next order! 💪", tags: ["hrithik","war","action"], imageUrl: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=600" },
    { caption: "Ordered the Priyanka Chopra party outfit for New Year's Eve. It's absolutely gorgeous! The colour is so vibrant.", tags: ["priyanka","partyoutfit","NYE"], imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600" },
    { caption: "My daughter's sangeet look inspired by Deepika's wedding — lehenga + blouse ordered separately. Perfect fit!", tags: ["sangeet","bridal","deepika"], imageUrl: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600" },
    { caption: "Recreating the Vijay Deverakonda Liger outfit for a theme party. Replica quality is insane for this price! 🐯", tags: ["vijay","liger","tollywood"], imageUrl: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600" },
    { caption: "Got the Tamannaah festival look for Navratri. The embroidery is hand-done and absolutely stunning. Worth every rupee!", tags: ["tamannaah","navratri","festival"], imageUrl: "https://images.unsplash.com/photo-1617627143233-15f59d3a03ec?w=600" },
    { caption: "Style challenge: SRK vs Ranveer — both outfits from CelebStyle! Fabric quality on both is exceptional. Who wins?", tags: ["comparison","srk","ranveer","stylechallenge"], imageUrl: "https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?w=600" },
  ];

  let postCount = 0;
  for (let i = 0; i < postData.length; i++) {
    const user = users[i % users.length];
    const prod = prods[i % prods.length];
    const d = postData[i];
    try {
      const post = await p.communityPost.create({
        data: { userId: user.id, productId: prod?.id ?? null, caption: d.caption, tags: d.tags, isApproved: true, approvedAt: new Date(), approvedById: ADMIN_ID, likeCount: Math.floor(Math.random() * 150) + 10, commentCount: Math.floor(Math.random() * 20) },
      });
      if (d.imageUrl) await p.communityPostImage.create({ data: { postId: post.id, url: d.imageUrl, sortOrder: 0 } });
      postCount++;
    } catch { /* skip */ }
  }
  console.log(`   ✓ ${postCount} community posts`);

  // ── 5. Reviews ────────────────────────────────────────────────────────────
  console.log("5. Reviews...");
  const reviewData = [
    { rating: 5, title: "Absolutely perfect!", body: "Quality is indistinguishable from the original. Stitching is immaculate and fabric has a beautiful drape. Ordered size M — fits like a dream. Will definitely order more!" },
    { rating: 5, title: "Exceeded expectations", body: "I was nervous ordering such an expensive replica online but photos don't do it justice. The zari work is detailed and the colour is exactly as shown. Fast delivery too." },
    { rating: 4, title: "Beautiful but runs slightly large", body: "Gorgeous outfit — excellent fabric and stunning embroidery. Only reason for 4 stars: sizing runs about half a size large. Order a size down." },
    { rating: 5, title: "Best purchase this year", body: "Wore this to my cousin's wedding and got so many compliments. Everyone asked where I got it and couldn't believe it was a replica." },
    { rating: 4, title: "Great quality, minor delay", body: "Fantastic outfit quality. Took 2 extra days to arrive but packaging was beautiful and everything was perfect inside." },
    { rating: 5, title: "Worth every rupee", body: "Ordered from 3 other celebrity replica sites — this is the only one that actually delivers what it promises. Attention to detail is remarkable." },
    { rating: 3, title: "Good but not great", body: "Decent fabric and on-time delivery. Embroidery is a bit uneven in places. Customer service was helpful when I reached out." },
    { rating: 5, title: "Stunningly beautiful", body: "Third order from CelebStyle — consistently excellent. Photos simply cannot capture the richness of the fabric." },
    { rating: 4, title: "Lovely outfit, helpful team", body: "Question about sizing answered within an hour. The outfit is beautiful — exactly as described. Would recommend to anyone." },
    { rating: 5, title: "Perfect for my event", body: "Ordered for my brother's wedding reception. Perfect fit in size L. Colour exactly as shown. Already planning next order!" },
    { rating: 5, title: "Premium craftsmanship", body: "I've seen Sabyasachi originals up close. This replica is genuinely close in terms of the zari work and drape. Impressive value." },
    { rating: 4, title: "Fast delivery, great packaging", body: "Arrived 2 days early, packed beautifully. Outfit is exactly what I ordered. The dupatta could be a touch longer but overall excellent." },
  ];

  let reviewCount = 0;
  for (let i = 0; i < Math.min(reviewData.length, prods.length); i++) {
    const user = users[i % users.length];
    const prod = prods[i];
    try {
      await p.review.upsert({
        where:  { userId_productId: { userId: user.id, productId: prod.id } },
        update: {},
        create: { userId: user.id, productId: prod.id, rating: reviewData[i].rating, title: reviewData[i].title, body: reviewData[i].body, isVerifiedPurchase: i % 3 === 0, isApproved: i % 7 !== 0, approvedAt: i % 7 !== 0 ? new Date() : null, approvedById: i % 7 !== 0 ? ADMIN_ID : null, helpfulCount: Math.floor(Math.random() * 40) },
      });
      reviewCount++;
    } catch { /* skip */ }
  }
  // Update average ratings
  for (const prod of prods) {
    const agg = await p.review.aggregate({ where: { productId: prod.id, isApproved: true }, _avg: { rating: true }, _count: { rating: true } });
    if (agg._count.rating > 0) await p.product.update({ where: { id: prod.id }, data: { averageRating: agg._avg.rating, reviewCount: agg._count.rating } });
  }
  console.log(`   ✓ ${reviewCount} reviews`);

  // ── 6. Demo Orders ────────────────────────────────────────────────────────
  console.log("6. Demo orders...");
  const statuses = ["DELIVERED","DELIVERED","SHIPPED","CONFIRMED","PLACED","PRODUCTION_STARTED","DELIVERED"];
  let orderCount = 0;

  for (let i = 0; i < 8; i++) {
    const orderNum = `CS2026${String(1000 + i).padStart(4, "0")}`;
    const existing = await p.order.findUnique({ where: { orderNumber: orderNum } });
    if (existing) { orderCount++; continue; }

    const user = users[i % users.length];
    const prod = prods[i % prods.length];
    if (!prod) continue;

    const subtotal = prod.basePrice;
    const shipping = subtotal >= 25000 ? 0 : 499;
    const total = subtotal + shipping;
    const status = statuses[i % statuses.length];
    const mfr = manufacturers[i % manufacturers.length];

    const order = await p.order.create({
      data: {
        orderNumber: orderNum, userId: user.id,
        shippingName: `Customer ${i + 1}`, shippingPhone: `9${String(800000000 + i)}`,
        shippingAddress: `${i + 1} MG Road, Bandra West`, shippingCity: "Mumbai",
        shippingState: "Maharashtra", shippingPincode: "400050",
        customerEmail: user.email, subtotal, shippingAmount: shipping, total,
        status, paymentStatus: "CAPTURED",
        deliveredAt: status === "DELIVERED" ? new Date(Date.now() - i * 86400000) : null,
        createdAt: new Date(Date.now() - (i + 1) * 4 * 86400000),
      },
    });

    const variant = await p.productVariant.findFirst({ where: { productId: prod.id } });
    const celebrity = await p.celebrity.findUnique({ where: { id: prod.celebrityId }, select: { name: true } });

    const orderItem = await p.orderItem.create({
      data: {
        orderId: order.id, productId: prod.id, variantId: variant?.id ?? null,
        productSlug: prod.slug ?? prod.id, productName: prod.movieName,
        celebrityId: prod.celebrityId, celebrityName: celebrity?.name ?? "Celebrity",
        category: "outfit", size: variant?.size ?? "M",
        imageUrl: prod.imageUrl ?? "", unitPrice: prod.basePrice,
        quantity: 1, totalPrice: prod.basePrice,
        manufacturerIds: mfr ? [mfr.id] : [],
      },
    });

    await p.payment.create({
      data: { orderId: order.id, provider: "SIMULATED", method: "UPI", amount: total, status: "CAPTURED", capturedAt: new Date(Date.now() - (i + 1) * 3 * 86400000), providerPaymentId: `sim_${orderNum}` },
    });

    if (mfr) {
      await p.manufacturerRouting.upsert({
        where: { orderItemId: orderItem.id },
        update: {},
        create: { orderId: order.id, orderItemId: orderItem.id, manufacturerId: mfr.id, manufacturerName: mfr.name, status: status === "DELIVERED" || status === "SHIPPED" ? "DISPATCHED" : "IN_PRODUCTION", assignedAt: new Date(Date.now() - (i + 1) * 2 * 86400000) },
      });
    }

    const platformFee = Math.round(subtotal * 0.10);
    const celebComm  = Math.round(subtotal * 0.05);
    const mfrShare   = subtotal - platformFee - celebComm;

    await p.orderCommission.upsert({ where: { orderId: order.id }, update: {}, create: { orderId: order.id, platformFee, celebrityCommission: celebComm, manufacturerShare: mfrShare, platformFeePercent: 10, celebrityPercent: 5, manufacturerPercent: 85 } });
    await p.settlement.upsert({ where: { orderId: order.id }, update: {}, create: { orderId: order.id, platformFee, celebrityCommission: celebComm, manufacturerShare: mfrShare, netCelebrityAmount: celebComm, netManufacturerAmount: mfrShare, status: status === "DELIVERED" ? "COMPLETED" : "PENDING", settledAt: status === "DELIVERED" ? new Date() : null } });
    orderCount++;
  }
  console.log(`   ✓ ${orderCount} orders`);

  // ── 7. Notifications ──────────────────────────────────────────────────────
  console.log("7. Notifications...");
  const notifTemplates = [
    { type: "ORDER_PLACED",    title: "Order Confirmed!",         body: "Your order has been placed. We'll start production within 24 hours.",          actionUrl: "/orders" },
    { type: "ORDER_SHIPPED",   title: "Your order is on the way!",body: "Your celebrity-inspired outfit has been shipped. Track your order!",            actionUrl: "/orders" },
    { type: "ORDER_DELIVERED", title: "Delivered! ✨",            body: "Your order has been delivered. Leave a review to help others.",                  actionUrl: "/orders" },
    { type: "PROMOTION",       title: "Festival Sale — 25% Off!", body: "Use code FESTIVAL25 at checkout. Limited time offer!",                          actionUrl: "/search" },
    { type: "NEW_COLLECTION",  title: "New Looks Added",          body: "10 new celebrity looks just added. Be the first to shop them!",                 actionUrl: "/search" },
    { type: "SYSTEM",          title: "Welcome to CelebStyle! 🌟",body: "Your account is all set. Browse 50+ celebrity looks and find your style.",      actionUrl: "/" },
  ];

  let notifCount = 0;
  const notifData = [];
  for (const user of users.slice(0, 10)) {
    for (const tmpl of notifTemplates.slice(0, 3)) {
      notifData.push({ userId: user.id, type: tmpl.type, title: tmpl.title, body: tmpl.body, actionUrl: tmpl.actionUrl, isRead: Math.random() > 0.6, createdAt: new Date(Date.now() - Math.random() * 7 * 86400000) });
      notifCount++;
    }
  }
  await p.notification.createMany({ data: notifData, skipDuplicates: false });
  console.log(`   ✓ ${notifCount} notifications`);

  // ── 8. Trending Products ──────────────────────────────────────────────────
  console.log("8. Trending products...");
  for (let i = 0; i < Math.min(prods.length, 12); i++) {
    try {
      await p.trendingProduct.upsert({
        where:  { productId: prods[i].id },
        update: { score: 100 - i * 7, rank: i + 1 },
        create: { productId: prods[i].id, score: 100 - i * 7, rank: i + 1, period: "WEEK", viewCount: (12 - i) * 100 + 50, wishlistCount: (12 - i) * 25, orderCount: (12 - i) * 4 },
      });
    } catch { /* skip */ }
  }
  console.log(`   ✓ trending products`);

  // ── Final summary ─────────────────────────────────────────────────────────
  const [v,i,c,b,cp,r,o,n,s,ss] = await Promise.all([
    p.productVariant.count(), p.inventory.count(), p.coupon.count(),
    p.blogPost.count(), p.communityPost.count(), p.review.count(),
    p.order.count(), p.notification.count(), p.settlement.count(), p.systemSetting.count(),
  ]);

  console.log("\n✅ Content seed complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Variants:          ${v}`);
  console.log(`  Inventory records: ${i}`);
  console.log(`  Coupons:           ${c}`);
  console.log(`  Blog posts:        ${b}`);
  console.log(`  Community posts:   ${cp}`);
  console.log(`  Reviews:           ${r}`);
  console.log(`  Orders:            ${o}`);
  console.log(`  Notifications:     ${n}`);
  console.log(`  Settlements:       ${s}`);
  console.log(`  System settings:   ${ss}`);
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e.message); process.exit(1); })
  .finally(() => p.$disconnect());
