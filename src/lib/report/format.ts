// 数字・日付の表示（画面とメールで同じ書き方にする）
// 「〜件」「〜分」は日本語の文章用、「〜 min」や単位なしはラベル・表用

// 文章用
export const formatCount = (value: number) => `${formatNumber(value)}件`;
export const formatMinutes = (value: number) => `${value.toFixed(1)}分`;

// ラベル・表用
export const formatNumber = (value: number) => Math.round(value).toLocaleString("ja-JP");
export const formatMin = (value: number) => `${value.toFixed(1)} min`;

export const formatSatisfaction = (value: number) => value.toFixed(2);
export const formatScore = (value: number) => value.toFixed(1);

/** 差の表示（例：+0.05、−63件）。0 は ±0.00 のように桁をそろえる */
export function formatDiff(value: number, digits: number, unit = ""): string {
  const rounded = Number(value.toFixed(digits));
  const text = (n: number) =>
    n.toLocaleString("ja-JP", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (rounded === 0) return `±${text(0)}${unit}`;
  return `${rounded > 0 ? "+" : "−"}${text(Math.abs(rounded))}${unit}`;
}

/** 2026-09-28 → 9/28（件名用の短い日付） */
export const formatShortDate = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

/** 2026-09-28 → 2026/09/28 */
export const formatDate = (iso: string) => iso.replaceAll("-", "/");

/** 週の期間（例：2026/09/28–10/02） */
export function formatWeekRange(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start.getTime() + 4 * 24 * 60 * 60 * 1000);
  const mm = String(end.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(end.getUTCDate()).padStart(2, "0");
  return `${formatDate(weekStart)}–${mm}/${dd}`;
}
