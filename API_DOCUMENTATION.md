# CelebStyle — API Documentation

> Version 1.0.0 · July 2026 · Express 5 + TypeScript

All API responses follow `{ data: T }` envelope. Base URL: `http://localhost:4000` (dev) or your production domain.

---

## Authentication

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | None | Register new user account |
| POST | `/api/auth/login` | None | Login, receive access + refresh tokens |
| POST | `/api/auth/refresh` | Cookie | Refresh access token |
| POST | `/api/auth/logout` | JWT | Invalidate refresh token |
| POST | `/api/auth/verify-email` | None | Verify email with token |
| POST | `/api/auth/resend-verification` | None | Resend email verification |
| POST | `/api/auth/forgot-password` | None | Request password reset email |
| POST | `/api/auth/reset-password` | None | Reset password with token |
| GET | `/api/auth/me` | JWT | Get current user profile |
| PATCH | `/api/auth/me` | JWT | Update current user profile |
| DELETE | `/api/auth/me` | JWT | Soft-delete account |

### Request / Response Examples

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass!42",
  "name": "Jane Doe"
}
```

```json
{
  "data": {
    "user": { "id": "...", "email": "user@example.com", "role": "CUSTOMER" },
    "accessToken": "eyJhbGci...",
    "message": "Verification email sent"
  }
}
```

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "SecurePass!42" }
```

```json
{
  "data": {
    "user": { "id": "...", "email": "...", "role": "CUSTOMER" },
    "accessToken": "eyJhbGci..."
  }
}
```
Refresh token is set as `httpOnly` cookie.

---

## Celebrities

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/celebrities` | None | List all celebrities |
| GET | `/api/celebrities/:id` | None | Get celebrity by ID |
| POST | `/api/celebrities` | ADMIN | Create celebrity |
| PUT | `/api/celebrities/:id` | ADMIN | Update celebrity |
| DELETE | `/api/celebrities/:id` | ADMIN | Delete celebrity |

### Query Parameters (GET /api/celebrities)

| Param | Type | Description |
|---|---|---|
| `industry` | string | Filter by industry (BOLLYWOOD, HOLLYWOOD, etc.) |

```http
GET /api/celebrities?industry=BOLLYWOOD
```

```json
{
  "data": [
    {
      "id": "celeb-001",
      "name": "Deepika Padukone",
      "industry": "BOLLYWOOD",
      "profileImageUrl": "https://...",
      "bannerImageUrl": "https://..."
    }
  ]
}
```

---

## Outfits / Products

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/outfits` | None | List all outfits |
| GET | `/api/outfits/:id` | None | Get outfit by ID |
| POST | `/api/outfits` | ADMIN | Create outfit |
| PUT | `/api/outfits/:id` | ADMIN | Update outfit |
| DELETE | `/api/outfits/:id` | ADMIN | Delete outfit |

### Query Parameters (GET /api/outfits)

| Param | Type | Description |
|---|---|---|
| `celebrityId` | string | Filter by celebrity |
| `occasion` | string | Filter by occasion |
| `season` | string | Filter by season |
| `minPrice` | number | Minimum price filter |
| `maxPrice` | number | Maximum price filter |

---

## Manufacturers

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/manufacturers` | None | List all manufacturers |
| GET | `/api/manufacturers/:id` | None | Get manufacturer by ID |
| POST | `/api/manufacturers` | ADMIN | Create manufacturer |
| PUT | `/api/manufacturers/:id` | ADMIN | Update manufacturer |
| DELETE | `/api/manufacturers/:id` | ADMIN | Delete manufacturer |

---

## Cart

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/cart` | JWT | Get current user's cart |
| POST | `/api/cart/items` | JWT | Add item to cart |
| PATCH | `/api/cart/items/:itemId` | JWT | Update item quantity |
| DELETE | `/api/cart/items/:itemId` | JWT | Remove item from cart |
| DELETE | `/api/cart` | JWT | Clear entire cart |

---

## Addresses

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/addresses` | JWT | List user's saved addresses |
| POST | `/api/addresses` | JWT | Create new address |
| PUT | `/api/addresses/:id` | JWT | Update address |
| DELETE | `/api/addresses/:id` | JWT | Delete address |
| PATCH | `/api/addresses/:id/default` | JWT | Set as default address |

---

## Orders

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/orders` | JWT | List current user's orders |
| GET | `/api/orders/:id` | JWT | Get order details |
| POST | `/api/orders` | JWT | Create order from cart |
| POST | `/api/orders/:id/pay` | JWT | Simulate Razorpay payment |
| PATCH | `/api/orders/:id/status` | ADMIN | Advance order status |
| GET | `/api/orders/:id/commission` | ADMIN | Get commission breakdown |

### Order Status Lifecycle

```
AWAITING_PAYMENT → PLACED → CONFIRMED → PRODUCTION_STARTED
→ QUALITY_CHECK → SHIPPED → OUT_FOR_DELIVERY → DELIVERED
```

