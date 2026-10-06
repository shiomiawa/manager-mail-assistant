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
