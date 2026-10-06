// 説明会の自分用メモ（メール）を組み立てる。見た目は他のメールと同じテンプレート
// 日程の欄は、画面で確かめた（直した）日付を使う
import { EMAIL_ACCENTS, type EmailDocument } from "@/lib/email/template";
import { L, meetingDateLabel } from "@/lib/labels";
import { formatDate, formatShortDate } from "@/lib/report/format";
import type { BriefingDraft } from "./types";

/** 画面で確かめた日程（日付が分からないものは date が空） */
export type ConfirmedDate = { title: string; whenText: string; date: string; time: string };

export function buildBriefingEmail(
  draft: BriefingDraft,
  context: { title: string; briefingDate: string },
  dates: ConfirmedDate[],
): EmailDocument {
  const date = formatDate(context.briefingDate);
  return {
    subject: `【Briefing】${formatShortDate(context.briefingDate)}${shortTitle(context.title)}`,
    accent: EMAIL_ACCENTS.briefing,
    kind: `BRIEFING | ${L.myNotes.toUpperCase()}`,
    title: context.title || L.briefingNotes,
    meta: date,
    highlightsLabel: L.keyPoints,
    highlights: draft.keyPoints,
    sections: [
      { heading: L.overview, blocks: draft.overview ? [{ type: "paragraph", text: draft.overview }] : [] },
      { heading: L.keyTakeaways, blocks: [{ type: "bullets", items: draft.takeaways }] },
      {
        heading: L.toDo,
        blocks:
          draft.todos.length > 0
            ? [
                {
                  type: "table",
                  headers: [L.task, L.due],
                  align: ["left", "left"],
                  rows: draft.todos.map((t) => [t.task, t.due || "—"]),
                },
              ]
            : [],
      },
      {
        heading: L.datesAndDeadlines,
        blocks:
          dates.length > 0
            ? [
                {
                  type: "table",
                  headers: [L.date, L.item],
                  align: ["left", "left"],
                  rows: dates.map((d) => [d.date ? meetingDateLabel(d.date, d.time) : d.whenText || "—", d.title]),
                },
              ]
            : [],
      },
      { heading: L.openQuestions, blocks: [{ type: "bullets", items: draft.openQuestions }] },
    ],
    closing: "（自分用のメモです。日程はカレンダーにも登録しておきましょう）",
  };
}

/** 件名に添える説明会の名前（長ければ20字で切る） */
function shortTitle(title: string): string {
  const t = title.trim();
  if (!t) return "";
  return ` ${t.length > 20 ? `${t.slice(0, 19)}…` : t}`;
}
