// 在籍期間の読み取りと表示

/**
 * 「02years,05months」の形（Excelの在籍期間の列）を、か月に直す。
 * 「2年5か月」「2年5ヶ月」の形も受け付ける。読み取れなければ null
 */
export function parseTenure(text: string): number | null {
  const value = text.trim();
  const english = value.match(/^(\d+)\s*years?\s*,\s*(\d+)\s*months?$/i);
  const japanese = value.match(/^(\d+)\s*年\s*(\d+)\s*[かヶケカ]?月$/);
  const match = english ?? japanese;
  if (!match) return null;
  const years = Number(match[1]);
  const months = Number(match[2]);
  if (months >= 12) return null;
  return years * 12 + months;
}

/** 画面・メール用の表示（例：29 → 「2年5か月」、3 → 「3か月」） */
export function formatTenure(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest}か月`;
  if (rest === 0) return `${years}年`;
  return `${years}年${rest}か月`;
}
