// メールの見た目を決めるテンプレート（全種類のメールで共通）
// 骨組み：見出しの帯 → 冒頭3行以内の要点 → 区画ごとの本文 → 締めの一言
// OutlookやGmailに貼っても崩れないよう、表レイアウトとインラインCSSだけで作る。
// 画面のプレビューとコピー用で同じ関数を使う。文字はすべてエスケープしてから入れる。

export type Status = "good" | "bad" | "neutral";

export type EmailBlock =
  /** 主要な数字を横に並べる（スマホでは縦に並ぶ）。label を付けると小見出しになる */
  | { type: "kpis"; label?: string; items: { label: string; value: string; notes?: string[]; status?: Status; badge?: string }[] }
  /** 1行ずつの箇条書き。label を付けると小見出しになる */
  | { type: "bullets"; label?: string; items: string[] }
  | { type: "paragraph"; text: string }
  | { type: "table"; headers: string[]; rows: string[][]; align?: ("left" | "right" | "center")[] };

export type EmailSection = { heading: string; blocks: EmailBlock[] };

export type EmailDocument = {
  subject: string;
  /** 帯の上の小さなラベル（例：週次レポート） */
  kind: string;
  /** 帯の大きな見出し */
  title: string;
  /** 帯の下の補足（例：期間） */
  meta: string;
  /** 宛名（例：チームの皆さん）。省略可 */
  greeting?: string;
  /** 冒頭の要点。3行まで（4行目以降は捨てる） */
  highlights: string[];
  /** 要点の枠のラベル（省略時は「要点」） */
  highlightsLabel?: string;
  sections: EmailSection[];
  closing: string;
};

export const MAX_HIGHLIGHTS = 3;

// 落ち着いたブルー基調
export const EMAIL_COLORS = {
  band: "#1f4e79",
  bandText: "#ffffff",
  bandSub: "#c9dcef",
  accent: "#2f6fb0",
  highlightBg: "#eef4fa",
  page: "#f2f5f9",
  card: "#ffffff",
  text: "#1f2933",
  muted: "#5f6b7a",
  border: "#d9e2ec",
  tableHead: "#e6eef7",
  good: "#1e7b4f",
  goodBg: "#e5f4ec",
  bad: "#b4472f",
  badBg: "#fbeae5",
  neutral: "#5f6b7a",
  neutralBg: "#edf0f3",
};

const C = EMAIL_COLORS;
const FONT = "'Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic','Meiryo',Arial,sans-serif";
const WIDTH = 600;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const nl2br = (text: string) => escapeHtml(text).replace(/\r?\n/g, "<br>");

const statusColor = (status: Status = "neutral") =>
  status === "good" ? { fg: C.good, bg: C.goodBg } : status === "bad" ? { fg: C.bad, bg: C.badBg } : { fg: C.neutral, bg: C.neutralBg };

function badge(text: string, status?: Status): string {
  const { fg, bg } = statusColor(status);
  return `<span style="display:inline-block;padding:1px 8px;border-radius:10px;background:${bg};color:${fg};font-size:11px;font-weight:bold;line-height:1.6;">${escapeHtml(text)}</span>`;
}

function renderBlock(block: EmailBlock): string {
  switch (block.type) {
    case "paragraph":
      return `<p style="margin:0 0 12px;font-size:14px;line-height:1.8;color:${C.text};">${nl2br(block.text)}</p>`;

    case "bullets": {
      if (block.items.length === 0) return "";
      const label = block.label
        ? `<p style="margin:0 0 4px;font-size:12px;font-weight:bold;color:${C.muted};">${escapeHtml(block.label)}</p>`
        : "";
      const items = block.items
        .map(
          (item) =>
            `<tr><td valign="top" style="width:16px;padding:2px 0;font-size:14px;line-height:1.7;color:${C.accent};">&#9679;</td>` +
            `<td style="padding:2px 0;font-size:14px;line-height:1.7;color:${C.text};">${escapeHtml(item)}</td></tr>`,
        )
        .join("");
      return `${label}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 12px;">${items}</table>`;
    }

    case "kpis": {
      // 1行に最大3つ。セルは inline-block にして、狭い画面では折り返す
      const cells = block.items
        .map((item) => {
          const { fg } = statusColor(item.status);
          return (
            `<div style="display:inline-block;width:180px;max-width:100%;vertical-align:top;margin:0 4px 8px 0;">` +
            `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border:1px solid ${C.border};border-radius:6px;background:${C.card};">` +
            `<tr><td style="padding:10px 12px;">` +
            `<p style="margin:0;font-size:12px;color:${C.muted};">${escapeHtml(item.label)}${item.badge ? ` ${badge(item.badge, item.status)}` : ""}</p>` +
            `<p style="margin:4px 0 0;font-size:22px;font-weight:bold;color:${item.status === "bad" ? fg : C.text};line-height:1.3;">${escapeHtml(item.value)}</p>` +
            (item.notes ?? [])
              .map((note) => `<p style="margin:2px 0 0;font-size:12px;line-height:1.5;color:${C.muted};">${escapeHtml(note)}</p>`)
              .join("") +
            `</td></tr></table></div>`
          );
        })
        .join("");
      const label = block.label
        ? `<p style="margin:0 0 4px;font-size:12px;font-weight:bold;color:${C.muted};">${escapeHtml(block.label)}</p>`
        : "";
      return `${label}<div style="margin:0 0 8px;font-size:0;">${cells}</div>`;
    }

    case "table": {
      const align = (i: number) => block.align?.[i] ?? (i === 0 ? "left" : "right");
      const head = block.headers
        .map(
          (header, i) =>
            `<th align="${align(i)}" style="padding:6px 8px;background:${C.tableHead};font-size:12px;font-weight:bold;color:${C.text};border-bottom:1px solid ${C.border};white-space:nowrap;">${escapeHtml(header)}</th>`,
        )
        .join("");
      const body = block.rows
        .map(
          (row) =>
            `<tr>${row
              .map(
                (cell, i) =>
                  `<td align="${align(i)}" style="padding:6px 8px;font-size:13px;color:${C.text};border-bottom:1px solid ${C.border};${align(i) === "left" ? "" : "white-space:nowrap;"}">${escapeHtml(cell)}</td>`,
              )
              .join("")}</tr>`,
        )
        .join("");
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 12px;"><tr>${head}</tr>${body}</table>`;
    }
  }
}

