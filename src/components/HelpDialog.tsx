"use client";

import { useEffect, useRef } from "react";

const FEATURES = [
  {
    folder: "weekly",
    name: "Weekly Report",
    text: "週次の成績のExcelから、チーム向けと個人向けの週次メールを作ります。",
    uses: "使うもの：成績のExcel（お客様コメントのシートは任意）",
  },
  {
    folder: "coaching",
    name: "Survey Coaching",
    text: "お客様アンケートの直近4週間の声から、1on1で使うコーチングシートと本人へのフィードバックを作ります。",
    uses: "使うもの：Weekly Report と同じExcel",
  },
  {
    folder: "meeting",
    name: "Meeting Notes",
    text: "1on1やチームミーティングの文字起こしから、要約・本人向け・自分用・チーム向けの下書きを作ります。",
    uses: "使うもの：文字起こし（.vtt / .srt / .txt / .docx）",
  },
  {
    folder: "briefing",
    name: "Briefing Notes",
    text: "説明会の文字起こしから自分用メモを作り、日程と期限をカレンダーに登録できるファイル（.ics）にします。",
    uses: "使うもの：文字起こし",
  },
  {
    folder: "kudos",
    name: "Kudos Mail",
    text: "メンバーの具体的な行動をほめるメールを作ります。チームへの紹介メールも作れます。",
    uses: "使うもの：エピソード（Excelがあれば、お客様のほめ言葉も引用できます）",
  },
] as const;

/** 使い方のページ（ヘッダーの「Help」から開く） */
export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-20 grid place-items-center bg-[rgb(15_20_28/0.45)] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-auto rounded-xl border border-line bg-white shadow-2xl"
      >
        <div className="sticky top-0 flex items-center gap-3 border-b-4 border-brand-600 bg-header px-5 py-3 text-white">
          <h2 id="help-title" className="text-lg font-bold">
            My Mail Butler の使い方
          </h2>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            className="ml-auto rounded border border-white/40 px-3 py-1 text-sm hover:bg-white/10"
          >
            Close
          </button>
        </div>
        <div className="space-y-5 px-6 py-5 text-sm leading-7">
          <HelpSection title="My Mail Butler とは">
            <p>
              データや会議の文字起こしから、いつも同じ型で、読みやすいメールの下書きを作ります。メールは送りません。できた下書きをコピーして、ふだんのメールソフト（Outlook・Gmail など）から送ってください。
            </p>
          </HelpSection>
          <HelpSection title="5つのフォルダ">
            <div className="grid gap-2 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div key={f.folder} data-folder={f.folder} className="overflow-hidden rounded-lg border border-line-soft">
                  <p className="bg-brand-700 px-3 py-1 text-[13px] font-semibold text-white">{f.name}</p>
                  <p className="px-3 pt-2 text-[13px]">{f.text}</p>
                  <p className="px-3 pb-2 text-xs text-muted">{f.uses}</p>
                </div>
              ))}
            </div>
          </HelpSection>
          <HelpSection title="基本の使い方">
            <ol className="list-decimal space-y-0.5 pl-5">
              <li>左のフォルダを選ぶ</li>
              <li>データか文字起こしを読み込む（「サンプル」で試せます）</li>
              <li>宛先や対象を選んで「下書きを作る」</li>
              <li>右のプレビューで内容を確かめる</li>
              <li>「Copy Subject」「Copy Formatted」で、メールソフトに貼り付けて送る</li>
            </ol>
          </HelpSection>
          <HelpSection title="読み込めるファイル">
            <ul className="list-disc space-y-0.5 pl-5">
              <li>
                成績のExcel：日付・社員ID・対応チャンネル・対応件数・平均対応時間・平均満足度・週開始日・Week番号（在籍期間は任意）。お客様の声は「コメント」シート（日付・社員ID・対応チャンネル・評価・評価軸・コメント）に入れます
              </li>
              <li>文字起こし：Teams・Zoom・Google Meet・録音アプリなどの .vtt / .srt / .txt / .docx。貼り付けもできます（5万字まで）</li>
            </ul>
          </HelpSection>
          <HelpSection title="安心して使うために">
            <ul className="list-disc space-y-0.5 pl-5">
              <li>メールは自動で送りません。AIが書いた文章は下書きなので、送る前に必ず読み直してください</li>
              <li>Excelはブラウザの中だけで読み込みます。文字起こしは下書きを作るときにAIへ送りますが、保存はしません</li>
              <li>数字はアプリが計算し、AIには計算させません。AIのコメントは、行動を決めつけない「声かけ案」です</li>
              <li>デモでは架空のデータを使ってください</li>
            </ul>
          </HelpSection>
          <HelpSection title="設定（管理者向け）">
            <ul className="list-disc space-y-0.5 pl-5">
              <li>目標値とスコアの重み：config/targets.json</li>
              <li>行動指針（Principles）：config/principles.json に項目名と短い説明を入れると、コメントやコーチングに反映されます（空欄の項目は使いません）</li>
            </ul>
          </HelpSection>
          <HelpSection title="よくある質問">
            <dl className="space-y-2">
              <div>
                <dt className="font-semibold">メールソフトに貼ると見た目が崩れます</dt>
                <dd className="text-muted">「Copy Text」で文字だけを貼り付けてください。</dd>
              </div>
              <div>
                <dt className="font-semibold">パスコードを聞かれます</dt>
                <dd className="text-muted">AIで下書きを作るにはデモ用パスコードが必要です。管理者に確認し、いちばん下の帯から入力してください。</dd>
              </div>
              <div>
                <dt className="font-semibold">「本日の上限に達しました」と出ます</dt>
                <dd className="text-muted">使いすぎを防ぐため、1日に作れる回数を決めています。日本時間の0時に戻ります。</dd>
              </div>
            </dl>
          </HelpSection>
        </div>
      </section>
    </div>
  );
}

function HelpSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 flex items-center gap-2 text-[15px] font-semibold before:h-4 before:w-1 before:rounded-sm before:bg-brand-600 before:content-['']">
        {title}
      </h3>
      {children}
    </div>
  );
}
