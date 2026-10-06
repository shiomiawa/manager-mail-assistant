"use client";

import { useMemo, useRef, useState } from "react";
import { copyRich, copyText } from "@/lib/clipboard";
import { renderEmailHtml, renderEmailPage, renderEmailText, type EmailDocument } from "@/lib/email/template";

type Props = {
  doc: EmailDocument;
  mock: boolean;
  /** ダミーのときに出す説明（省略時は週次レポート向けの説明） */
  mockNote?: string;
};

const DEFAULT_MOCK_NOTE = "コメント部分はダミーです（AIはまだつないでいません）。数字と要点はデータから計算した本物です。";

/** メールのプレビューと、件名・本文のコピー。自動送信はしない */
export function EmailPreview({ doc, mock, mockNote = DEFAULT_MOCK_NOTE }: Props) {
  const page = useMemo(() => renderEmailPage(doc), [doc]);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [width, setWidth] = useState<"pc" | "phone">("pc");
  const frame = useRef<HTMLIFrameElement>(null);

  // プレビューの高さをメールの長さに合わせる（中のスクリプトは動かさない設定のまま）
  function fitHeight() {
    const body = frame.current?.contentDocument?.body;
    if (frame.current && body) frame.current.style.height = `${body.scrollHeight + 16}px`;
  }

  async function run(action: () => Promise<void>, done: string) {
    try {
      await action();
      setMessage({ text: done });
    } catch {
      setMessage({ text: "コピーできませんでした。ブラウザのクリップボードの許可を確認してください。", error: true });
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="space-y-3 border-b border-slate-200 p-4">
        {mock && (
          <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {mockNote}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500">件名</span>
          <p className="min-w-0 flex-1 break-all rounded bg-slate-50 px-2 py-1 text-sm">{doc.subject}</p>
          <button
            type="button"
            onClick={() => run(() => copyText(doc.subject), "件名をコピーしました。")}
            className="rounded border border-brand-600 px-3 py-1 text-sm text-brand-700 hover:bg-brand-50"
          >
            件名をコピー
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              run(() => copyRich(renderEmailHtml(doc), renderEmailText(doc)), "本文を見た目ごとコピーしました。メールソフトに貼り付けてください。")
            }
            className="rounded bg-brand-700 px-4 py-2 text-sm font-bold text-white hover:bg-brand-800"
          >
            本文を見た目ごとコピー
          </button>
          <button
            type="button"
            onClick={() => run(() => copyText(renderEmailText(doc)), "本文をテキストでコピーしました。")}
            className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            テキストでコピー
          </button>
          <div className="ml-auto flex overflow-hidden rounded border border-slate-300 text-xs" role="group" aria-label="プレビューの幅">
            {(["pc", "phone"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={width === value}
                onClick={() => {
                  setWidth(value);
                  // 幅が変わると高さも変わるので、描き直したあとに合わせる
                  requestAnimationFrame(() => requestAnimationFrame(fitHeight));
                }}
                className={`px-3 py-1 ${width === value ? "bg-brand-700 text-white" : "bg-white hover:bg-slate-50"}`}
              >
                {value === "pc" ? "パソコン" : "スマホ"}
              </button>
            ))}
          </div>
        </div>
        {message && (
          <p role="status" className={`text-sm ${message.error ? "text-red-700" : "text-emerald-700"}`}>
            {message.text}
          </p>
        )}
      </div>
      <div className="bg-slate-100 p-2">
        <iframe
          title="メールのプレビュー"
          srcDoc={page}
          ref={frame}
          sandbox="allow-same-origin"
          onLoad={fitHeight}
          className="mx-auto block h-[600px] w-full bg-white"
          style={{ maxWidth: width === "pc" ? 680 : 375 }}
        />
      </div>
    </section>
  );
}
