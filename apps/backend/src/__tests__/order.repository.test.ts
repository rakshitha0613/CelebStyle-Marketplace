/**
 * Phase B.4 — Order Repository Integration Tests
 *
 * Tests run against the real Supabase database. All test orders are written
 * with customerEmail = TEST_EMAIL and cleaned up in the final step.
 *
 * Seeded products used (must already exist from seed):
 *   look-alia-bhatt-gangubai     basePrice=14999  mfr: mfr-sabyasachi
 *   look-shah-rukh-khan-red-carpet  basePrice=28999  mfr: mfr-sabyasachi
 *   look-deepika-padukone-wedding   basePrice=24999  mfr: mfr-manyavar
 */

import { prisma } from "../lib/prisma.js";
import { orderRepository } from "../repositories/order.repository.js";
import type { OrderItem } from "../repositories/order.repository.js";

// ── Helpers ────────────────────────────────────────────────────────────────────
const TEST_EMAIL = "phase-b4-test@celebstyle.test";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}`);
    failed++;
  }
}

function assertEq<T>(actual: T, expected: T, label: string) {
  assert(actual === expected, `${label} (got ${JSON.stringify(actual)})`);
}

// ── Fixture items ──────────────────────────────────────────────────────────────
const cheapItem: OrderItem = {
  outfitId: "look-alia-bhatt-gangubai",
  outfitName: "Gangubai Kathiawadi",
  celebrityId: "alia-bhatt",
  celebrityName: "Alia Bhatt",
  category: "Film Look",
  price: 14_999,
  size: "S",
  imageUrl: "https://example.com/gangubai.jpg",
  manufacturerIds: ["mfr-sabyasachi"],
};

const expensiveItem: OrderItem = {
  outfitId: "look-shah-rukh-khan-red-carpet",
  outfitName: "SRK Red Carpet",
  celebrityId: "shah-rukh-khan",
  celebrityName: "Shah Rukh Khan",
  category: "Party",
  price: 28_999,
  size: "L",
  imageUrl: "https://example.com/srk.jpg",
  manufacturerIds: ["mfr-sabyasachi"],
};

const secondItem: OrderItem = {
  outfitId: "look-deepika-padukone-wedding",
  outfitName: "Deepika Wedding Look",
  celebrityId: "deepika-padukone",
  celebrityName: "Deepika Padukone",
  category: "Wedding",
  price: 24_999,
  size: "M",
  imageUrl: "https://example.com/deepika.jpg",
  manufacturerIds: ["mfr-manyavar"],
};

// ── Test suite ─────────────────────────────────────────────────────────────────
async function run() {
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║   Phase B.4 — Order Repository Tests      ║");
  console.log("╚════════════════════════════════════════════╝\n");

  // ── 1. findAll before creating test orders ────────────────────────────────
  console.log("── findAll (baseline) ─────────────────────────────────────────");
  const baseline = await orderRepository.findAll();
  assert(Array.isArray(baseline), "findAll returns an array");
  const baselineCount = baseline.length;
  console.log(`  (baseline count: ${baselineCount})`);

  // ── 2. Create — cheap item (shipping applies) ─────────────────────────────
  console.log("\n── create — single cheap item ─────────────────────────────────");
  const order1 = await orderRepository.create({
    customerName: "Test User",
    customerEmail: TEST_EMAIL,
    address: "123 Test Street, Mumbai",
    paymentMethod: "Razorpay Demo",
    items: [cheapItem],
  });

  assert(order1 !== null, "create returns an order");
  assert(typeof order1.id === "string", "id is a string");
  assert(order1.id.startsWith("ord-"), "id starts with 'ord-'");
  assertEq(order1.customerName, "Test User", "customerName matches");
  assertEq(order1.customerEmail, TEST_EMAIL, "customerEmail matches");
  assertEq(order1.address, "123 Test Street, Mumbai", "address matches");
  assertEq(order1.paymentMethod, "Razorpay Demo", "paymentMethod preserved");
  assertEq(order1.paymentStatus, "pending", "paymentStatus = pending");
  assertEq(order1.status, "placed", "status = placed");
  assertEq(order1.items.length, 1, "items.length = 1");
  assertEq(order1.items[0].outfitId, "look-alia-bhatt-gangubai", "item.outfitId");
  assertEq(order1.items[0].outfitName, "Gangubai Kathiawadi", "item.outfitName");
  assertEq(order1.items[0].celebrityId, "alia-bhatt", "item.celebrityId");
  assertEq(order1.items[0].price, 14_999, "item.price");
  assertEq(order1.items[0].size, "S", "item.size");
  assertEq(order1.items[0].manufacturerIds[0], "mfr-sabyasachi", "item.manufacturerIds[0]");
  assertEq(order1.subtotal, 14_999, "subtotal");
  assertEq(order1.shipping, 499, "shipping = 499 when subtotal < 25000");
  assertEq(order1.total, 15_498, "total = subtotal + 499");
  assertEq(order1.commission.platformFee, Math.round(14_999 * 0.1), "platformFee ≈ 10%");
  assertEq(order1.commission.celebrityCommission, Math.round(14_999 * 0.05), "celebrityCommission ≈ 5%");
  assertEq(
    order1.commission.manufacturerShare,
    14_999 - order1.commission.platformFee - order1.commission.celebrityCommission,
    "manufacturerShare = subtotal − platform − celebrity"
  );
  assertEq(order1.routing.length, 1, "routing.length = 1");
  assertEq(order1.routing[0].outfitId, "look-alia-bhatt-gangubai", "routing[0].outfitId");
  assert(
    order1.routing[0].manufacturerId === "mfr-sabyasachi",
    "routing[0].manufacturerId = mfr-sabyasachi"
  );
  assertEq(order1.routing[0].manufacturerName, "Sabyasachi Mukherjee", "routing[0].manufacturerName");
  assert(typeof order1.createdAt === "string", "createdAt is a string");
  assert(typeof order1.updatedAt === "string", "updatedAt is a string");
  assert(!isNaN(Date.parse(order1.createdAt)), "createdAt is a valid ISO date");
  assert(!isNaN(Date.parse(order1.updatedAt)), "updatedAt is a valid ISO date");

  // ── 3. Create — expensive item (free shipping) ────────────────────────────
  console.log("\n── create — expensive item (free shipping) ────────────────────");
  const order2 = await orderRepository.create({
    customerName: "High Roller",
    customerEmail: TEST_EMAIL,
    address: "456 VIP Lane, Delhi",
    paymentMethod: "UPI",
    items: [expensiveItem],
  });

  assertEq(order2.subtotal, 28_999, "subtotal = 28999");
  assertEq(order2.shipping, 0, "shipping = 0 when subtotal ≥ 25000");
  assertEq(order2.total, 28_999, "total = subtotal (no shipping)");
  assertEq(order2.paymentMethod, "UPI", "paymentMethod = UPI preserved");
  assertEq(order2.commission.platformFee, Math.round(28_999 * 0.1), "platformFee ≈ 10%");

  // ── 4. Create — two items ─────────────────────────────────────────────────
  console.log("\n── create — two items ─────────────────────────────────────────");
  const order3 = await orderRepository.create({
    customerName: "Bundle Buyer",
    customerEmail: TEST_EMAIL,
    address: "789 Bundle Rd, Chennai",
    paymentMethod: "Razorpay Demo",
    items: [cheapItem, secondItem],
  });

  assertEq(order3.items.length, 2, "items.length = 2");
  assertEq(order3.routing.length, 2, "routing.length = 2");
  assertEq(order3.subtotal, 14_999 + 24_999, "subtotal = sum of item prices");
  // 14999 + 24999 = 39998 ≥ 25000 → free shipping
  assertEq(order3.shipping, 0, "shipping = 0 for multi-item order ≥ 25000");
  assertEq(order3.total, 39_998, "total = subtotal (no shipping)");
  assert(
    order3.routing.some((r) => r.outfitId === "look-alia-bhatt-gangubai"),
    "routing includes Gangubai item"
  );
  assert(
    order3.routing.some((r) => r.outfitId === "look-deepika-padukone-wedding"),
    "routing includes Deepika item"
  );

  // ── 5. findByOrderNumber ──────────────────────────────────────────────────
  console.log("\n── findByOrderNumber ──────────────────────────────────────────");
  const found = await orderRepository.findByOrderNumber(order1.id);
  assert(found !== null, "findByOrderNumber finds an existing order");
  assertEq(found!.id, order1.id, "found.id matches");
  assertEq(found!.customerName, "Test User", "found.customerName matches");
  assertEq(found!.items.length, 1, "found.items.length = 1");
  assertEq(found!.subtotal, 14_999, "found.subtotal matches");
  assertEq(found!.commission.platformFee, order1.commission.platformFee, "found commission intact");

  const notFound = await orderRepository.findByOrderNumber("ord-00000000000");
  assert(notFound === null, "findByOrderNumber returns null for unknown id");

  // ── 6. findAll — count increased ─────────────────────────────────────────
  console.log("\n── findAll — count after creates ──────────────────────────────");
  const afterCreates = await orderRepository.findAll();
  assert(Array.isArray(afterCreates), "findAll still returns an array");
  assert(afterCreates.length >= baselineCount + 3, "findAll count increased by 3");
  assert(afterCreates[0].id === order3.id || afterCreates.some((o) => o.id === order3.id),
    "findAll includes order3");

  // Refresh the connection pool — prevents P1017 after a burst of queries
  // with Supabase's PgBouncer pooler (connections can be forcibly reset).
  await prisma.$disconnect();
  await prisma.$connect();

  // ── 7. pay — transitions status ──────────────────────────────────────────
  console.log("\n── pay ────────────────────────────────────────────────────────");
  const paid = await orderRepository.pay(order1.id);
  assert(paid !== null, "pay returns an order");
  assertEq(paid!.id, order1.id, "paid.id matches");
  assertEq(paid!.paymentStatus, "paid", "paymentStatus = paid after pay()");
  assertEq(paid!.status, "production started", "status = production started after pay()");
  assertEq(paid!.total, 15_498, "total unchanged after pay");
  assertEq(paid!.commission.platformFee, order1.commission.platformFee, "commission unchanged");

  // ── 8. pay — idempotent ───────────────────────────────────────────────────
  console.log("\n── pay — idempotent ───────────────────────────────────────────");
  const paidAgain = await orderRepository.pay(order1.id);
  assert(paidAgain !== null, "pay again returns (not null)");
  assertEq(paidAgain!.paymentStatus, "paid", "paymentStatus still paid");
  assertEq(paidAgain!.status, "production started", "status still production started");

  // ── 9. pay — unknown order ────────────────────────────────────────────────
  console.log("\n── pay — unknown order ────────────────────────────────────────");
  const payUnknown = await orderRepository.pay("ord-00000000000");
  assert(payUnknown === null, "pay returns null for unknown orderNumber");

  // ── 10. updateStatus ──────────────────────────────────────────────────────
  console.log("\n── updateStatus ───────────────────────────────────────────────");
  const shipped = await orderRepository.updateStatus(order2.id, "shipped");
  assert(shipped !== null, "updateStatus returns an order");
  assertEq(shipped!.id, order2.id, "updated.id matches");
  assertEq(shipped!.status, "shipped", "status = shipped after update");

  const delivered = await orderRepository.updateStatus(order2.id, "delivered");
  assertEq(delivered!.status, "delivered", "status = delivered after second update");

  const backToPlaced = await orderRepository.updateStatus(order3.id, "placed");
  assertEq(backToPlaced!.status, "placed", "status can return to placed");

  // ── 11. updateStatus — unknown / invalid ─────────────────────────────────
  console.log("\n── updateStatus — invalid inputs ──────────────────────────────");
  const unknownOrder = await orderRepository.updateStatus("ord-00000000000", "shipped");
  assert(unknownOrder === null, "updateStatus returns null for unknown orderNumber");

  const badStatus = await orderRepository.updateStatus(order2.id, "flying");
  assert(badStatus === null, "updateStatus returns null for invalid status string");

  // ── 12. Commission invariants ─────────────────────────────────────────────
  console.log("\n── commission invariants ──────────────────────────────────────");
  const { platformFee, celebrityCommission, manufacturerShare } = order1.commission;
  assertEq(
    platformFee + celebrityCommission + manufacturerShare,
    order1.subtotal,
    "platformFee + celebCommission + mfrShare = subtotal"
  );
  assert(platformFee > 0, "platformFee > 0");
  assert(celebrityCommission > 0, "celebrityCommission > 0");
  assert(manufacturerShare > 0, "manufacturerShare > 0");
  assert(manufacturerShare > platformFee, "manufacturerShare > platformFee (85% > 10%)");
  assert(manufacturerShare > celebrityCommission, "manufacturerShare > celebCommission (85% > 5%)");

  // ── 13. Routing — manufacturer not in DB ──────────────────────────────────
  console.log("\n── routing — no manufacturer ──────────────────────────────────");
  const noMfrOrder = await orderRepository.create({
    customerName: "No Mfr User",
    customerEmail: TEST_EMAIL,
    address: "1 Empty St",
    paymentMethod: "Razorpay Demo",
    items: [
      {
        ...cheapItem,
        manufacturerIds: [],
      },
    ],
  });
  assertEq(noMfrOrder.routing.length, 1, "routing created even with no manufacturer");
  assert(noMfrOrder.routing[0].manufacturerId === null, "routing.manufacturerId = null");
  assertEq(noMfrOrder.routing[0].manufacturerName, "Unassigned", "manufacturerName = Unassigned");

  // ── 14. Data persisted in DB (verify via Prisma directly) ─────────────────
  console.log("\n── DB persistence check ───────────────────────────────────────");
  const dbOrder = await prisma.order.findUnique({
    where: { orderNumber: order1.id },
    include: { items: true, commission: true, routing: true },
  });
  assert(dbOrder !== null, "Order exists in DB");
  assertEq(dbOrder!.orderNumber, order1.id, "DB orderNumber = API id");
  assertEq(dbOrder!.shippingName, "Test User", "DB shippingName = customerName");
  assertEq(dbOrder!.customerEmail, TEST_EMAIL, "DB customerEmail correct");
  assertEq(dbOrder!.subtotal, 14_999, "DB subtotal = 14999");
  assertEq(dbOrder!.shippingAmount, 499, "DB shippingAmount = 499");
  assertEq(dbOrder!.total, 15_498, "DB total = 15498");
  assertEq(dbOrder!.paymentStatus, "CAPTURED", "DB paymentStatus = CAPTURED");
  assertEq(dbOrder!.status, "PRODUCTION_STARTED", "DB status = PRODUCTION_STARTED");
  assertEq(dbOrder!.items.length, 1, "DB has 1 OrderItem");
  assertEq(dbOrder!.items[0].productSlug, "look-alia-bhatt-gangubai", "DB item productSlug");
  assertEq(dbOrder!.items[0].unitPrice, 14_999, "DB item unitPrice");
  assert(dbOrder!.commission !== null, "DB has OrderCommission");
  assertEq(dbOrder!.commission!.platformFee, Math.round(14_999 * 0.1), "DB platformFee");
  assertEq(dbOrder!.routing.length, 1, "DB has 1 ManufacturerRouting");
  assertEq(dbOrder!.routing[0].manufacturerName, "Sabyasachi Mukherjee", "DB routing.manufacturerName");

  // Also verify a Payment record was created when pay() was called
  const dbPayment = await prisma.payment.findFirst({
    where: { orderId: dbOrder!.id },
  });
  assert(dbPayment !== null, "Payment record created in DB after pay()");
  assertEq(dbPayment!.provider, "RAZORPAY", "Payment.provider = RAZORPAY");
  assertEq(dbPayment!.method, "CARD", "Payment.method = CARD");
  assertEq(dbPayment!.status, "CAPTURED", "Payment.status = CAPTURED");
  assertEq(dbPayment!.amount, 15_498, "Payment.amount = total");

  // ── 15. Cleanup ───────────────────────────────────────────────────────────
  console.log("\n── cleanup ────────────────────────────────────────────────────");
  const deleted = await prisma.order.deleteMany({
    where: { customerEmail: TEST_EMAIL },
  });
  assert(deleted.count >= 4, `Cleaned up ${deleted.count} test orders`);
  console.log(`  (deleted ${deleted.count} test orders)`);

  // ── Results ───────────────────────────────────────────────────────────────
  console.log("\n── Results ────────────────────────────────────────────────────");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log("─".repeat(58) + "\n");

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("\n[FATAL]", err);
  process.exit(1);
});
