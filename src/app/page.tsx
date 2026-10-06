import { WeeklyReportPanel } from "@/components/WeeklyReportPanel";

export default function Home() {
  return (
    <>
      <header className="bg-brand-800 text-white">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <h1 className="text-lg font-bold">CSマネージャー メール下書き</h1>
          <p className="text-xs text-brand-100">同じ型で、読みやすく、くどくないメールを。送信は行いません（コピーして使います）。</p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <nav className="mb-4 flex gap-1 border-b border-slate-300 text-sm" aria-label="機能">
          <span className="rounded-t border border-b-0 border-slate-300 bg-white px-4 py-2 font-bold text-brand-800">
            週次パフォーマンスレポート
          </span>
          <span className="px-4 py-2 text-slate-400" title="次に作ります">
            会議メモから作成（準備中）
          </span>
        </nav>
        <WeeklyReportPanel />
      </main>
    </>
  );
}
