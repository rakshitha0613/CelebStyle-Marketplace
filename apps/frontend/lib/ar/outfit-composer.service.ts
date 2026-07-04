import type { OutfitItem, OutfitSlot, Outfit, ClothingSize } from './fit.types.js';
import { REQUIRED_SLOTS } from './fit.types.js';

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Stateful outfit-building service.
 * One item per slot; calling addItem on an occupied slot replaces the existing item.
 */
export class OutfitComposerService {
  private slots = new Map<OutfitSlot, OutfitItem>();
  private outfitName = 'My Outfit';

  // ── Slot management ────────────────────────────────────────────────────────

  addItem(item: OutfitItem): void {
    this.slots.set(item.slot, item);
  }

  removeItem(slot: OutfitSlot): void {
    this.slots.delete(slot);
  }

  getItem(slot: OutfitSlot): OutfitItem | null {
    return this.slots.get(slot) ?? null;
  }

  hasItem(slot: OutfitSlot): boolean {
    return this.slots.has(slot);
  }

  clearOutfit(): void {
    this.slots.clear();
  }

  setName(name: string): void {
    this.outfitName = name.trim() || 'My Outfit';
  }

  // ── Composition ────────────────────────────────────────────────────────────

  /**
   * Returns true when all REQUIRED_SLOTS are filled.
   */
  isComplete(): boolean {
    return REQUIRED_SLOTS.every((s) => this.slots.has(s));
  }

  getFilledSlots(): OutfitSlot[] {
    return [...this.slots.keys()];
  }

  getItemCount(): number {
    return this.slots.size;
  }

  /**
   * Builds an immutable Outfit snapshot from the current state.
   */
  buildOutfit(): Outfit | null {
    if (!this.isComplete()) return null;
    return {
      id:        randomId(),
      name:      this.outfitName,
      items:     [...this.slots.values()],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Loads a saved outfit back into the composer (for editing).
   */
  loadOutfit(outfit: Outfit): void {
    this.slots.clear();
    this.outfitName = outfit.name;
    for (const item of outfit.items) {
      this.slots.set(item.slot, item);
    }
  }

  /**
   * Naive type-based style compatibility score (0–100).
   * Returns 100 when only one slot is filled.
   */
  computeCompatibility(): number {
    const types = [...this.slots.values()].map((i) => i.garmentType);
    if (types.length <= 1) return 100;

    const pairScores = new Map<string, number>([
      ['T_SHIRT|BOTTOM',  85],
      ['SHIRT|BOTTOM',    90],
      ['JACKET|SHIRT',    92],
      ['JACKET|T_SHIRT',  78],
      ['HOODIE|BOTTOM',   88],
      ['JACKET|BOTTOM',   85],
    ]);

    let total = 0; let count = 0;
    for (let i = 0; i < types.length; i++) {
      for (let j = i + 1; j < types.length; j++) {
        const key  = `${types[i]}|${types[j]}`;
        const key2 = `${types[j]}|${types[i]}`;
        const score = pairScores.get(key) ?? pairScores.get(key2) ?? 70;
        total += score; count++;
      }
    }
    return count > 0 ? Math.round(total / count) : 100;
  }
}
