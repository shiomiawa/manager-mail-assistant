"use client";

import { loadSampleWorkbook, loadWorkbookFile, useWorkbook } from "@/lib/workbookStore";

/** 「1. データを読み込む」の区画。読み込んだデータは Weekly Performance Report と Survey Coaching で共有する */
export function WorkbookLoader() {
  const { fileName, comments, loading, errors } = useWorkbook();
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-base font-bold text-brand-800">1. データを読み込む</h2>
      <p className="mt-1 text-sm text-slate-600">
        日付・社員ID・対応チャンネル・対応件数・平均対応時間・平均満足度・週開始日・Week番号（・在籍期間）の列があるExcelを選んでください。「コメント」シート（お客様のコメント）があれば、Kudosと改善点もメールに入れます。ファイルはこのブラウザの中だけで読み込み、ほかのタブでも使えます。
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded bg-brand-700 px-4 py-2 text-sm font-bold text-white hover:bg-brand-800">
          Excelファイルを選ぶ
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void loadWorkbookFile(file);
              event.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => void loadSampleWorkbook()}
          className="rounded border border-brand-600 px-4 py-2 text-sm text-brand-700 hover:bg-brand-50"
        >
          サンプルデータを使う
        </button>
        {loading && <span className="text-sm text-slate-500">読み込み中…</span>}
        {fileName && !loading && (
          <span className="text-sm text-slate-600">
            読み込み済み：{fileName}（お客様コメント {comments.length.toLocaleString("ja-JP")}件）
          </span>
        )}
      </div>
      {errors && (
        <div role="alert" className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errors.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
    </section>
  );
}
