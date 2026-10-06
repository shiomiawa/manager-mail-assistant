// config/olp.json（行動指針12項目）の読み込み。サーバー側で使う
import olpJson from "../../config/olp.json";

export type Principle = { id: number; name: string; description: string };

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
