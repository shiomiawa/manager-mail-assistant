import { timingSafeEqual } from "node:crypto";

// 公開URLからの使いすぎを防ぐ仕組み（サーバー側だけで使う。hotel-review-ai と同じ仕組み）
// ① デモ用パスコード：環境変数 DEMO_PASSCODE を設定したときだけ、AIのAPIでパスコードを求める
// ② 1日の上限：AIの呼び出し回数を、1日ごとに数えて上限を超えたら断る
//
// データベースを使わないので、回数はサーバーのメモリで数える。
// Vercel ではサーバーが入れ替わると数え直しになるため、上限は「念のため」の守り。主な守りはパスコード。

export const PASSCODE_HEADER = "x-demo-passcode";

export type QuotaKind = "weeklyComments" | "meetingDrafts" | "briefingNotes" | "coaching" | "kudos";

// 1日の上限の初期値（環境変数で変えられる）
const DEFAULT_LIMITS: Record<QuotaKind, number> = {
  weeklyComments: 100, // 週次レポートのコメント（チーム向け・個人向け）
  meetingDrafts: 30, // 会議メモからの下書き
  briefingNotes: 30, // 説明会の自分用メモ
  coaching: 50, // アンケートのコーチング
  kudos: 50, // 称賛メール
};
const LIMIT_ENV: Record<QuotaKind, string> = {
  weeklyComments: "DAILY_LIMIT_WEEKLY_COMMENTS",
  meetingDrafts: "DAILY_LIMIT_MEETING_DRAFTS",
  briefingNotes: "DAILY_LIMIT_BRIEFING_NOTES",
  coaching: "DAILY_LIMIT_COACHING",
  kudos: "DAILY_LIMIT_KUDOS",
};
const LABELS: Record<QuotaKind, string> = {
  weeklyComments: "週次レポートのコメント",
  meetingDrafts: "会議メモからの下書き",
  briefingNotes: "説明会のメモ",
  coaching: "アンケートのコーチング",
  kudos: "称賛メール",
};

export function dailyLimit(kind: QuotaKind): number {
  const v = Number(process.env[LIMIT_ENV[kind]]);
  return Number.isInteger(v) && v >= 0 ? v : DEFAULT_LIMITS[kind];
}

// 日付は日本時間で区切る
const todayJst = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

const usage = new Map<string, number>(); // "2026-10-07|meetingDrafts" → 回数

export const passcodeRequired = () => Boolean(process.env.DEMO_PASSCODE);

// パスコードが必要な環境で、正しいパスコードが付いていなければ 401 を返す
export function checkPasscode(request: Request): Response | null {
  const expected = process.env.DEMO_PASSCODE;
  if (!expected) return null;
  const given = request.headers.get(PASSCODE_HEADER) ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  // 長さが違うときも同じように扱い、一致の判定は時間差で推測されない方法で行う
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (ok) return null;
  return Response.json(
    {
      error: given ? "パスコードが違います。" : "AIで下書きを作るには、デモ用パスコードの入力が必要です。",
      code: "PASSCODE_REQUIRED",
    },
    { status: 401 },
  );
}

// 1日の上限を超えないか確かめ、超えなければ1回数える（超えるときは 429 を返し、数えない）
export function takeQuota(kind: QuotaKind): Response | null {
  const key = `${todayJst()}|${kind}`;
  // 前日までの記録は捨てる
  for (const k of usage.keys()) if (!k.startsWith(todayJst())) usage.delete(k);
  const used = usage.get(key) ?? 0;
  const limit = dailyLimit(kind);
  if (used + 1 > limit) {
    return Response.json(
      {
        error: `本日の${LABELS[kind]}の上限（${limit}回）に達しました。明日（日本時間0時）以降にもう一度お試しください。`,
        code: "DAILY_LIMIT",
      },
      { status: 429 },
    );
  }
  usage.set(key, used + 1);
  return null;
}

// AIの呼び出しに失敗したときは、数えた分を戻す（使っていない分で上限を減らさないため）
export function refundQuota(kind: QuotaKind) {
  const key = `${todayJst()}|${kind}`;
  usage.set(key, Math.max(0, (usage.get(key) ?? 0) - 1));
}
