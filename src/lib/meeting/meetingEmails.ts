// 会議メモからのメール（Summary／To Employee／My Notes／To Team）を組み立てる
// 見た目は週次レポートと同じテンプレート。ラベルは英語、文章は日本語
import type { EmailBlock, EmailDocument } from "@/lib/email/template";
import { L } from "@/lib/labels";
import { formatDate } from "@/lib/report/format";
import type { ActionItem, MeetingDraft, MeetingType } from "./types";

export type MeetingTabKey = "summary" | "toEmployee" | "myNotes" | "toTeam";

export type MeetingEmail = {
  key: MeetingTabKey;
  label: string;
  /** 送る相手がいるメールか（My Notes・Summary は自分用） */
  sendable: boolean;
  doc: EmailDocument;
};

type Context = { type: MeetingType; meetingDate: string; counterpart: string };

export function buildMeetingEmails(draft: MeetingDraft, context: Context): MeetingEmail[] {
  const is1on1 = context.type === "1on1";
  const date = formatDate(context.meetingDate);
  const who = is1on1 && context.counterpart ? `　${context.counterpart}` : "";
  const meetingName = is1on1 ? "1on1" : "Team Meeting";
  const kindPrefix = is1on1 ? "1ON1" : "TEAM MEETING";
  const meta = is1on1 && context.counterpart ? `${date} · with ${context.counterpart}` : date;
  const emails: MeetingEmail[] = [];

  emails.push({
    key: "summary",
    label: L.summary,
    sendable: false,
    doc: {
      subject: `【${meetingName} ${L.summary}】${date}${who}　${draft.headline}`,
      kind: `${kindPrefix} | ${L.summary.toUpperCase()}`,
      title: `${meetingName} ${L.summary}`,
      meta,
      highlightsLabel: L.keyPoints,
      highlights: draft.summary.keyPoints,
      sections: [
        { heading: L.topics, blocks: [bullets(draft.summary.topics)] },
        { heading: L.decisions, blocks: [bullets(draft.summary.decisions)] },
        { heading: L.actionItems, blocks: [actionTable(draft.summary.actionItems)] },
      ],
      closing: "以上です。",
    },
  });

  if (is1on1 && draft.toEmployee) {
    const e = draft.toEmployee;
    emails.push({
      key: "toEmployee",
      label: L.toEmployee,
      sendable: true,
      doc: {
        subject: `【1on1 Follow-up】${date}${who}　${draft.headline}`,
        kind: `${kindPrefix} | FOLLOW-UP`,
        title: "1on1 Follow-up",
        meta,
        greeting: `${context.counterpart || "メンバー"}さん、今日は1on1の時間をありがとうございました。`,
        highlightsLabel: L.keyPoints,
        highlights: e.keyPoints,
        sections: [
          { heading: L.thankYou, blocks: [bullets(e.thanks)] },
          { heading: L.agreed, blocks: [bullets(e.agreed)] },
          { heading: L.mySupport, blocks: [bullets(e.support)] },
        ],
        closing: e.closing,
      },
    });
  }

  emails.push({
    key: "myNotes",
    label: L.myNotes,
    sendable: false,
    doc: {
      subject: `【${meetingName} Notes】${date}${who}　${draft.headline}`,
      kind: `${kindPrefix} | ${L.myNotes.toUpperCase()}`,
      title: `${meetingName} ${L.myNotes}`,
      meta,
      highlightsLabel: L.keyPoints,
      highlights: draft.myNotes.keyPoints,
      sections: [
        { heading: L.observations, blocks: [bullets(draft.myNotes.observations)] },
        { heading: L.followUps, blocks: [bullets(draft.myNotes.followUps)] },
        { heading: L.handleWithCare, blocks: [bullets(draft.myNotes.sensitive)] },
      ],
      closing: "（自分用の控えです。本人やチームには送りません）",
    },
  });

  if (draft.toTeam) {
    const t = draft.toTeam;
    emails.push({
      key: "toTeam",
      label: L.toTeam,
      sendable: true,
      doc: {
        subject: `【${is1on1 ? "Team Update" : "Team Meeting"}】${date}　${is1on1 ? t.keyPoints[0] ?? draft.headline : draft.headline}`,
        kind: `${kindPrefix} | ${L.toTeam.toUpperCase()}`,
        title: is1on1 ? "Team Update" : "Team Meeting",
        meta: date,
        greeting: "チームの皆さん、お疲れさまです。",
        highlightsLabel: L.keyPoints,
        highlights: t.keyPoints,
        sections: [
          { heading: L.updates, blocks: [bullets(t.updates)] },
          { heading: L.actionItems, blocks: [actionTable(t.actionItems)] },
        ],
        closing: t.closing,
      },
    });
  }

  return emails;
}

const bullets = (items: string[]): EmailBlock => ({ type: "bullets", items });

/** 担当・内容・期限の表。取り組みがなければ何も出さない（区画ごと消える） */
function actionTable(items: ActionItem[]): EmailBlock {
  if (items.length === 0) return { type: "bullets", items: [] };
  return {
    type: "table",
    headers: [L.owner, L.task, L.due],
    align: ["left", "left", "left"],
    rows: items.map((a) => [a.owner, a.task, a.due || "—"]),
  };
}
