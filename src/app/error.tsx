"use client"; // エラー表示の境界は Client Component にする必要がある

import { useEffect } from "react";

// 画面の表示中に予期しないエラーが起きたときに出すページ（真っ白にならないように。hotel-review-ai と同じ仕組み）
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-16">
      <h1 className="text-xl font-bold text-brand-800">画面の表示中にエラーが起きました</h1>
      <p className="text-sm text-slate-600">
        もう一度表示し直してください。直らない場合は、ページを再読み込みしてください。
        読み込んだExcelや文字起こしは、読み込み直しが必要です。
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded bg-brand-700 px-4 py-2 text-sm font-bold text-white hover:bg-brand-800"
        >
          もう一度表示する
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded border border-slate-300 px-4 py-2 text-sm"
        >
          ページを再読み込みする
        </button>
      </div>
    </main>
  );
}
