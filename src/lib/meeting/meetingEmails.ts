// 会議メモからのメール（Summary／To Employee／My Notes／To Team）を組み立てる
// 見た目は週次レポートと同じテンプレート。ラベルは英語、文章は日本語
// 次回の日程はフォームで選んだ値をコードで入れる（AIには書かせない）
import type { EmailBlock, EmailDocument, EmailSection } from "@/lib/email/template";
import { L, meetingDateLabel, reactionLabel } from "@/lib/labels";
import { formatDate } from "@/lib/report/format";
import type { ActionItem, Discussion, MeetingDraft, MeetingType } from "./types";

export type MeetingTabKey = "summary" | "toEmployee" | "myNotes" | "toTeam";

export type MeetingEmail = {
  key: MeetingTabKey;
  label: string;
  /** 送る相手がいるメールか（My Notes・Summary は自分用） */
  sendable: boolean;
  doc: EmailDocument;
};

export type MeetingContext = {
  type: MeetingType;
  meetingDate: string;
  counterpart: string;
  nextMeetingDate?: string;
  nextMeetingTime?: string;
};

export function buildMeetingEmails(draft: MeetingDraft, context: MeetingContext): MeetingEmail[] {
  const is1on1 = context.type === "1on1";
  const date = formatDate(context.meetingDate);
  const who = is1on1 && context.counterpart ? `　${context.counterpart}` : "";
  const meetingName = is1on1 ? "1on1" : "Team Meeting";
  const kindPrefix = is1on1 ? "1ON1" : "TEAM MEETING";
  const meta = is1on1 && context.counterpart ? `${date} · with ${context.counterpart}` : date;
  // 件名の結論のあとに、次回の日程を付ける（例：・Next 10/12）
  const next = context.nextMeetingDate
    ? `・Next ${Number(context.nextMeetingDate.slice(5, 7))}/${Number(context.nextMeetingDate.slice(8, 10))}`
    : "";
  const nextSection = nextMeetingSection(context);
  const discussion = draft.discussion;
  const emails: MeetingEmail[] = [];

  emails.push({
    key: "summary",
    label: L.summary,
    sendable: false,
    doc: {
      subject: `【${meetingName} ${L.summary}】${date}${who}　${draft.headline}${next}`,
      kind: `${kindPrefix} | ${L.summary.toUpperCase()}`,
      title: `${meetingName} ${L.summary}`,
      meta,
      highlightsLabel: L.keyPoints,
      highlights: draft.summary.keyPoints,
      sections: [
        ...(discussion ? [agendaSection(discussion), wrapUpSection(discussion)] : []),
        { heading: L.topics, blocks: [bullets(draft.summary.topics)] },
        { heading: L.decisions, blocks: [bullets(draft.summary.decisions)] },
        { heading: L.actionItems, blocks: [actionTable(draft.summary.actionItems)] },
        ...nextSection,
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
        subject: `【1on1 Follow-up】${date}${who}　${draft.headline}${next}`,
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
          ...nextSection,
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
      subject: `【${meetingName} Notes】${date}${who}　${draft.headline}${next}`,
      kind: `${kindPrefix} | ${L.myNotes.toUpperCase()}`,
      title: `${meetingName} ${L.myNotes}`,
      meta,
      highlightsLabel: L.keyPoints,
      highlights: draft.myNotes.keyPoints,
      sections: [
        { heading: L.observations, blocks: [bullets(draft.myNotes.observations)] },
        { heading: L.followUps, blocks: [bullets(draft.myNotes.followUps)] },
        { heading: L.handleWithCare, blocks: [bullets(draft.myNotes.sensitive)] },
        ...nextSection,
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
        subject: is1on1
          ? `【Team Update】${date}　${t.keyPoints[0] ?? draft.headline}`
          : `【Team Meeting】${date}　${draft.headline}${next}`,
        kind: `${kindPrefix} | ${L.toTeam.toUpperCase()}`,
        title: is1on1 ? "Team Update" : "Team Meeting",
        meta: date,
        greeting: "チームの皆さん、お疲れさまです。",
        highlightsLabel: L.keyPoints,
        highlights: t.keyPoints,
        sections: [
          ...(discussion
            ? [agendaSection(discussion), opinionsSection(discussion), differentViewsSection(discussion), wrapUpSection(discussion)]
            : []),
          { heading: L.updates, blocks: [bullets(t.updates)] },
          { heading: L.actionItems, blocks: [actionTable(t.actionItems)] },
          // 1on1から作るチーム向けには、1on1の次回日程は載せない
          ...(is1on1 ? [] : nextSection),
        ],
        closing: t.closing,
      },
    });
  }

  return emails;
}

const bullets = (items: string[], label?: string): EmailBlock => ({ type: "bullets", items, label });

function agendaSection(d: Discussion): EmailSection {
  return { heading: L.agenda, blocks: d.agenda ? [{ type: "paragraph", text: d.agenda }] : [] };
}

/** 一人ずつの意見と、それへの反応（例：↳ E004（Will Try）：とてもいいので真似してみます） */
function opinionsSection(d: Discussion): EmailSection {
  return {
    heading: L.opinions,
    blocks: d.opinions.map((o) =>
      bullets(
        [o.opinion, ...o.reactions.map((r) => `↳ ${r.speaker}（${reactionLabel(r.kind)}）：${r.text}`)],
        o.speaker,
      ),
    ),
  };
}

/** 意見が分かれた点：それぞれの考えと理由、話し合った結果 */
function differentViewsSection(d: Discussion): EmailSection {
  return {
    heading: L.differentViews,
    blocks: d.differentViews.map((v) =>
      bullets(
        [
          ...v.views.map((view) => `${view.speaker}：${view.view}${view.reason && view.reason !== view.view ? `（理由：${view.reason}）` : ""}`),
          ...(v.outcome ? [`${L.outcome} → ${v.outcome}`] : []),
        ],
        v.topic,
      ),
    ),
  };
}

function wrapUpSection(d: Discussion): EmailSection {
  return { heading: L.wrapUp, blocks: d.wrapUp ? [{ type: "paragraph", text: d.wrapUp }] : [] };
}

function nextMeetingSection(context: MeetingContext): EmailSection[] {
  if (!context.nextMeetingDate) return [];
  return [
    {
      heading: L.nextMeeting,
      blocks: [{ type: "paragraph", text: meetingDateLabel(context.nextMeetingDate, context.nextMeetingTime) }],
    },
  ];
}

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
