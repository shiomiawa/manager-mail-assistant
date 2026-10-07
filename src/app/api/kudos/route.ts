// 称賛メール（AIが書く区画）を返す
// USE_MOCK_AI が "false" のときだけ Claude を使う。それ以外はダミー（費用はかからない）
import { describeAIError, isMockAI } from "@/lib/claude";
import { aiKudosReady } from "@/lib/kudos/guard";
import { kudosWithClaude } from "@/lib/kudos/aiKudos";
import { mockKudosDraft } from "@/lib/kudos/mockKudos";
import type { KudosInput } from "@/lib/kudos/types";
import { loadPrinciples } from "@/lib/principles";
import { checkPasscode, refundQuota, takeQuota } from "@/lib/usageGuard";

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > 30_000) return error("送信するデータが大きすぎます。", 413);
  let body: { input?: KudosInput };
  try {
    body = JSON.parse(text);
  } catch {
    return error("リクエストの形式が正しくありません。", 400);
  }
  const problem = aiKudosReady(body.input);
  if (problem) return error(problem, 400);
  const input = body.input!;

  const principles = loadPrinciples();
  if (isMockAI()) return Response.json({ draft: mockKudosDraft(input, principles.map((p) => p.name)), mock: true });

  // 本物のAIは費用がかかるので、パスコードと1日の上限を確かめる
  const denied = checkPasscode(request) ?? takeQuota("kudos");
  if (denied) return denied;
  try {
    const result = await kudosWithClaude(input, principles);
    return Response.json({ ...result, mock: false });
  } catch (err) {
    refundQuota("kudos");
    const { message, status } = describeAIError(err);
    console.error("称賛メールの作成に失敗:", message);
    return error(message, status);
  }
}

function error(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
