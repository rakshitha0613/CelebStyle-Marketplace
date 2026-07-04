# CelebStyle — AR Platform Documentation

> Version 1.0.0 · July 2026

---

## Overview

The CelebStyle AR platform enables virtual try-on of celebrity outfits directly in the browser. It uses MediaPipe for real-time pose detection, WebGL for garment overlay rendering, and a body measurement pipeline to recommend accurate sizes — all running locally on the user's device with no data leaving the browser.

---

## Privacy Architecture

**All AR processing is local-only:**

| Constraint | Implementation |
|---|---|
| Camera frames never leave device | MediaPipe runs in Web Worker, no data transmitted |
| No persistent recording | Frames processed and discarded each tick; not stored to memory |
| Snapshots require explicit action | User taps the shutter button; nothing captured automatically |
| Remote upload is always opt-in | Snapshots stored locally by default |

---

## System Architecture

```
Browser Camera (getUserMedia)
    │  WebRTC stream
    ▼
MediaPipe Pose (Web Worker)
    │  33 pose landmarks × {x, y, z, visibility}
    ▼
BodyMeasurementService
    │  chest circumference (cm)
    │  shoulder width (cm)
    │  sleeve length (cm)
    ▼
SizeRecommendationService
    │  recommended size (XS–XXL)
    │  confidence score [0, 1]
    │  brand-specific adjustments
    ▼
GarmentAssetLoader
    │  loads garment texture + mesh
    ▼
WebGL Renderer (GarmentOverlayService)
    │  maps texture to body landmarks
    │  applies transparency, blending
    ▼
Canvas Compositor
    │  composites video + overlay
    ▼
Display (Browser canvas element)
```

---

## Services

### BodyMeasurementService

Estimates physical measurements from MediaPipe pose landmarks:

```typescript
estimateMeasurements(
  landmarks: NormalizedLandmark[],
  canvasWidth: number,
  canvasHeight: number,
  visibilityThreshold = 0.5
): PhysicalMeasurements | null
```

**Algorithm**:
1. Extract left/right shoulder landmarks (indices 11, 12)
2. Compute shoulder width in pixels
3. Scale to centimetres: `scaleFactor = REFERENCE_SHOULDER_CM(43) / shoulderWidthPx`
4. Derive chest circumference: `shoulderWidth × 2.2`
5. Returns null if shoulder visibility < threshold

### SizeRecommendationService

Maps physical measurements to clothing sizes:

```typescript
getRecommendedSize(
  measurements: PhysicalMeasurements,
  garmentType: GarmentType,
  brand?: string
): SizeRecommendation
```

Uses `STANDARD_SIZE_CHART` (XS through XXL) with optional brand-specific `scaleFactor` adjustments:

| Size | Chest (cm) | Shoulder (cm) |
|---|---|---|
| XS | 80–86 | 36–39 |
| S | 87–92 | 40–42 |
| M | 93–98 | 43–45 |
| L | 99–104 | 46–48 |
| XL | 105–110 | 49–51 |
| XXL | 111–117 | 52–55 |

### GarmentOverlayService

Renders garment textures over the live video using WebGL:

- Maps garment anchor points to body landmark positions
- Applies affine transform for scale, rotation, and translation
- Alpha blending for realistic transparency
- Supports up to 5 garment layers simultaneously

### OutfitComposerService

Manages a 5-slot outfit composition:

| Slot | Required |
|---|---|
| `top` | Yes |
| `bottom` | No |
| `jacket` | No |
| `shoes` | No |
| `accessory` | No |

`buildOutfit()` returns `null` when the required `top` slot is empty.

### OutfitScoringService

Scores a composed outfit across 7 weighted dimensions:

| Dimension | Weight | Description |
|---|---|---|
| `colorHarmony` | 0.25 | Color wheel compatibility between garments |
| `styleCompat` | 0.20 | Style category alignment (casual/formal/etc.) |
| `seasonScore` | 0.15 | Seasonal appropriateness |
| `trendingScore` | 0.15 | Trend alignment with current season |
| `occasionScore` | 0.15 | Occasion match (party, wedding, etc.) |
| `personalScore` | 0.05 | Match to user's historical preferences |
| `celebritySimilarity` | 0.05 | Closeness to original celebrity outfit |

**API**:
```typescript
scoreOutfit(items: OutfitItem[], season?: Season, occasion?: Occasion): OutfitScore
// Returns: { overall: number; breakdown: Record<string, number> }
```

### WishlistOverlayService

Manages saved outfits and cart integration:

- `addToWishlist(outfit)` — saves outfit to wishlist
- `addAllToCart(outfit)` — writes all outfit items to `localStorage` (`celebstyle-cart`)
- `generateShareableUrl(outfit)` — base64-encodes outfit and appends to current URL as `?outfit=<base64>`

---

## FitIndicator Component

Displays fit feedback with colour-coded status:

| Fit | Colour | Meaning |
|---|---|---|
| PERFECT | Green | Measurements within 5% of size range |
| TOO_TIGHT | Red | Measurements above size range |
| TOO_LOOSE | Blue | Measurements below size range |

Renders with `role="status" aria-live="polite"` for screen reader accessibility.

---

## Type Reference

```typescript
type OutfitSlot = 'top' | 'bottom' | 'jacket' | 'shoes' | 'accessory';
type ClothingSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';
type GarmentType = 'shirt' | 'jacket' | 'dress' | 'pants' | 'skirt' | 'shoes' | 'accessory';

interface PhysicalMeasurements {
  chestCircumference: number;   // cm
  shoulderWidth: number;        // cm
  sleeveLength?: number;        // cm
}

interface SizeRecommendation {
  size: ClothingSize;
  confidence: number;           // 0-1
  notes?: string;
  brandSpecific?: boolean;
}
```

---

## Integration with TryOnClient

`TryOnClient.tsx` wires all services together:

```typescript
// Singletons via useRef (stable across renders)
const bodyMeasSvc = useRef(new BodyMeasurementService());
const sizeRecSvc  = useRef(new SizeRecommendationService());
const composerSvc = useRef(new OutfitComposerService());
const scoringSvc  = useRef(new OutfitScoringService());
const wishlistSvc = useRef(new WishlistOverlayService());

// Per-frame pipeline
function onFrame(landmarks: NormalizedLandmark[]) {
  const measurements = bodyMeasSvc.current.estimateMeasurements(landmarks, 640, 480);
  if (measurements && selectedGarment) {
    const rec = sizeRecSvc.current.getRecommendedSize(measurements, selectedGarment.type);
    setSizeRecommendation(rec);
  }
}
```

---

## Test Coverage

| Test suite | File | Assertions |
|---|---|---|
| Camera | `ar.camera.test.ts` | 37 |
| Segmentation | `ar.segmentation.test.ts` | 81 |
| Overlay | `ar.overlay.test.ts` | 84 |
| 3D rendering | `ar.3d.test.ts` | 123 |
| Fit / Size / Outfit | `ar.fit.test.ts` | 100 |
| **Total** | | **425** |
