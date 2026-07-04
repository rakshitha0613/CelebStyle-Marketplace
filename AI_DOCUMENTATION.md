# CelebStyle — AI & Machine Learning Documentation

> Version 1.0.0 · July 2026

---

## Overview

CelebStyle's AI platform delivers personalised outfit recommendations using a multi-stage pipeline: collaborative filtering → content similarity → diversity injection → A/B-tested ranking. An MLOps layer manages model lifecycle from registration through deployment, drift detection, and alerting.

---

## Recommendation Pipeline

```
User Request
    │
    ▼
CollaborativeFilteringService
    • Co-purchase graph (CoPurchasedPair)
    • Co-view graph (CoviewedPair)
    • User–item implicit feedback
    │
    ▼
SimilarityService
    • ProductEmbedding vectors (pgvector)
    • Cosine similarity between target and candidates
    │
    ▼
RankingService
    • Multi-signal score: recency, popularity, price affinity, style match
    • Re-ranks collaborative + similarity candidates
    │
    ▼
DiversityService
    • Injects variety by genre, price tier, celebrity source
    • Prevents filter bubble / echo chamber
    │
    ▼
ExperimentService (A/B testing)
    • Traffic split by ExperimentAssignment (deterministic by userId)
    • Variants: baseline vs. exploration vs. celebrity-boost
    │
    ▼
RecommendationFeedback Loop
    • Impression logged on display
    • Click, wishlist, addToCart, purchase → ground truth
    • Drives next model training cycle
```

---

## Feature Store

`UserFeatureStore` and `ProductFeatureStore` tables cache pre-computed features:

| Feature type | Source | TTL |
|---|---|---|
| User embedding | Collaborative filtering | Nightly recompute |
| Product embedding | Content features (category, brand, price) | On product update |
| User purchase history | OrderItem aggregation | Real-time |
| Trending score | TrendingProduct rolling window | Hourly |
| Price affinity | User order price distribution | Nightly |

---

## Collaborative Filtering

**Algorithm**: Implicit feedback matrix factorization approximated via co-occurrence graphs.

**Data sources**:
- `CoPurchasedPair` — items bought together within a session
- `CoviewedPair` — items viewed in the same session
- `RecommendationFeedback` — clicks, wishlists, purchases

**Cold start handling**: New users receive trending + celebrity-curated items until sufficient interaction history accumulates (threshold: 3 interactions).

---

## Content-Based Similarity

Outfit embeddings are stored in `ProductEmbedding` using pgvector. Features include:

- Category and subcategory tags
- Brand identity signals
- Price tier encoding
- Celebrity association strength
- Occasion encoding (PARTY, WEDDING, FESTIVAL, etc.)
- Season encoding

Similarity is computed as cosine distance via `<=>` pgvector operator.

---

## A/B Experiment Framework

```typescript
// ExperimentAssignment ensures deterministic user → variant mapping
// Traffic is split by percentage defined in the experiment config

ExperimentService.assignVariant(userId, experimentName)
// → "control" | "treatment_a" | "treatment_b"
```

Results are tracked in `RecommendationFeedback` with `experimentVariant` tag. Analysis queries group by variant to compute CTR and conversion rate.

---

## MLOps

### Model Registry

`ModelRegistry` stores versioned model metadata:

```
ModelRegistry
├── name: "recommendation-v2"
├── version: "2.3.1"
├── framework: "custom-python"
├── metrics: { ndcg: 0.847, mrr: 0.621 }
├── status: "active" | "staged" | "archived"
└── activatedAt: timestamp
```

### Deployment Modes

| Mode | Description |
|---|---|
| `blue-green` | Swap all traffic atomically to new version |
| `canary` | Ramp traffic % to new version gradually |
| `pinned` | Lock to a specific version, ignore newer models |

### Drift Detection

`DriftDetectionService` computes:

- **KL Divergence**: measures how much feature distribution has drifted from training baseline
- **PSI (Population Stability Index)**: segment-level drift indicator
- Alerts fire via `MLOpsAlertService` when drift exceeds configurable thresholds

### Prediction Logging

`PredictionLog` stores:
- Input features (at inference time)
- Predicted output (recommended item IDs + scores)
- Ground truth (actual user action, logged async)

Enables offline evaluation: precision@k, NDCG, MRR, coverage.

---

## API Endpoints

All ML endpoints require `ADMIN` or `SUPER_ADMIN` role.

| Method | Path | Description |
|---|---|---|
| GET | `/api/ml/models` | List all model versions |
| POST | `/api/ml/models` | Register a new model version |
| POST | `/api/ml/models/:id/activate` | Activate a model version |
| GET | `/api/ml/models/:name/versions` | All versions for a model |
| POST | `/api/ml/deploy` | Deploy a model (blue-green/canary/pinned) |
| POST | `/api/ml/rollback` | Rollback to previous deployment |
| GET | `/api/ml/metrics` | Monitoring metrics dashboard |
| GET | `/api/ml/drift` | Feature drift report |
| GET | `/api/ml/health` | ML system health summary |
| GET | `/api/ml/alerts` | Unresolved MLOps alerts |
| POST | `/api/ml/alerts/:id/resolve` | Resolve an alert |
| GET | `/api/recommendations` | Get personalised recommendations (auth) |
| POST | `/api/feedback/impression` | Record recommendation impression |
| POST | `/api/feedback/click` | Record recommendation click |

---

## Performance Characteristics

| Metric | Value | Notes |
|---|---|---|
| Recommendation latency (P50) | ~200ms | Fresh inference, no cache |
| Recommendation latency (P99) | ~800ms | Under load |
| Drift detection cadence | Hourly | Configurable |
| Model activation latency | < 1s | Atomic swap |
| Feature store update | Real-time (purchases), nightly (embeddings) | |

**Known gap**: Redis caching for recommendation responses is architecturally planned but not yet wired. This will reduce P50 to ~10ms for cached users (see TD-01 in technical debt).

---

## Explanation Service

`ExplanationService` provides human-readable explanations for why an item was recommended:

```json
{
  "itemId": "outfit-123",
  "reason": "Because you purchased similar items from Deepika Padukone's collection",
  "topFeatures": ["celebrity_match", "style_compat", "occasion_fit"]
}
```
