"use client";

import { Step } from "@/components/Workspace";
import { loadSampleWorkbook, loadWorkbookFile, useWorkbook } from "@/lib/workbookStore";

/** Step 1：データを読み込む。読み込んだデータは Weekly Report と Survey Coaching で共有する */
export function WorkbookLoader() {
  const { fileName, comments, loading, errors } = useWorkbook();
  return (
    <Step n={1} label="Data" title="データを読み込む">
      <p className="text-xs leading-5 text-muted">
        成績のExcel（お客様コメントの「コメント」シートは任意）を選んでください。ブラウザの中だけで読み込み、Survey Coaching でも使えます。
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-md bg-brand-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-800">
          Excelを選ぶ
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
          className="rounded-md border border-brand-600 px-4 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
        >
          サンプル
        </button>
        {loading && <span className="text-xs text-muted">読み込み中…</span>}
      </div>
      {fileName && !loading && (
        <p className="text-xs text-muted">
          読み込み済み：{fileName}（コメント {comments.length.toLocaleString("ja-JP")}件）
        </p>
      )}
      {errors && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {errors.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
    </Step>
  );
}
