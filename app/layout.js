import './globals.css';

export const metadata = {
  title: 'Research Knowledge Classifier',
  description: 'Google Drive論文メタデータ抽出 & Google Sheets統合',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
