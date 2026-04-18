export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>prompt-cabinet</h1>
        <p className="tagline">프롬프트를 서랍에 정리하세요</p>
      </header>
      <main className="app-main">
        <div className="status-card">
          <div className="status-dot" />
          <div>
            <div className="status-title">배포 파이프라인 연결 확인</div>
            <div className="status-sub">Step 1 — Vite + React 뼈대 OK</div>
          </div>
        </div>
      </main>
    </div>
  )
}