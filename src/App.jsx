import { useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { auth, googleProvider } from './firebase'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const handleSignIn = async () => {
    setError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut(auth)
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>prompt-cabinet</h1>
          <p className="tagline">프롬프트를 서랍에 정리하세요</p>
        </header>
        <main className="app-main">
          <div className="status-card">
            <div className="status-dot status-dot--loading" />
            <div>
              <div className="status-title">세션 확인 중…</div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-row">
          <div>
            <h1>prompt-cabinet</h1>
            <p className="tagline">프롬프트를 서랍에 정리하세요</p>
          </div>
          {user && (
            <button className="btn-ghost" onClick={handleSignOut}>
              로그아웃
            </button>
          )}
        </div>
      </header>

      <main className="app-main">
        {!user ? (
          <div className="auth-card">
            <div className="auth-title">시작하려면 로그인하세요</div>
            <p className="auth-sub">
              Google 계정으로 로그인하면 프로젝트와 프롬프트가
              <br />
              기기 간에 동기화됩니다.
            </p>
            <button className="btn-primary" onClick={handleSignIn}>
              Google로 로그인
            </button>
            {error && <div className="error-msg">{error}</div>}
          </div>
        ) : (
          <div className="status-card">
            <div className="status-dot" />
            <div style={{ flex: 1 }}>
              <div className="status-title">
                로그인 완료 — {user.displayName || user.email}
              </div>
              <div className="status-sub">
                Step 2 OK · 다음 단계에서 프로젝트 CRUD가 연결됩니다
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
