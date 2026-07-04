'use client';

import { useState, useCallback } from 'react';
import type { OutfitItem, OutfitSlot, OutfitScore } from '@/lib/ar/fit.types';
import { ALL_SLOTS, REQUIRED_SLOTS } from '@/lib/ar/fit.types';
import { OutfitScoreCard } from './OutfitScoreCard';

interface Props {
  slots: Map<OutfitSlot, OutfitItem>;
  score: OutfitScore | null;
  isComplete: boolean;
  outfitName: string;
  onRemoveItem: (slot: OutfitSlot) => void;
  onSetName: (name: string) => void;
  onBuildOutfit: () => void;
  onClear: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const SLOT_LABELS: Record<OutfitSlot, string> = {
  top:       'Top',
  bottom:    'Bottom',
  jacket:    'Outerwear',
  shoes:     'Footwear',
  accessory: 'Accessory',
};

const SLOT_ICONS: Record<OutfitSlot, string> = {
  top:       '👕',
  bottom:    '👖',
  jacket:    '🧥',
  shoes:     '👟',
  accessory: '⌚',
};

function SlotCard({
  slot,
  item,
  required,
  onRemove,
}: {
  slot: OutfitSlot;
  item: OutfitItem | null;
  required: boolean;
  onRemove: (slot: OutfitSlot) => void;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 flex items-center gap-3 transition-colors ${
        item
          ? 'border-white/20 bg-white/5'
          : required
          ? 'border-dashed border-white/20 bg-white/2'
          : 'border-dashed border-white/10 bg-transparent'
      }`}
    >
      <span className="text-lg" aria-hidden="true">{SLOT_ICONS[slot]}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-white/60">{SLOT_LABELS[slot]}</span>
          {required && !item && (
            <span className="text-[10px] text-orange-400 bg-orange-400/10 rounded px-1">required</span>
          )}
        </div>
        {item ? (
          <p className="text-sm text-white font-medium truncate">{item.garmentName}</p>
        ) : (
          <p className="text-xs text-white/30">Empty</p>
        )}
      </div>
      {item && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-white/40 font-medium">{item.size}</span>
          <button
            onClick={() => onRemove(slot)}
            className="text-white/30 hover:text-red-400 transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded"
            aria-label={`Remove ${item.garmentName} from ${SLOT_LABELS[slot]}`}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export function OutfitComposer({
  slots,
  score,
  isComplete,
  outfitName,
  onRemoveItem,
  onSetName,
  onBuildOutfit,
  onClear,
  isCollapsed = false,
  onToggleCollapse,
}: Props) {
  const [isScoreOpen, setIsScoreOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(outfitName);

  const handleRenameSubmit = useCallback(() => {
    onSetName(nameInput);
    setIsRenaming(false);
  }, [nameInput, onSetName]);

  const filledCount = slots.size;
  const requiredCount = REQUIRED_SLOTS.length;

  return (
    <section
      className="bg-white/5 rounded-2xl overflow-hidden"
      aria-labelledby="outfit-composer-heading"
    >
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        aria-expanded={!isCollapsed}
        aria-controls="outfit-composer-body"
        onClick={onToggleCollapse}
      >
        <div className="flex items-center gap-2">
          <h3
            id="outfit-composer-heading"
            className="text-sm font-semibold text-white/80 tracking-wide uppercase"
          >
            Outfit Composer
          </h3>
          <span className="text-xs text-white/40 tabular-nums">
            {filledCount}/{requiredCount}
          </span>
        </div>
        <span
          className={`text-white/40 text-xs transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
          aria-hidden="true"
        >
          ▲
        </span>
      </button>

      {/* Body */}
      {!isCollapsed && (
        <div id="outfit-composer-body" className="px-4 pb-4 space-y-4">
          {/* Name row */}
          <div className="flex items-center gap-2">
            {isRenaming ? (
              <form
                className="flex gap-2 flex-1"
                onSubmit={(e) => { e.preventDefault(); handleRenameSubmit(); }}
              >
                <input
                  className="flex-1 bg-white/10 rounded-lg px-2 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-white/40"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  autoFocus
                  aria-label="Outfit name"
                  maxLength={50}
                />
                <button
                  type="submit"
                  className="text-xs text-white/60 hover:text-white px-2 py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  Save
                </button>
              </form>
            ) : (
              <>
                <span className="text-sm text-white/70 flex-1 truncate">{outfitName}</span>
                <button
                  onClick={() => { setNameInput(outfitName); setIsRenaming(true); }}
                  className="text-xs text-white/30 hover:text-white/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded"
                  aria-label="Rename outfit"
                >
                  ✏️
                </button>
              </>
            )}
          </div>

          {/* Slots */}
          <div className="space-y-2" role="list" aria-label="Outfit slots">
            {ALL_SLOTS.map((slot) => (
              <div key={slot} role="listitem">
                <SlotCard
                  slot={slot}
                  item={slots.get(slot) ?? null}
                  required={REQUIRED_SLOTS.includes(slot)}
                  onRemove={onRemoveItem}
                />
              </div>
            ))}
          </div>

          {/* Score card (when outfit is not empty) */}
          {filledCount > 0 && score && (
            <OutfitScoreCard
              score={score}
              isCollapsed={!isScoreOpen}
              onToggleCollapse={() => setIsScoreOpen((v) => !v)}
            />
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={onBuildOutfit}
              disabled={!isComplete}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40
                disabled:opacity-30 disabled:cursor-not-allowed
                enabled:bg-white enabled:text-black enabled:hover:bg-white/90"
              aria-disabled={!isComplete}
              aria-describedby={!isComplete ? 'composer-hint' : undefined}
            >
              Save Outfit
            </button>
            {filledCount > 0 && (
              <button
                onClick={onClear}
                className="px-4 rounded-xl py-2.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                aria-label="Clear all slots"
              >
                Clear
              </button>
            )}
          </div>
          {!isComplete && (
            <p id="composer-hint" className="text-xs text-white/30 text-center">
              Fill the Top slot to save your outfit
            </p>
          )}
        </div>
      )}
    </section>
  );
}
