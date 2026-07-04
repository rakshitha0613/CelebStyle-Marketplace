# CelebStyle — Database Schema

> Version 1.0.0 · July 2026 · PostgreSQL 15 + Prisma 6

---

## Overview

The CelebStyle database contains **88 Prisma models** across 10 functional domains. All tables use UUIDs as primary keys and include `createdAt` / `updatedAt` timestamps. The database is hosted on Supabase PostgreSQL with PgBouncer connection pooling.

---

## Domain Summary

| Domain | Models | Key entities |
|---|---|---|
| Identity & Auth | 9 | User, Session, EmailVerification, PasswordReset, Role, Permission |
| Celebrities | 3 | Celebrity, CelebrityProfile, CelebrityFollower |
| Products & Catalogue | 10 | Product, ProductVariant, ProductImage, Brand, Collection, Category, Tag |
| Manufacturers | 3 | Manufacturer, ManufacturerProfile, ManufacturerProduct |
| Commerce | 12 | Cart, CartItem, Order, OrderItem, OrderCommission, Payment, Coupon, Invoice, Wishlist |
| Inventory & Logistics | 6 | Warehouse, Inventory, StockMovement, InventoryReservation, Fulfillment, ShippingZone |
| Returns & Finance | 5 | Return, ReturnItem, Refund, Settlement, ManufacturerRouting |
| Community & Content | 8 | CommunityPost, Comment, Like, Bookmark, Notification, Review, Follower, LoyaltyAccount |
| AI & Recommendations | 15 | ProductEmbedding, UserEmbedding, Recommendation, RecommendationFeedback, AIModel, ARSession, CoPurchasedPair, CoviewedPair, TrendingProduct, ExperimentAssignment, ModelRegistry, ModelDeployment, PredictionLog, FeatureSnapshot, MLOpsAlert |
| System & Analytics | 10 | AnalyticsEvent, AnalyticsSession, AuditLog, SystemSetting, MediaAsset, Storefront, UserFeatureStore, ProductFeatureStore, SearchHistory, WebhookEvent |

---

## Key Models

### User

```prisma
model User {
  id              String    @id @default(uuid())
  email           String    @unique
  passwordHash    String
  role            UserRole  @default(CUSTOMER)
  emailVerified   Boolean   @default(false)
  isActive        Boolean   @default(true)
  deletedAt       DateTime?              // soft delete
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

### Celebrity

```prisma
model Celebrity {
  id              String    @id @default(uuid())
  name            String
  industry        Industry
  profileImageUrl String?
  bannerImageUrl  String?
  isVerified      Boolean   @default(false)
  storefrontId    String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

### Product (Outfit)

```prisma
model Product {
  id              String          @id @default(uuid())
  name            String
  description     String?
  basePrice       Decimal
  categoryId      String?
  manufacturerIds String[]        // first entry receives payment routing
  celebrityId     String?
  occasion        Occasion?
  season          String?
  isActive        Boolean         @default(true)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}
```

### Order

```prisma
model Order {
  id              String      @id @default(uuid())
  userId          String
  status          OrderStatus @default(AWAITING_PAYMENT)
  subtotal        Decimal
  shippingAmount  Decimal     @default(0)
  total           Decimal
  addressId       String
  couponId        String?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}
```

### OrderCommission (Commission Routing)

```prisma
model OrderCommission {
  id              String   @id @default(uuid())
  orderId         String
  orderItemId     String
  manufacturerId  String
  celebrityId     String?
  subtotal        Decimal
  platformFee     Decimal  // 10%
  celebrityFee    Decimal  // 5%
  manufacturerNet Decimal  // 85%
  status          String   @default("pending")
}
```

### ProductEmbedding (AI)

```prisma
model ProductEmbedding {
  id         String   @id @default(uuid())
  productId  String   @unique
  embedding  Float[]            // pgvector float array
  model      String
  updatedAt  DateTime @updatedAt
}
```

### ModelRegistry (MLOps)

```prisma
model ModelRegistry {
  id          String   @id @default(uuid())
  name        String
  version     String
  framework   String
  metrics     Json
  status      String   @default("staged")
  activatedAt DateTime?
  createdAt   DateTime @default(now())
}
```

---

## Enums

| Enum | Values |
|---|---|
| `UserRole` | CUSTOMER, CELEBRITY, ADMIN, SUPER_ADMIN, MANUFACTURER_PARTNER, CELEBRITY_MANAGER, CONTENT_MODERATOR, ANALYST |
| `Industry` | BOLLYWOOD, TOLLYWOOD, KOLLYWOOD, MOLLYWOOD, HOLLYWOOD, OTT, MUSIC, SPORTS, FASHION, POLITICS, OTHER |
| `OrderStatus` | AWAITING_PAYMENT, PLACED, CONFIRMED, PRODUCTION_STARTED, QUALITY_CHECK, SHIPPED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED |
| `Occasion` | PARTY, WEDDING, FESTIVAL, CASUAL, AWARD, PREMIERE, ENDORSEMENT, FILM, CORPORATE, SPORTS |

---

## Indexes

Critical indexes for performance:

| Table | Column(s) | Type | Reason |
|---|---|---|---|
| `User` | `email` | UNIQUE | Login lookup |
| `Order` | `userId` | INDEX | User order history |
| `Order` | `status` | INDEX | Status filtering |
| `Product` | `celebrityId` | INDEX | Celebrity outfit listing |
| `ProductEmbedding` | `embedding` | HNSW (pgvector) | ANN similarity search |
| `RecommendationFeedback` | `userId`, `productId` | INDEX | Feedback aggregation |
| `CoPurchasedPair` | `productId` | INDEX | Co-purchase lookup |

---

## Connection Configuration

```
# Production (via PgBouncer)
DATABASE_URL="postgresql://user:pass@pooler.host:6543/db?pgbouncer=true"

# Direct (for Prisma migrations)
DIRECT_URL="postgresql://user:pass@direct.host:5432/db"
```

**PgBouncer mode**: Transaction — allows hundreds of app connections with a small PostgreSQL pool.

---

## Migration Strategy

```bash
# Development: create and apply migration
npx prisma migrate dev --name describe_change

# Production: apply pending migrations (no prompt)
npx prisma migrate deploy

# Generate Prisma client after schema change
npx prisma generate
```

All migrations are tracked in `apps/backend/prisma/migrations/` with timestamped directories.
