// 会議の文字起こしから、下書き（AIが書く区画）を返す
// USE_MOCK_AI が "false" のときだけ Claude を使う。それ以外はダミー（費用はかからない）
// 文字起こしは保存しない
import { describeAIError, isMockAI } from "@/lib/claude";
import { meetingDraftWithClaude } from "@/lib/meeting/aiDraft";
import { mockMeetingDraft } from "@/lib/meeting/mockDraft";
import { checkPasscode, refundQuota, takeQuota } from "@/lib/usageGuard";
import { MAX_TRANSCRIPT_LENGTH } from "@/lib/meeting/transcript";
import type { MeetingRequest } from "@/lib/meeting/types";

const MAX_BODY_LENGTH = MAX_TRANSCRIPT_LENGTH * 4; // JSON にすると文字が増えるぶんの余裕
const MAX_COUNTERPART_LENGTH = 40;
const MAX_AGENDA_LENGTH = 200;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY_LENGTH) return error("送信するデータが大きすぎます。", 413);

  let body: Partial<MeetingRequest>;
  try {
    body = JSON.parse(text);
  } catch {
    return error("リクエストの形式が正しくありません。", 400);
  }

  if (body.type !== "1on1" && body.type !== "team") return error("会議の種類を選んでください。", 400);
  if (typeof body.transcript !== "string" || body.transcript.trim() === "") {
    return error("文字起こしを入れてください。", 400);
  }
  if (body.transcript.length > MAX_TRANSCRIPT_LENGTH) {
    return error(`文字起こしは${MAX_TRANSCRIPT_LENGTH.toLocaleString()}字までにしてください。`, 400);
  }
  if (typeof body.meetingDate !== "string" || !DATE.test(body.meetingDate)) {
    return error("会議の日付を入れてください。", 400);
  }
  const agenda = typeof body.agenda === "string" ? body.agenda.trim() : "";
  if (agenda.length > MAX_AGENDA_LENGTH) return error(`アジェンダは${MAX_AGENDA_LENGTH}字までにしてください。`, 400);
  const nextMeetingDate = typeof body.nextMeetingDate === "string" ? body.nextMeetingDate : "";
  const nextMeetingTime = typeof body.nextMeetingTime === "string" ? body.nextMeetingTime : "";
  if (nextMeetingDate && !DATE.test(nextMeetingDate)) return error("次回の日付が正しくありません。", 400);
  if (nextMeetingTime && (!TIME.test(nextMeetingTime) || !nextMeetingDate)) {
    return error("次回の時刻が正しくありません（日付も選んでください）。", 400);
  }
  const counterpart = typeof body.counterpart === "string" ? body.counterpart.trim() : "";
  if (counterpart.length > MAX_COUNTERPART_LENGTH) return error("相手の名前が長すぎます。", 400);

  const meeting = {
    type: body.type,
    transcript: body.transcript,
    meetingDate: body.meetingDate,
    counterpart,
    agenda,
    nextMeetingDate,
    nextMeetingTime,
  };
  if (isMockAI()) return Response.json({ draft: mockMeetingDraft(meeting), mock: true });

  // 本物のAIは費用がかかるので、パスコードと1日の上限を確かめる
  const denied = checkPasscode(request) ?? takeQuota("meetingDrafts");
  if (denied) return denied;
  try {
    const result = await meetingDraftWithClaude(meeting);
    return Response.json({ ...result, mock: false });
  } catch (err) {
    refundQuota("meetingDrafts");
    const { message, status } = describeAIError(err);
    console.error("会議の下書きの作成に失敗:", message);
    return error(message, status);
  }
}

function error(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
