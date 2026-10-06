// 説明会の文字起こしから、自分用メモ（AIが書く区画）を返す
// USE_MOCK_AI が "false" のときだけ Claude を使う。それ以外はダミー（費用はかからない）
// 文字起こしは保存しない
import { briefingWithClaude } from "@/lib/briefing/aiBriefing";
import { mockBriefingDraft } from "@/lib/briefing/mockBriefing";
import type { BriefingRequest } from "@/lib/briefing/types";
import { describeAIError, isMockAI } from "@/lib/claude";
import { MAX_TRANSCRIPT_LENGTH } from "@/lib/meeting/transcript";
import { checkPasscode, refundQuota, takeQuota } from "@/lib/usageGuard";

const MAX_BODY_LENGTH = MAX_TRANSCRIPT_LENGTH * 4; // JSON にすると文字が増えるぶんの余裕
const MAX_TITLE_LENGTH = 100;

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY_LENGTH) return error("送信するデータが大きすぎます。", 413);

  let body: Partial<BriefingRequest>;
  try {
    body = JSON.parse(text);
  } catch {
    return error("リクエストの形式が正しくありません。", 400);
  }
  if (typeof body.transcript !== "string" || body.transcript.trim() === "") {
    return error("文字起こしを入れてください。", 400);
  }
  if (body.transcript.length > MAX_TRANSCRIPT_LENGTH) {
    return error(`文字起こしは${MAX_TRANSCRIPT_LENGTH.toLocaleString()}字までにしてください。`, 400);
  }
  if (typeof body.briefingDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.briefingDate)) {
    return error("説明会の日付を入れてください。", 400);
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length > MAX_TITLE_LENGTH) return error(`説明会の名前は${MAX_TITLE_LENGTH}字までにしてください。`, 400);

  const briefing = { title, briefingDate: body.briefingDate, transcript: body.transcript };
  if (isMockAI()) return Response.json({ draft: mockBriefingDraft(briefing), mock: true });

  // 本物のAIは費用がかかるので、パスコードと1日の上限を確かめる
  const denied = checkPasscode(request) ?? takeQuota("briefingNotes");
  if (denied) return denied;
  try {
    const result = await briefingWithClaude(briefing);
    return Response.json({ ...result, mock: false });
  } catch (err) {
    refundQuota("briefingNotes");
    const { message, status } = describeAIError(err);
    console.error("説明会のメモの作成に失敗:", message);
    return error(message, status);
  }
}

function error(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
