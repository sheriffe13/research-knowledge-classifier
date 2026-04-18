'use client';

import { useState } from 'react';

export default function Home() {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [folderUrl, setFolderUrl] = useState('https://drive.google.com/drive/folders/1lGygq45cqR1BNrRtNrzwsaaEMkpYqzOT');
  const [sheetName, setSheetName] = useState('Journals');

  const handleStartAuth = async () => {
    try {
      setLoading(true);
      setStatus('🔐 Google 認証を初期化中...');
      alert('Google OAuth will be integrated in the next phase');
      setStatus('✅ Authentication phase will be implemented');
    } catch (error) {
      setStatus(`❌ エラー: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleScanAndClassify = async () => {
    try {
      setLoading(true);
      setStatus('📂 Google Drive をスキャン中...');
      alert('Google Drive integration will be added in the next phase');
      setStatus('✅ Scan & classify will be integrated');
    } catch (error) {
      setStatus(`❌ エラー: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>🧬 Research Knowledge Classifier</h1>
      <p className="subtitle">Google Drive 論文メタデータ抽出 & Google Sheets 統合</p>

      <div className="section">
        <div className="section-title">🔑 ステップ 1: Google 認証</div>
        <p style={{ marginBottom: '16px', color: '#666', fontSize: '14px' }}>
          Google アカウントで認証してください。
        </p>
        <button
          className="btn-primary"
          onClick={handleStartAuth}
          disabled={loading}
        >
          {loading ? '処理中...' : 'Google で認証'}
        </button>
      </div>

      <div className="section">
        <div className="section-title">⚙️ ステップ 2: 設定</div>

        <div style={{ marginBottom: '20px' }}>
          <label>Google Drive フォルダ URL</label>
          <input
            type="text"
            value={folderUrl}
            onChange={(e) => setFolderUrl(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label>Google Sheet 名</label>
          <input
            type="text"
            value={sheetName}
            onChange={(e) => setSheetName(e.target.value)}
            placeholder="Journals"
          />
        </div>
      </div>

      <div className="section">
        <div className="section-title">🚀 ステップ 3: スキャン & 分類</div>
        <p style={{ marginBottom: '16px', color: '#666', fontSize: '14px' }}>
          Google Drive をスキャンして、論文メタデータを抽出・分類します。
        </p>
        <button
          className="btn-primary"
          onClick={handleScanAndClassify}
          disabled={loading}
        >
          {loading ? '処理中...' : 'スキャン & 分類を実行'}
        </button>

        {status && (
          <div className={`status ${
            loading ? 'loading' :
            status.includes('✅') ? 'success' :
            status.includes('❌') ? 'error' : 'loading'
          }`}>
            {status}
          </div>
        )}
      </div>

      <div className="section" style={{ borderBottom: 'none' }}>
        <div className="section-title">ℹ️ 使い方</div>
        <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.8' }}>
          1. <strong>「Google で認証」</strong> をクリック<br/>
          2. Google Drive フォルダ URL と Google Sheet 名を確認<br/>
          3. <strong>「スキャン & 分類を実行」</strong> をクリック<br/>
          4. 論文メタデータが自動抽出・統合されます
        </p>
      </div>
    </div>
  );
}
