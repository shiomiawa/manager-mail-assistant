"use client";

import { useMemo, useRef, useState } from "react";
import { copyRich, copyText } from "@/lib/clipboard";
import { renderEmailHtml, renderEmailPage, renderEmailText, type EmailDocument } from "@/lib/email/template";

type Props = {
  doc: EmailDocument;
  mock: boolean;
  /** ダミーのときに出す説明（省略時は週次レポート向けの説明） */
  mockNote?: string;
  /** 宛先の表示（例：E002、Team、自分用） */
  to?: string;
};

const DEFAULT_MOCK_NOTE = "コメント部分はダミーです（AIはまだつないでいません）。数字と要点はデータから計算した本物です。";

/** メールのプレビュー（メールソフトで受信メールを開いたような見た目）と、件名・本文のコピー。自動送信はしない */
export function EmailPreview({ doc, mock, mockNote = DEFAULT_MOCK_NOTE, to }: Props) {
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

  const button = "rounded-md px-3.5 py-1.5 text-[13px] font-semibold";
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-bar px-4 py-2.5">
        <button
          type="button"
          onClick={() => run(() => copyRich(renderEmailHtml(doc), renderEmailText(doc)), "本文を見た目ごとコピーしました。メールソフトに貼り付けてください。")}
          className={`${button} bg-brand-700 text-white hover:bg-brand-800`}
        >
          Copy Formatted
        </button>
        <button
          type="button"
          onClick={() => run(() => copyText(renderEmailText(doc)), "本文をテキストでコピーしました。")}
          className={`${button} border border-brand-600 text-brand-700 hover:bg-brand-50`}
        >
          Copy Text
        </button>
        <button
          type="button"
          onClick={() => run(() => copyText(doc.subject), "件名をコピーしました。")}
          className={`${button} border border-brand-600 text-brand-700 hover:bg-brand-50`}
        >
          Copy Subject
        </button>
        <div className="ml-auto flex overflow-hidden rounded-md border border-line text-xs" role="group" aria-label="プレビューの幅">
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
              className={`px-3 py-1 ${width === value ? "bg-brand-700 text-white" : "bg-white hover:bg-bar"}`}
            >
              {value === "pc" ? "PC" : "Mobile"}
            </button>
          ))}
        </div>
        {message && (
          <p role="status" className={`w-full text-xs ${message.error ? "text-red-700" : "text-emerald-700"}`}>
            {message.text}
          </p>
        )}
      </div>

      <div className="border-b border-l-4 border-line border-l-brand-600 bg-white px-5 py-3">
        <p className="text-[17px] font-bold break-all">{doc.subject}</p>
        <p className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-muted">
          {to && <span>To：{to}</span>}
          <span>Draft · 自動送信はしません</span>
        </p>
      </div>

      {mock && <p className="mx-4 mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{mockNote}</p>}

      <div className="flex-1 p-4">
        <iframe
          title="メールのプレビュー"
          srcDoc={page}
          ref={frame}
          sandbox="allow-same-origin"
          onLoad={fitHeight}
          className="mx-auto block h-[600px] w-full rounded bg-white shadow-sm"
          style={{ maxWidth: width === "pc" ? 640 : 375 }}
        />
      </div>
    </div>
  );
}
