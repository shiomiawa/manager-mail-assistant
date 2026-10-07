// 称賛メールの入力を確かめる（問題があれば日本語の理由を返す）。画面とサーバーの両方で使う
import { MAX_QUOTES } from "./data";
import type { KudosInput } from "./types";

export const MAX_EPISODE_LENGTH = 1000;
export const MAX_NAME_LENGTH = 40;

export function aiKudosReady(input: KudosInput | undefined): string | null {
  if (!input || typeof input !== "object") return "入力がありません。";
  if (typeof input.name !== "string" || !input.name.trim()) return "ほめる人を選ぶか、名前を入れてください。";
  if (input.name.length > MAX_NAME_LENGTH) return `名前は${MAX_NAME_LENGTH}字までにしてください。`;
  if (typeof input.episode !== "string" || input.episode.trim().length < 10) {
    return "具体的な行動（エピソード）を10字以上で書いてください。";
  }
  if (input.episode.length > MAX_EPISODE_LENGTH) return `エピソードは${MAX_EPISODE_LENGTH}字までにしてください。`;
  if (!Array.isArray(input.quotes) || input.quotes.length > MAX_QUOTES) return `お客様の声は${MAX_QUOTES}件まで選べます。`;
  if (input.quotes.some((q) => typeof q?.text !== "string" || q.text.length > 500)) return "お客様の声の内容が正しくありません。";
  if (!Array.isArray(input.trend) || input.trend.length > 4 || input.trend.some((t) => typeof t !== "string" || t.length > 200)) {
    return "推移のデータが正しくありません。";
  }
  if (typeof input.includeTeam !== "boolean") return "入力が正しくありません。";
  return null;
}
