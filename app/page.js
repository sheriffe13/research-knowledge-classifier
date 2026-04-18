'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [folderUrl, setFolderUrl] = useState('https://drive.google.com/drive/folders/1lGygq45cqR1BNrRtNrzwsaaEMkpYqzOT');
  const [sheetName, setSheetName] = useState('Journals');
  const [accessToken, setAccessToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
      
      const response = await fetch('/api/drive/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderUrl,
          sheetName,
          accessToken: accessToken || null
        })
      });
      
      const data = await response.json();
      
      if (data.error) {
        setStatus(`❌ エラー: ${data.error}`);
      } else {
        setStatus(`✅ ${data.message}`);
        setResults(data.papers || []);
      }
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
          Google Drive をスキャンして、論文メタデータを抽出・分類・Google Sheets に保存します。
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

                {paper.abstract && (
                  <div style={{ marginTop: '12px', fontSize: '13px', color: '#666' }}>
                    <span style={{ fontWeight: '600' }}>概要:</span>
                    <p style={{ marginTop: '8px', lineHeight: '1.5' }}>{paper.abstract}</p>
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
          1. <strong>「Google で認証」</strong> をクリックして Google アカウントにログイン<br/>
          2. Google Drive フォルダ URL と Google Sheet 名を確認<br/>
          3. <strong>「スキャン & 分類を実行」</strong> をクリック<br/>
          4. 論文メタデータが自動抽出され、Google Sheets に保存されます
        </p>
      </div>
    </div>
  );
}
