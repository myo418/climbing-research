import type { Metadata } from 'next';
import { Sidebar } from '@/components/Sidebar';
import './globals.css';

export const metadata: Metadata = {
  title: 'リサーチサイト（内部）',
  description: 'クライミングと怪我のリサーチ',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <div className="app">
          <aside className="sidebar">
            <Sidebar />
          </aside>
          <main className="main">
            <article className="prose">{children}</article>
          </main>
        </div>
      </body>
    </html>
  );
}
