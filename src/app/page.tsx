import { AppTabs } from "@/components/AppTabs";
import { ServerStatus } from "@/components/ServerStatus";

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
        <ServerStatus />
        <AppTabs />
      </main>
    </>
  );
}
