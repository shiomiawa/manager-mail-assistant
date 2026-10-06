// アンケートのコーチング：Coaching Sheet（自分用）と To Employee（本人向け）のメールを組み立てる
import { EMAIL_ACCENTS, type EmailBlock, type EmailDocument } from "@/lib/email/template";
import { L, axisLabel } from "@/lib/labels";
import { formatShortDate } from "@/lib/report/format";
import type { CoachingDraft, CoachingInput } from "./types";

export type CoachingEmail = { key: "sheet" | "toEmployee"; label: string; sendable: boolean; doc: EmailDocument };

export function buildCoachingEmails(draft: CoachingDraft, input: CoachingInput, weekStart: string): CoachingEmail[] {
  const date = formatShortDate(weekStart);
  const voiceTable: EmailBlock = {
    type: "table",
    headers: [L.axis, L.positive, L.neutral, L.negative],
    rows: input.byAxis.map((a) => [axisLabel(a.axis), String(a.positive), String(a.neutral), String(a.negative)]),
  };
  const quotes = (label: string, list: CoachingInput["positives"]): EmailBlock => ({
    type: "bullets",
    label,
    items: list.map((c) => `「${c.text}」（${axisLabel(c.axis)}）`),
  });
  const strengths: EmailBlock = {
    type: "bullets",
    items: draft.strengths.map((s) => `［${axisLabel(s.axis)}］${s.point}`),
  };
  const focusBlocks = (forEmployee: boolean): EmailBlock[] =>
    draft.focusAreas.map((f) => ({
      type: "bullets",
      label: `${axisLabel(f.axis)}${f.principle ? `（${f.principle}）` : ""}`,
      items: [
        `${L.customerVoice}：${f.voice}`,
        ...(forEmployee ? [] : [`${L.hypothesis}：${f.hypothesis}`]),
        `${L.tryThis}：${f.tryThis}`,
        ...(f.examplePhrase ? [`${L.examplePhrase}：${f.examplePhrase}`] : []),
      ],
    }));

  const sheet: EmailDocument = {
    subject: `【Coaching】${date} ${input.employeeId}`,
    accent: EMAIL_ACCENTS.coaching,
    kind: `SURVEY COACHING | ${L.myNotes.toUpperCase()}`,
    title: `${input.employeeId} ${L.coachingSheet}`,
    meta: input.weekLabel,
    highlightsLabel: L.keyPoints,
    highlights: [draft.summary],
    sections: [
      {
        heading: `${L.customerVoice} (4 weeks)`,
        blocks: input.totals.total > 0 ? [voiceTable, quotes(L.kudos, input.positives), quotes(L.toImprove, input.negatives)] : [],
      },
      { heading: L.strengths, blocks: [strengths] },
      { heading: L.focusAreas, blocks: focusBlocks(false) },
      { heading: L.coachingQuestions, blocks: [{ type: "bullets", items: draft.questions }] },
      { heading: L.nextCheck, blocks: draft.nextCheck ? [{ type: "paragraph", text: draft.nextCheck }] : [] },
    ],
    closing: "（自分用のコーチングシートです。1on1 の前に見直しましょう）",
  };

  const toEmployee: EmailDocument = {
    subject: `【Coaching】${date} ${input.employeeId}`,
    accent: EMAIL_ACCENTS.coaching,
    kind: "SURVEY COACHING | FEEDBACK",
    title: `${input.employeeId} ${L.customerVoice}`,
    meta: input.weekLabel,
    greeting: `${input.employeeId}さん、${draft.messageToEmployee.opening}`,
    highlightsLabel: L.keyPoints,
    highlights: [draft.summary],
    sections: [
      { heading: L.whatCustomersAppreciate, blocks: [strengths, quotes(L.kudos, input.positives)] },
      { heading: L.letsTry, blocks: focusBlocks(true) },
    ],
    closing: draft.messageToEmployee.closing,
  };

  return [
    { key: "sheet", label: L.coachingSheet, sendable: false, doc: sheet },
    { key: "toEmployee", label: L.toEmployee, sendable: true, doc: toEmployee },
  ];
}