function renderSection(section: EmailSection): string {
  const content = section.blocks.map(renderBlock).join("");
  if (!content) return "";
  return (
    `<tr><td style="padding:8px 24px 4px;">` +
    `<p style="margin:0 0 10px;padding:0 0 0 8px;border-left:4px solid ${C.accent};font-size:15px;font-weight:bold;color:${C.band};line-height:1.4;">${escapeHtml(section.heading)}</p>` +
    content +
    `</td></tr>`
  );
}

/** メール本文のHTML（そのまま貼り付けられる断片） */
export function renderEmailHtml(doc: EmailDocument): string {
  const highlights = doc.highlights.slice(0, MAX_HIGHLIGHTS);
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:${C.page};font-family:${FONT};">` +
    `<tr><td align="center" style="padding:16px 8px;">` +
    `<table role="presentation" width="${WIDTH}" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:${WIDTH}px;background:${C.card};">` +
    // 見出しの帯
    `<tr><td style="padding:18px 24px;background:${C.band};">` +
    `<p style="margin:0;font-size:12px;letter-spacing:1px;color:${C.bandSub};">${escapeHtml(doc.kind)}</p>` +
    `<p style="margin:4px 0 0;font-size:20px;font-weight:bold;color:${C.bandText};line-height:1.4;">${escapeHtml(doc.title)}</p>` +
    `<p style="margin:4px 0 0;font-size:12px;color:${C.bandSub};">${escapeHtml(doc.meta)}</p>` +
    `</td></tr>` +
    (doc.greeting
      ? `<tr><td style="padding:18px 24px 0;font-size:14px;line-height:1.8;color:${C.text};">${escapeHtml(doc.greeting)}</td></tr>`
      : "") +
    // 冒頭の要点
    (highlights.length > 0
      ? `<tr><td style="padding:14px 24px 8px;">` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:${C.highlightBg};border-left:4px solid ${C.accent};">` +
        `<tr><td style="padding:10px 14px;">` +
        `<p style="margin:0 0 4px;font-size:12px;font-weight:bold;color:${C.accent};">${escapeHtml(doc.highlightsLabel ?? "要点")}</p>` +
        highlights
          .map((line) => `<p style="margin:0;font-size:14px;line-height:1.8;color:${C.text};">${escapeHtml(line)}</p>`)
          .join("") +
        `</td></tr></table></td></tr>`
      : "") +
    // 区画ごとの本文
    doc.sections.map(renderSection).join("") +
    // 締めの一言
    `<tr><td style="padding:8px 24px 22px;">` +
    `<p style="margin:0;padding:12px 0 0;border-top:1px solid ${C.border};font-size:14px;line-height:1.8;color:${C.text};">${nl2br(doc.closing)}</p>` +
    `</td></tr>` +
    `</table></td></tr></table>`
  );
}

/** プレビュー用の完全なHTML文書（iframe に入れる） */
export function renderEmailPage(doc: EmailDocument): string {
  return (
    `<!doctype html><html lang="ja"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${escapeHtml(doc.subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:${C.page};">${renderEmailHtml(doc)}</body></html>`
  );
}

/** HTMLを貼れないメールソフト向けのテキスト版 */
export function renderEmailText(doc: EmailDocument): string {
  const lines: string[] = [];
  lines.push(`■ ${doc.title}`, doc.meta, "");
  if (doc.greeting) lines.push(doc.greeting, "");
  const highlights = doc.highlights.slice(0, MAX_HIGHLIGHTS);
  if (highlights.length > 0) {
    lines.push(`【${doc.highlightsLabel ?? "要点"}】`, ...highlights, "");
  }
  for (const section of doc.sections) {
    const body: string[] = [];
    for (const block of section.blocks) {
      switch (block.type) {
        case "paragraph":
          body.push(block.text);
          break;
        case "bullets":
          if (block.items.length === 0) break;
          if (block.label) body.push(`［${block.label}］`);
          body.push(...block.items.map((item) => `・${item}`));
          break;
        case "kpis":
          if (block.label) body.push(`［${block.label}］`);
          body.push(
            ...block.items.map(
              (item) =>
                `・${item.label}：${item.value}${item.badge ? `（${item.badge}）` : ""}${item.notes?.length ? `　${item.notes.join("・")}` : ""}`,
            ),
          );
          break;
        case "table":
          body.push(block.headers.join(" | "), ...block.rows.map((row) => row.join(" | ")));
          break;
      }
    }
    if (body.length === 0) continue;
    lines.push(`【${section.heading}】`, ...body, "");
  }
  lines.push(doc.closing);
  return lines.join("\n");
}
