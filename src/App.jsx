import { useEffect, useRef, useState } from 'react'
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import { writeBatch, doc, deleteDoc } from 'firebase/firestore'
import { ref as storageRef, deleteObject } from 'firebase/storage'
import { auth, db, googleProvider, storage } from './firebase'
import { useProjects } from './hooks/useProjects'
import { useCells } from './hooks/useCells'
import { useSettings } from './hooks/useSettings'
import ProjectList from './components/ProjectList'
import PromptInput from './components/PromptInput'
import CellGrid from './components/CellGrid'
import CellDetailPanel from './components/CellDetailPanel'
import TaskLog from './components/TaskLog'
import SortMenu, { sortCells } from './components/SortMenu'
import SettingsModal from './components/SettingsModal'
import WorkModeBar from './components/WorkModeBar'
import ConfirmDialog from './components/ConfirmDialog'
import { TaskLogProvider, useTaskLog } from './contexts/TaskLogContext'
import { compactIdentifiers } from './utils/identifierRange'
import {
  downloadAll,
  downloadImagesOnly,
  downloadTextOnly,
} from './utils/downloadHelpers'

function AppShell() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState(null)
  const [workMode, setWorkMode] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [selectedCellId, setSelectedCellId] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // 다중 선택 상태
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const lastClickedIndexRef = useRef(null)
  const dragBaseSelectionRef = useRef(null) // 드래그 시작 시점의 선택 상태

  // 삭제 확인 모달
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const taskLog = useTaskLog()
  const { settings, update: updateSettings, reset: resetSettings } = useSettings()

  const { projects, loading, createProject, updateProject, deleteProject, addCells } =
    useProjects(user?.uid)
  const { cells, deleteCell, updateCell } = useCells(selectedProjectId)

  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      console.error('Redirect error:', err)
      setAuthError(err.message)
    })
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

  useEffect(() => {
    setSelectedCellId(null)
    setSelectedIds(new Set())
  }, [selectedProjectId])

  // 작업 모드 켤 때: 상세 패널 닫기
  useEffect(() => {
    if (workMode) {
      setSelectedCellId(null)
    } else {
      // 작업 모드 끄면 다중 선택 초기화
      setSelectedIds(new Set())
      lastClickedIndexRef.current = null
    }
  }, [workMode])

  // 드래그 끝났을 때 base 초기화
  useEffect(() => {
    const onUp = () => {
      dragBaseSelectionRef.current = null
    }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [])

  const handleSignIn = async () => {
    setAuthError(null)
    try {
      await signInWithRedirect(auth, googleProvider)
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
      console.error('Create project failed:', e)
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
      console.error('Update project failed:', e)
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
      console.error('Delete project failed:', e)
      taskLog.failTask(taskId, `삭제 실패: ${e.message}`)
      throw e
    }
  }

  const handleAddCells = async (prompts) => {
    if (!selectedProjectId) return
    const taskId = taskLog.startTask(`${prompts.length}개 프롬프트 저장 중…`)
    try {
      await addCells(selectedProjectId, prompts)
      taskLog.succeedTask(taskId, `${prompts.length}개 프롬프트 저장됨`)
    } catch (e) {
      console.error('Add cells failed:', e)
      taskLog.failTask(taskId, `저장 실패: ${e.message}`)
      throw e
    }
  }

  const handleDeleteCell = async (cell) => {
    const taskId = taskLog.startTask(`${cell.identifier} 삭제 중…`)
    try {
      await deleteCell(selectedProjectId, cell.id)
      taskLog.succeedTask(taskId, `${cell.identifier} 삭제됨`)
      setSelectedCellId(null)
    } catch (e) {
      console.error('Delete cell failed:', e)
      taskLog.failTask(taskId, `삭제 실패: ${e.message}`)
    }
  }

  const handleCopyPrompt = async (cell) => {
    try {
      await navigator.clipboard.writeText(cell.prompt)
      const id = taskLog.startTask(`${cell.identifier} 프롬프트 복사됨`)
      taskLog.succeedTask(id, `${cell.identifier} 프롬프트 복사됨`)
    } catch (e) {
      console.error('Copy failed:', e)
      const id = taskLog.startTask('복사 실패')
      taskLog.failTask(id, e.message)
    }
  }

  const handleRatingChange = async (cell, rating) => {
    try {
      await updateCell(selectedProjectId, cell.id, { rating })
    } catch (e) {
      console.error('Rating update failed:', e)
      const id = taskLog.startTask('별점 업데이트 실패')
      taskLog.failTask(id, e.message)
    }
  }

  // ===== 다중 선택 핸들러 =====

  const sortedCells = sortCells(cells, settings.sortBy)

  const handleToggleSelect = (cellId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(cellId)) next.delete(cellId)
      else next.add(cellId)
      return next
    })
    const idx = sortedCells.findIndex((c) => c.id === cellId)
    if (idx >= 0) lastClickedIndexRef.current = idx
  }

  const handleRangeSelect = (clickedIndex) => {
    const last = lastClickedIndexRef.current
    if (last == null) {
      // 시작 셀이 없으면 단일 선택처럼
      const id = sortedCells[clickedIndex]?.id
      if (id) {
        setSelectedIds((prev) => {
          const next = new Set(prev)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        })
        lastClickedIndexRef.current = clickedIndex
      }
      return
    }
    const lo = Math.min(last, clickedIndex)
    const hi = Math.max(last, clickedIndex)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (let i = lo; i <= hi; i++) {
        if (sortedCells[i]) next.add(sortedCells[i].id)
      }
      return next
    })
    lastClickedIndexRef.current = clickedIndex
  }

  const handleDragSelect = (idsInRange) => {
    // 드래그 시작 시점의 선택 상태를 기억하고, 그 위에 range를 union
    if (!dragBaseSelectionRef.current) {
      dragBaseSelectionRef.current = new Set(selectedIds)
    }
    const base = dragBaseSelectionRef.current
    const next = new Set(base)
    idsInRange.forEach((id) => next.add(id))
    setSelectedIds(next)
  }

  const handleSelectAll = () => {
    setSelectedIds(new Set(sortedCells.map((c) => c.id)))
  }

  const handleClearSelection = () => {
    setSelectedIds(new Set())
    lastClickedIndexRef.current = null
  }

  // ===== 일괄 동작 =====

  const getSelectedCells = () => {
    return sortedCells.filter((c) => selectedIds.has(c.id))
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  const handleCopyIdentifiers = async () => {
    const selected = getSelectedCells()
    if (selected.length === 0) return
    const text = compactIdentifiers(selected.map((c) => c.identifier))
    try {
      await navigator.clipboard.writeText(text)
      const id = taskLog.startTask(`식별어 ${selected.length}개 복사됨`)
      taskLog.succeedTask(id, `식별어 복사됨: ${text}`)
    } catch (e) {
      const id = taskLog.startTask('복사 실패')
      taskLog.failTask(id, e.message)
    }
  }

  const handleDownloadText = async () => {
    const selected = getSelectedCells()
    if (selected.length === 0) return
    const taskId = taskLog.startTask(`텍스트 ${selected.length}개 다운로드 중…`)
    try {
      await downloadTextOnly(
        selected,
        settings.textDownloadFormat,
        selectedProject?.name,
        ({ label }) => {
          // 진행률 미세 업데이트는 생략 (기본 알림으로 충분)
        }
      )
      taskLog.succeedTask(taskId, `텍스트 다운로드 완료 (${selected.length}개)`)
    } catch (e) {
      console.error('Download text failed:', e)
      taskLog.failTask(taskId, `다운로드 실패: ${e.message}`)
    }
  }

  const handleDownloadImages = async () => {
    const selected = getSelectedCells()
    const totalImages = selected.reduce((s, c) => s + (c.images?.length || 0), 0)
    if (totalImages === 0) {
      const id = taskLog.startTask('다운로드할 이미지가 없습니다')
      taskLog.failTask(id, '선택한 셀에 이미지가 없습니다')
      return
    }
    const taskId = taskLog.startTask(`이미지 ${totalImages}장 다운로드 중…`)
    try {
      await downloadImagesOnly(selected, selectedProject?.name)
      taskLog.succeedTask(taskId, `이미지 다운로드 완료 (${totalImages}장)`)
    } catch (e) {
      console.error('Download images failed:', e)
      taskLog.failTask(taskId, `다운로드 실패: ${e.message}`)
    }
  }

  const handleDownloadAll = async () => {
    const selected = getSelectedCells()
    if (selected.length === 0) return
    const taskId = taskLog.startTask(`zip 묶기 중… (${selected.length}개)`)
    try {
      await downloadAll(selected, selectedProject?.name, settings.textDownloadFormat)
      taskLog.succeedTask(taskId, `zip 다운로드 완료 (${selected.length}개)`)
    } catch (e) {
      console.error('Download all failed:', e)
      taskLog.failTask(taskId, `다운로드 실패: ${e.message}`)
    }
  }

  const handleBulkDeleteRequest = () => {
    const selected = getSelectedCells()
    if (selected.length === 0) return
    setDeleteConfirm({
      cells: selected,
    })
  }

  const handleBulkDeleteConfirmed = async () => {
    if (!deleteConfirm) return
    const targets = deleteConfirm.cells
    setDeleteConfirm(null)

    const taskId = taskLog.startTask(`${targets.length}개 셀 삭제 중…`)
    try {
      // 1. 각 셀의 Storage 이미지 삭제
      for (const cell of targets) {
        const images = cell.images || []
        for (const img of images) {
          try {
            await deleteObject(storageRef(storage, img.path))
          } catch (e) {
            console.warn(`Storage delete failed (${img.path}):`, e.message)
          }
        }
      }
      // 2. Firestore 셀 문서 삭제 (batch)
      const batch = writeBatch(db)
      for (const cell of targets) {
        batch.delete(doc(db, 'projects', selectedProjectId, 'cells', cell.id))
      }
      await batch.commit()
      taskLog.succeedTask(taskId, `${targets.length}개 셀 삭제 완료`)
      setSelectedIds(new Set())
      lastClickedIndexRef.current = null
    } catch (e) {
      console.error('Bulk delete failed:', e)
      taskLog.failTask(taskId, `삭제 실패: ${e.message}`)
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

  const selectedCell = sortedCells.find((c) => c.id === selectedCellId)

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
            <button
              className="btn-icon"
              onClick={() => setSettingsOpen(true)}
              aria-label="환경설정"
              title="환경설정"
            >
              ⚙
            </button>
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
            <>
              <div className="workspace__head">
                <div className="workspace__title-row">
                  <h2 className="workspace__title">{selectedProject.name}</h2>
                  <span className="workspace__meta">
                    <code>{selectedProject.prefix}</code> · {cells.length}개
                  </span>
                </div>
                <div className="workspace__tools">
                  <SortMenu
                    value={settings.sortBy}
                    onChange={(v) => updateSettings({ sortBy: v })}
                  />
                </div>
              </div>

              {workMode && (
                <WorkModeBar
                  selectedCount={selectedIds.size}
                  totalCount={sortedCells.length}
                  onSelectAll={handleSelectAll}
                  onClearSelection={handleClearSelection}
                  onCopyIdentifiers={handleCopyIdentifiers}
                  onDownloadText={handleDownloadText}
                  onDownloadImages={handleDownloadImages}
                  onDownloadAll={handleDownloadAll}
                  onDelete={handleBulkDeleteRequest}
                />
              )}

              {!workMode && <PromptInput onSubmit={handleAddCells} />}

              <CellGrid
                cells={sortedCells}
                selectedId={selectedCellId}
                onSelect={(c) => setSelectedCellId(c.id)}
                workMode={workMode}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onRangeSelect={handleRangeSelect}
                onDragSelect={handleDragSelect}
                showRatingDots={settings.showRatingDots}
                showImageCountBadge={settings.showImageCountBadge}
              />
            </>
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

      {selectedCell && !workMode && (
        <CellDetailPanel
          cell={selectedCell}
          userId={user.uid}
          projectId={selectedProjectId}
          onClose={() => setSelectedCellId(null)}
          onDelete={handleDeleteCell}
          onCopy={handleCopyPrompt}
          onRatingChange={handleRatingChange}
          taskLog={taskLog}
        />
      )}

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onUpdate={updateSettings}
        onReset={resetSettings}
        onClose={() => setSettingsOpen(false)}
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        title={`${deleteConfirm?.cells?.length ?? 0}개 셀 삭제`}
        message="선택한 셀과 첨부 이미지를 모두 삭제합니다. 되돌릴 수 없습니다."
        detail={
          deleteConfirm
            ? compactIdentifiers(deleteConfirm.cells.map((c) => c.identifier))
            : ''
        }
        confirmText="삭제"
        cancelText="취소"
        danger
        onConfirm={handleBulkDeleteConfirmed}
        onCancel={() => setDeleteConfirm(null)}
      />

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
