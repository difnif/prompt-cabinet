import { useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { auth, googleProvider } from './firebase'
import { useProjects } from './hooks/useProjects'
import ProjectList from './components/ProjectList'
import TaskLog from './components/TaskLog'
import { TaskLogProvider, useTaskLog } from './contexts/TaskLogContext'

function AppShell() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState(null)
  const [workMode, setWorkMode] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const taskLog = useTaskLog()

  const { projects, loading, createProject, updateProject, deleteProject } =
    useProjects(user?.uid)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthLoading(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id)
    }
    if (selectedProjectId && !projects.find((p) => p.id === selectedProjectId)) {
      setSelectedProjectId(projects[0]?.id || null)
    }
  }, [projects, selectedProjectId])

  const handleSignIn = async () => {
    setAuthError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      setAuthError(e.message)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut(auth)
    } catch (e) {
      setAuthError(e.message)
    }
  }

  const handleCreateProject = async ({ name, prefix }) => {
    const taskId = taskLog.startTask(`프로젝트 "${name}" 생성 중…`)
    try {
      const id = await createProject({ name, prefix, ownerId: user.uid })
      taskLog.succeedTask(taskId, `프로젝트 "${name}" 생성됨`)
      setSelectedProjectId(id)
    } catch (e) {
      taskLog.failTask(taskId, `생성 실패: ${e.message}`)
      throw e
    }
  }

  const handleUpdateProject = async (id, patch) => {
    const taskId = taskLog.startTask(`프로젝트 수정 중…`)
    try {
      await updateProject(id, patch)
      taskLog.succeedTask(taskId, `프로젝트 수정됨`)
    } catch (e) {
      taskLog.failTask(taskId, `수정 실패: ${e.message}`)
      throw e
    }
  }

  const handleDeleteProject = async (id) => {
    const target = projects.find((p) => p.id === id)
    const taskId = taskLog.startTask(`프로젝트 "${target?.name}" 삭제 중…`)
    try {
      await deleteProject(id)
      taskLog.succeedTask(taskId, `프로젝트 삭제됨`)
    } catch (e) {
      taskLog.failTask(taskId, `삭제 실패: ${e.message}`)
      throw e
    }
  }

  if (authLoading) {
    return (
      <div className="app">
        <header className="app-header">
          <div className="header-row">
            <div>
              <h1>prompt-cabinet</h1>
              <p className="tagline">프롬프트를 서랍에 정리하세요</p>
            </div>
          </div>
        </header>
        <main className="app-main">
          <div className="status-card">
            <div className="status-dot status-dot--loading" />
            <div className="status-title">세션 확인 중…</div>
          </div>
        </main>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app">
        <header className="app-header">
          <div className="header-row">
            <div>
              <h1>prompt-cabinet</h1>
              <p className="tagline">프롬프트를 서랍에 정리하세요</p>
            </div>
          </div>
        </header>
        <main className="app-main">
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
            {authError && <div className="error-msg">{authError}</div>}
          </div>
        </main>
      </div>
    )
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-row">
          <div>
            <h1>prompt-cabinet</h1>
            <p className="tagline">프롬프트를 서랍에 정리하세요</p>
          </div>
          <div className="header-actions">
            <label className={`work-toggle ${workMode ? 'is-on' : ''}`}>
              <input
                type="checkbox"
                checked={workMode}
                onChange={(e) => setWorkMode(e.target.checked)}
              />
              <span className="work-toggle__track">
                <span className="work-toggle__thumb" />
              </span>
              <span className="work-toggle__label">
                작업 모드 {workMode ? 'ON' : 'OFF'}
              </span>
            </label>
            <button className="btn-ghost" onClick={handleSignOut}>
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="app-body">
        <ProjectList
          projects={projects}
          loading={loading}
          selectedId={selectedProjectId}
          onSelect={setSelectedProjectId}
          onCreate={handleCreateProject}
          onUpdate={handleUpdateProject}
          onDelete={handleDeleteProject}
        />

        <main className="workspace">
          {selectedProject ? (
            <div className="workspace__empty">
              <div className="workspace__title">{selectedProject.name}</div>
              <div className="workspace__sub">
                접두어: <code>{selectedProject.prefix}</code> · 셀{' '}
                {selectedProject.cellCount || 0}개
              </div>
              <div className="workspace__placeholder">
                Step 4에서 프롬프트 입력창과 셀 격자가 연결됩니다
              </div>
            </div>
          ) : (
            <div className="workspace__empty">
              <div className="workspace__title">프로젝트를 선택하세요</div>
              <div className="workspace__sub">
                좌측에서 선택하거나 새로 만들 수 있습니다
              </div>
            </div>
          )}
        </main>
      </div>

      <TaskLog />
    </div>
  )
}

export default function App() {
  return (
    <TaskLogProvider>
      <AppShell />
    </TaskLogProvider>
  )
}
