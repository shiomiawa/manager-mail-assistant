// アンケートのコーチング（AIが書く区画）を返す
// USE_MOCK_AI が "false" のときだけ Claude を使う。それ以外はダミー（費用はかからない）
import { describeAIError, isMockAI } from "@/lib/claude";
import { coachingWithClaude } from "@/lib/coaching/aiCoaching";
import { mockCoachingDraft } from "@/lib/coaching/mockCoaching";
import type { CoachingInput } from "@/lib/coaching/types";
import { loadPrinciples } from "@/lib/olp";
import { checkPasscode, refundQuota, takeQuota } from "@/lib/usageGuard";

const MAX_BODY_LENGTH = 50_000;
const MAX_MEMO_LENGTH = 1000;
const MAX_COMMENT_LENGTH = 500;

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY_LENGTH) return error("送信するデータが大きすぎます。", 413);

  let body: { input?: CoachingInput };
  try {
    body = JSON.parse(text);
  } catch {
    return error("リクエストの形式が正しくありません。", 400);
  }
  const input = body.input;
  const problem = validate(input);
  if (problem) return error(problem, 400);

  const principles = loadPrinciples();
  if (isMockAI()) {
    return Response.json({ draft: mockCoachingDraft(input!, principles.map((p) => p.name)), mock: true });
  }

  // 本物のAIは費用がかかるので、パスコードと1日の上限を確かめる
  const denied = checkPasscode(request) ?? takeQuota("coaching");
  if (denied) return denied;
  try {
    const result = await coachingWithClaude(input!, principles);
    return Response.json({ ...result, mock: false });
  } catch (err) {
    refundQuota("coaching");
    const { message, status } = describeAIError(err);
    console.error("コーチングの作成に失敗:", message);
    return error(message, status);
  }
}

/** 画面から送られたデータの形と大きさを確かめる（問題があれば日本語の理由を返す） */
function validate(input: CoachingInput | undefined): string | null {
  if (!input || typeof input !== "object") return "コーチングのデータがありません。もう一度読み込んでください。";
  if (typeof input.employeeId !== "string" || !input.employeeId) return "社員を選んでください。";
  if (!Array.isArray(input.weeks) || input.weeks.length > 4) return "推移のデータが正しくありません。";
  if (!Array.isArray(input.byAxis) || input.byAxis.length > 20) return "コメントの集計が正しくありません。";
  if (!Array.isArray(input.positives) || input.positives.length > 4) return "引用するコメントが多すぎます。";
  if (!Array.isArray(input.negatives) || input.negatives.length > 6) return "引用するコメントが多すぎます。";
  const texts = [...input.positives, ...input.negatives].map((c) => c?.text);
  if (texts.some((t) => typeof t !== "string" || t.length > MAX_COMMENT_LENGTH)) return "コメントの内容が正しくありません。";
  if (typeof input.memo !== "string" || input.memo.length > MAX_MEMO_LENGTH) {
    return `行動メモは${MAX_MEMO_LENGTH}文字以内にしてください。`;
  }
  if (typeof input.csatTarget !== "number" || !input.totals) return "コーチングのデータが正しくありません。";
  return null;
}

function error(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
