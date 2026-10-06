// config/olp.json（行動指針12項目）の読み込み。サーバー側で使う
import olpJson from "../../config/olp.json";

export type Principle = { id: number; name: string; description: string };

/**
 * AIが書いた行動指針の名前を、一覧にある名前に合わせる。
 * 一覧の名前を含んでいれば一致とみなし（「〇〇：説明」のような書き方に対応）、合わなければ空文字にする
 */
export function matchPrinciple(value: string, names: string[]): string {
  const v = value.trim();
  if (!v) return "";
  return names.find((name) => v === name) ?? names.find((name) => v.includes(name)) ?? "";
}

/** 名前が入っている項目だけを返す（空欄の項目はコメントに使わない） */
export function loadPrinciples(source: unknown = olpJson): Principle[] {
  const list = (source as { principles?: unknown }).principles;
  if (!Array.isArray(list)) return [];
  return list
    .filter(
      (item): item is Principle =>
        typeof item?.id === "number" && typeof item?.name === "string" && typeof item?.description === "string",
    )
    .map((item) => ({ id: item.id, name: item.name.trim(), description: item.description.trim() }))
    .filter((item) => item.name !== "");
}
