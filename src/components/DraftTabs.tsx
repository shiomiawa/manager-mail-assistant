"use client";

/** プレビューの上の、下書きの切り替え（例：Coaching Sheet／To Employee）。自分用の下書きには印を付ける */
export function DraftTabs<K extends string>({
  items,
  current,
  onSelect,
  label,
}: {
  items: { key: K; label: string; sendable: boolean }[];
  current: K;
  onSelect: (key: K) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 border-b border-line bg-rail px-3 pt-2">
      {items.map((item) => {
        const selected = item.key === current;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(item.key)}
            className={`-mb-px rounded-t-md border px-4 py-1.5 text-[13px] ${
              selected ? "border-line border-b-bar bg-bar font-semibold text-brand-800" : "border-transparent text-muted hover:text-brand-700"
            }`}
          >
            {item.label}
            {!item.sendable && <span className="ml-1 text-[11px] text-muted">（自分用）</span>}
          </button>
        );
      })}
    </div>
  );
}
