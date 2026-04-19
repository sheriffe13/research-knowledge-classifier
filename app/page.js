'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [folderUrl, setFolderUrl] = useState('https://drive.google.com/drive/folders/1lGygq45cqR1BNrRtNrzwsaaEMkpYqzOT');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [spreadsheetName, setSpreadsheetName] = useState('Research Papers');
  const [sheetName, setSheetName] = useState('Journals');
  const [accessToken, setAccessToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sheetsUrl, setSheetsUrl] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('access_token');
    const error = params.get('error');

    if (token) {
      setAccessToken(token);
      setIsAuthenticated(true);
      setStatus('✅ Google で認証されました');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error) {
      setStatus(`❌ 認証エラー: ${error}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleStartAuth = async () => {
    try {
      setLoading(true);
      setStatus('🔐 Google 認証を初期化中...');
      
      const response = await fetch('/api/auth/start', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setStatus('❌ 認証 URL を取得できませんでした');
      }
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
      setSheetsUrl('');
      
      const response = await fetch('/api/drive/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderUrl,
          spreadsheetId: spreadsheetId || null,
          spreadsheetName,
          sheetName,
          accessToken: accessToken || null
        })
      });

      // ステータスコードを確認
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        setStatus(`❌ エラー: API エラー (${response.status})`);
        return;
      }

      // JSON をパース
      const data = await response.json();
      
      if (data.error) {
        setStatus(`❌ エラー: ${data.error}`);
      } else {
        setStatus(`✅ ${data.message}`);
        setResults(data.papers || []);
        
        if (data.spreadsheetId) {
          setSpreadsheetId(data.spreadsheetId);
          const url = `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`;
          setSheetsUrl(url);
        }
      }
    } catch (error) {
      console.error('Fetch error:', error);
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
          {isAuthenticated ? '✅ 認証済み' : 'Google アカウントで認証してください。'}
        </p>
        <button 
          className="btn-primary" 
          onClick={handleStartAuth}
          disabled={loading || isAuthenticated}
        >
          {isAuthenticated ? '✅ 認証済み' : loading ? '処理中...' : 'Google で認証'}
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
          <label>Google Sheet 保存先 ID（オプション）</label>
          <input 
            type="text" 
            value={spreadsheetId}
            onChange={(e) => setSpreadsheetId(e.target.value)}
            placeholder="1a2b3c4d5e6f7g8h9i0j..."
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label>Google Sheet 名（新規作成の場合）</label>
          <input 
            type="text" 
            value={spreadsheetName}
            onChange={(e) => setSpreadsheetName(e.target.value)}
            placeholder="Research Papers"
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label>Sheet シート名</label>
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
          Google Drive をスキャンして、論文メタデータを抽出・Google Sheets に保存します。
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
            <p>{status}</p>
          </div>
        )}

        {sheetsUrl && (
          <div style={{
            marginTop: '16px',
            padding: '16px',
            background: '#f0f9ff',
            border: '2px solid #667eea',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <p style={{ color: '#2d3748', marginBottom: '12px', fontWeight: '600' }}>
              📊 Google Sheets に保存されました！
            </p>
            <a 
              href={sheetsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                background: '#667eea',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '6px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              🔗 Google Sheets を開く
            </a>
            <p style={{ fontSize: '12px', color: '#718096', marginTop: '12px' }}>
              {sheetsUrl}
            </p>
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="section">
          <div className="section-title">📊 結果 ({results.length} 件)</div>
          <div className="results">
            {results.map((paper, idx) => (
              <div key={idx} className="paper-card">
                <div className="paper-title">{paper.title || 'Unknown Title'}</div>
                
                <div className="paper-meta">
                  <div className="meta-item">
                    <span className="meta-label">年:</span>
                    <span>{paper.year || 'Unknown'}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">著者:</span>
                    <span>{paper.authors ? (Array.isArray(paper.authors) ? paper.authors.join('; ') : paper.authors) : 'Unknown'}</span>
                  </div>
                </div>

                {paper.keywords && paper.keywords.length > 0 && (
                  <div className="tags">
                    {paper.keywords.map((keyword, i) => (
                      <span key={i} className="tag">{keyword}</span>
                    ))}
                  </div>
                )}

                {paper.primaryCategory && (
                  <div style={{ marginTop: '12px', fontSize: '14px' }}>
                    <span style={{ fontWeight: '600', color: '#34495e' }}>カテゴリー:</span>
                    <span style={{ marginLeft: '8px', color: '#667eea' }}>{paper.primaryCategory}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section" style={{ borderBottom: 'none' }}>
        <div className="section-title">ℹ️ 使い方</div>
        <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.8' }}>
          1. <strong>「Google で認証」</strong> をクリック<br/>
          2. Google Drive フォルダ URL を確認<br/>
          3. <strong>「スキャン & 分類を実行」</strong> をクリック<br/>
          4. 論文メタデータが Google Sheets に自動保存されます
        </p>
      </div>
    </div>
  );
}