---

## Checkout

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/checkout/validate` | JWT | Validate cart + address before order |
| POST | `/api/checkout/coupons/apply` | JWT | Apply coupon code |
| DELETE | `/api/checkout/coupons` | JWT | Remove applied coupon |

---

## Returns

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/returns` | JWT | Request return for order item |
| GET | `/api/returns` | JWT | List user's returns |
| GET | `/api/returns/:id` | JWT | Get return details |
| PATCH | `/api/returns/:id/approve` | ADMIN | Approve return |
| PATCH | `/api/returns/:id/reject` | ADMIN | Reject return |
| POST | `/api/returns/:id/refund` | ADMIN | Issue refund |

---

## Inventory

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/inventory` | ADMIN | List all inventory |
| GET | `/api/inventory/:productId` | ADMIN | Inventory for product |
| POST | `/api/inventory/adjust` | ADMIN | Adjust stock level |
| POST | `/api/inventory/reserve` | JWT | Reserve stock (during checkout) |
| DELETE | `/api/inventory/reserve/:id` | JWT | Release reservation |

---

## Storefronts

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/storefronts` | None | List all storefronts |
| GET | `/api/storefronts/:id` | None | Get storefront |
| POST | `/api/storefronts` | ADMIN | Create storefront |
| GET | `/api/storefronts/:id/commission` | ADMIN | Commission dashboard |

---

## Recommendations (AI)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/recommendations` | JWT | Personalised recommendations |
| GET | `/api/recommendations/trending` | None | Trending outfits |
| GET | `/api/recommendations/similar/:productId` | None | Similar products |
| POST | `/api/feedback/impression` | JWT | Log recommendation impression |
| POST | `/api/feedback/click` | JWT | Log recommendation click |

---

## ML & MLOps

All `/api/ml/*` endpoints require `ADMIN` or `SUPER_ADMIN`.

| Method | Path | Description |
|---|---|---|
| GET | `/api/ml/models` | List all model versions |
| POST | `/api/ml/models` | Register model version |
| POST | `/api/ml/models/:id/activate` | Activate a model |
| GET | `/api/ml/models/:name/versions` | All versions of a model |
| POST | `/api/ml/deploy` | Deploy (blue-green/canary/pinned) |
| POST | `/api/ml/rollback` | Rollback deployment |
| GET | `/api/ml/metrics` | ML monitoring metrics |
| GET | `/api/ml/drift` | Feature drift report |
| GET | `/api/ml/health` | ML health summary |
| GET | `/api/ml/alerts` | Unresolved MLOps alerts |
| POST | `/api/ml/alerts/:id/resolve` | Resolve an alert |

---

## Operations Monitoring

All `/api/ops/*` endpoints require `ADMIN` or `SUPER_ADMIN`.

| Method | Path | Description |
|---|---|---|
| GET | `/api/ops/metrics` | System metrics (CPU, memory, requests) |
| GET | `/api/ops/health` | Detailed health status |
| GET | `/api/ops/alerts` | Active + recent alerts |
| POST | `/api/ops/alerts/:alertId/acknowledge` | Acknowledge alert |
| GET | `/api/ops/traces` | Recent distributed traces |
| GET | `/api/ops/performance` | Performance monitoring |

---

## Security

All `/api/security/*` endpoints require `ADMIN` or `SUPER_ADMIN`.

| Method | Path | Description |
|---|---|---|
| GET | `/api/security/audit` | Run OWASP Top 10 audit |
| POST | `/api/security/scan` | Full security scan |
| GET | `/api/security/rate-limits` | Current rate limit rules |
| GET | `/api/security/secrets` | Secrets validation report |
| GET | `/api/security/backup` | Backup validation status |
| GET | `/api/security/recovery` | Circuit breaker status |
| GET | `/api/security/optimizations` | Performance recommendations |

---

## Release

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/release/status` | None | Current release status |
| GET | `/api/release/version` | None | Version and build info |
| GET | `/api/release/report` | ADMIN | Full release audit report |

### GET /api/release/status

```json
{
  "data": {
    "version": "1.0.0",
    "status": "PRODUCTION_READY",
    "launchApproved": true,
    "overallScore": 92,
    "timestamp": "2026-07-04T00:00:00Z"
  }
}
```

---

## Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | None | Liveness check |
| GET | `/api/health/ready` | None | Readiness check (DB) |
| GET | `/api/health/startup` | None | Startup probe |

---

## Error Format

All errors return:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required",
    "statusCode": 401
  }
}
```

| Status | Meaning |
|---|---|
| 400 | Validation error — check request body |
| 401 | Missing or expired JWT |
| 403 | Insufficient role |
| 404 | Resource not found |
| 409 | Conflict (duplicate email, etc.) |
| 422 | Unprocessable entity |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## JWT Usage

Include the access token in every authenticated request:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Access tokens expire in **15 minutes**. Use `POST /api/auth/refresh` (with the `refreshToken` cookie) to obtain a new one.
