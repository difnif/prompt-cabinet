import { useEffect, useRef, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { writeBatch, doc, collection, getDocs } from 'firebase/firestore'
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
import ZipDropzone from './components/ZipDropzone'
import MoveCellsDialog from './components/MoveCellsDialog'
import MergeProjectDialog from './components/MergeProjectDialog'
import ChangePrefixDialog from './components/ChangePrefixDialog'
import AutoClassifyDialog from './components/AutoClassifyDialog'
import { TaskLogProvider, useTaskLog } from './contexts/TaskLogContext'
import { compactIdentifiers } from './utils/identifierRange'
import {
  downloadAll,
  downloadImagesOnly,
  downloadTextOnly,
} from './utils/downloadHelpers'
import { readImportFile } from './utils/parseZip'
import { parseMdFile } from './utils/parseMdFile'
import { ensureUniquePrefix } from './utils/generatePrefix'
import {
  changeProjectPrefix,
  mergeProjects,
  moveCellsToProject,
  moveToCellsToNewProject,
} from './utils/cellMover'

function AppShell() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState(null)
  const [signingIn, setSigningIn] = useState(false)
  const [workMode, setWorkMode] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [selectedCellId, setSelectedCellId] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const lastClickedIndexRef = useRef(null)
  const dragBaseSelectionRef = useRef(null)

  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(null)

  // 이동/합치기/접두어 변경/자동분류 모달 상태
  const [moveDialog, setMoveDialog] = useState(null) // { mode: 'new'|'existing', cells }
  const [mergeDialog, setMergeDialog] = useState(null) // sourceProject
  const [prefixDialog, setPrefixDialog] = useState(null) // project
  const [autoClassifyDialog, setAutoClassifyDialog] = useState(null) // { project, cells }

  const taskLog = useTaskLog()
  const { settings, update: updateSettings, reset: resetSettings } = useSettings()

  const { projects, loading, createProject, updateProject, deleteProject, addCells } =
    useProjects(user?.uid)
  const { cells, deleteCell, updateCell } = useCells(selectedProjectId)

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

  useEffect(() => {
    setSelectedCellId(null)
    setSelectedIds(new Set())
  }, [selectedProjectId])

  useEffect(() => {
    if (workMode) {
      setSelectedCellId(null)
    } else {
      setSelectedIds(new Set())
      lastClickedIndexRef.current = null
    }
  }, [workMode])

  useEffect(() => {
    const onUp = () => {
      dragBaseSelectionRef.current = null
    }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [])

  const handleSignIn = async () => {
    setAuthError(null)
    setSigningIn(true)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      console.error('Sign in failed:', e)
      if (
        e.code !== 'auth/popup-closed-by-user' &&
        e.code !== 'auth/cancelled-popup-request'
      ) {
        setAuthError(e.message)
      }
    } finally {
      setSigningIn(false)
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

  const handleAddCells = async (prompts) => {
    if (!selectedProjectId) return
    const taskId = taskLog.startTask(`${prompts.length}개 프롬프트 저장 중…`)
    try {
      await addCells(selectedProjectId, prompts)
      taskLog.succeedTask(taskId, `${prompts.length}개 프롬프트 저장됨`)
    } catch (e) {
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
      taskLog.failTask(taskId, `삭제 실패: ${e.message}`)
    }
  }

  const handleCopyPrompt = async (cell) => {
    try {
      await navigator.clipboard.writeText(cell.prompt)
      const id = taskLog.startTask(`${cell.identifier} 프롬프트 복사됨`)
      taskLog.succeedTask(id, `${cell.identifier} 프롬프트 복사됨`)
    } catch (e) {
      const id = taskLog.startTask('복사 실패')
      taskLog.failTask(id, e.message)
    }
  }

  const handleRatingChange = async (cell, rating) => {
    try {
      await updateCell(selectedProjectId, cell.id, { rating })
    } catch (e) {
      const id = taskLog.startTask('별점 업데이트 실패')
      taskLog.failTask(id, e.message)
    }
  }

  // ===== zip 가져오기 =====

  const handleImportFile = async (file) => {
    if (importing) return
    setImporting(true)
    setImportProgress({ current: 0, total: 100, label: '파일 읽는 중…' })
    const importTaskId = taskLog.startTask(`"${file.name}" 가져오는 중…`)
    try {
      const fileEntries = await readImportFile(file)
      if (fileEntries.length === 0) {
        throw new Error('처리 가능한 파일이 없습니다 (.md/.txt만 지원)')
      }
      setImportProgress({
        current: 0,
        total: fileEntries.length,
        label: `${fileEntries.length}개 파일 분석 중…`,
      })
      const parsed = fileEntries.map((entry) =>
        parseMdFile(entry.filename, entry.content)
      )
      let totalProjectsCreated = 0
      let totalProjectsMerged = 0
      let totalPromptsAdded = 0
      const skipped = []
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i]
        setImportProgress({
          current: i,
          total: parsed.length,
          label: `${item.filename} 처리 중…`,
        })
        if (item.prompts.length === 0) {
          skipped.push(item.filename)
          const skipId = taskLog.startTask(`${item.filename} 스킵 (프롬프트 0개)`)
          taskLog.failTask(skipId, `${item.filename} 스킵: 프롬프트 없음`)
          continue
        }
        const existing = findExistingProjectByName(item.projectName, projects)
        if (existing) {
          const mergeId = taskLog.startTask(
            `${item.filename} → "${existing.name}"에 ${item.prompts.length}개 추가 중…`
          )
          try {
            await addCells(existing.id, item.prompts)
            totalProjectsMerged++
            totalPromptsAdded += item.prompts.length
            taskLog.succeedTask(
              mergeId,
              `"${existing.name}"에 ${item.prompts.length}개 추가됨`
            )
          } catch (e) {
            taskLog.failTask(mergeId, `병합 실패: ${e.message}`)
          }
        } else {
          const existingPrefixes = projects.map((p) => p.prefix)
          const uniquePrefix = ensureUniquePrefix(item.prefix || 'x', existingPrefixes)
          const createId = taskLog.startTask(
            `${item.filename} → 신규 프로젝트 "${item.projectName}" 생성 중…`
          )
          try {
            const newProjectId = await createProject({
              name: item.projectName,
              prefix: uniquePrefix,
              ownerId: user.uid,
            })
            await addCells(newProjectId, item.prompts)
            totalProjectsCreated++
            totalPromptsAdded += item.prompts.length
            taskLog.succeedTask(
              createId,
              `"${item.projectName}" 생성 + ${item.prompts.length}개 추가됨`
            )
          } catch (e) {
            taskLog.failTask(createId, `생성 실패: ${e.message}`)
          }
        }
      }
      const summary = [
        totalProjectsCreated > 0 ? `${totalProjectsCreated}개 신규` : null,
        totalProjectsMerged > 0 ? `${totalProjectsMerged}개 병합` : null,
        `${totalPromptsAdded}개 프롬프트`,
        skipped.length > 0 ? `${skipped.length}개 스킵` : null,
      ]
        .filter(Boolean)
        .join(' · ')
      taskLog.succeedTask(importTaskId, `가져오기 완료: ${summary}`)
    } catch (e) {
      taskLog.failTask(importTaskId, `가져오기 실패: ${e.message}`)
    } finally {
      setImporting(false)
      setImportProgress(null)
    }
  }

  // ===== 다중 선택 =====

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

  const getSelectedCells = () => {
    return sortedCells.filter((c) => selectedIds.has(c.id))
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  // ===== 일괄 동작 =====

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
        selectedProject?.name
      )
      taskLog.succeedTask(taskId, `텍스트 다운로드 완료 (${selected.length}개)`)
    } catch (e) {
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
      taskLog.failTask(taskId, `다운로드 실패: ${e.message}`)
    }
  }

  const handleBulkDeleteRequest = () => {
    const selected = getSelectedCells()
    if (selected.length === 0) return
    setDeleteConfirm({ cells: selected })
  }

  const handleBulkDeleteConfirmed = async () => {
    if (!deleteConfirm) return
    const targets = deleteConfirm.cells
    setDeleteConfirm(null)
    const taskId = taskLog.startTask(`${targets.length}개 셀 삭제 중…`)
    try {
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
      const batch = writeBatch(db)
      for (const cell of targets) {
        batch.delete(doc(db, 'projects', selectedProjectId, 'cells', cell.id))
      }
      await batch.commit()
      taskLog.succeedTask(taskId, `${targets.length}개 셀 삭제 완료`)
      setSelectedIds(new Set())
      lastClickedIndexRef.current = null
    } catch (e) {
      taskLog.failTask(taskId, `삭제 실패: ${e.message}`)
    }
  }

  // ===== 이동/합치기/접두어 =====

  const handleMove = (mode) => {
    const selected = getSelectedCells()
    if (selected.length === 0) return
    setMoveDialog({ mode, cells: selected })
  }

  const handleConfirmMoveToNew = async ({ name, prefix }) => {
    const targets = moveDialog?.cells ?? []
    setMoveDialog(null)
    const taskId = taskLog.startTask(
      `${targets.length}개 셀 → 새 프로젝트 "${name}"으로 이동 중…`
    )
    try {
      const result = await moveToCellsToNewProject({
        userId: user.uid,
        srcProjectId: selectedProjectId,
        cells: targets,
        newProjectName: name,
        newProjectPrefix: prefix,
        onProgress: (p) => {
          taskLog.updateTask?.(taskId, p.label)
        },
      })
      taskLog.succeedTask(
        taskId,
        `"${name}" 생성 + ${result.moved}개 이동 완료 (${result.mapping[0]?.from} → ${result.mapping[0]?.to} ...)`
      )
      setSelectedIds(new Set())
      lastClickedIndexRef.current = null
    } catch (e) {
      taskLog.failTask(taskId, `이동 실패: ${e.message}`)
    }
  }

  const handleConfirmMoveToExisting = async (dstProjectId) => {
    const targets = moveDialog?.cells ?? []
    setMoveDialog(null)
    const dstProject = projects.find((p) => p.id === dstProjectId)
    const taskId = taskLog.startTask(
      `${targets.length}개 셀 → "${dstProject?.name}"으로 이동 중…`
    )
    try {
      const result = await moveCellsToProject({
        srcProjectId: selectedProjectId,
        dstProjectId,
        cells: targets,
        onProgress: (p) => {
          taskLog.updateTask?.(taskId, p.label)
        },
      })
      taskLog.succeedTask(
        taskId,
        `${result.moved}개 → "${dstProject?.name}"로 이동 완료`
      )
      setSelectedIds(new Set())
      lastClickedIndexRef.current = null
    } catch (e) {
      taskLog.failTask(taskId, `이동 실패: ${e.message}`)
    }
  }

  const handleMergeRequest = (project) => {
    setMergeDialog(project)
  }

  const handleConfirmMerge = async (dstProjectId) => {
    const src = mergeDialog
    setMergeDialog(null)
    if (!src) return
    const dstProject = projects.find((p) => p.id === dstProjectId)
    const taskId = taskLog.startTask(
      `"${src.name}" → "${dstProject?.name}" 합치는 중…`
    )
    try {
      const result = await mergeProjects({
        srcProjectId: src.id,
        dstProjectId,
        onProgress: (p) => {
          taskLog.updateTask?.(taskId, p.label)
        },
      })
      taskLog.succeedTask(
        taskId,
        `${result.moved}개 셀이 "${dstProject?.name}"로 이동, "${src.name}" 삭제됨`
      )
      // 선택된 프로젝트가 합쳐진 거면 대상 프로젝트로 전환
      if (selectedProjectId === src.id) {
        setSelectedProjectId(dstProjectId)
      }
    } catch (e) {
      taskLog.failTask(taskId, `합치기 실패: ${e.message}`)
    }
  }

  const handlePrefixRequest = (project) => {
    setPrefixDialog(project)
  }

  const handleConfirmPrefix = async (newPrefix) => {
    const target = prefixDialog
    setPrefixDialog(null)
    if (!target) return
    const taskId = taskLog.startTask(
      `"${target.name}" 접두어 ${target.prefix} → ${newPrefix} 변경 중…`
    )
    try {
      const result = await changeProjectPrefix({
        projectId: target.id,
        newPrefix,
        onProgress: (p) => {
          taskLog.updateTask?.(taskId, p.label)
        },
      })
      taskLog.succeedTask(
        taskId,
        `${target.name}: ${result.changed}개 셀 식별어 업데이트 완료`
      )
    } catch (e) {
      taskLog.failTask(taskId, `접두어 변경 실패: ${e.message}`)
    }
  }

  // ===== 자동 분류 =====

  const handleAutoClassifyRequest = async (project) => {
    const taskId = taskLog.startTask(`"${project.name}" 셀 분석 준비 중…`)
    try {
      const snap = await getDocs(collection(db, 'projects', project.id, 'cells'))
      const cellsData = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      taskLog.succeedTask(taskId, `${cellsData.length}개 셀 로드 완료`)
      setAutoClassifyDialog({ project, cells: cellsData })
    } catch (e) {
      taskLog.failTask(taskId, `로드 실패: ${e.message}`)
    }
  }

  const handleConfirmAutoClassify = async (plannedGroups, onProgress) => {
    if (!autoClassifyDialog) {
      return { projectsCreated: 0, cellsMoved: 0 }
    }
    const src = autoClassifyDialog.project
    const taskId = taskLog.startTask(
      `"${src.name}" 자동 분류: ${plannedGroups.length}개 그룹 생성 중…`
    )

    let cellsMoved = 0
    try {
      for (let i = 0; i < plannedGroups.length; i++) {
        const g = plannedGroups[i]
        onProgress(i, `${g.label} 분리 중 (${g.cells.length}개)`)

        const result = await moveToCellsToNewProject({
          userId: user.uid,
          srcProjectId: src.id,
          cells: g.cells,
          newProjectName: g.newProjectName,
          newProjectPrefix: g.newPrefix,
          onProgress: (p) => {
            taskLog.updateTask?.(taskId, `[${g.label}] ${p.label}`)
          },
        })

        cellsMoved += result.moved
        onProgress(i + 1, `${g.label} 완료`)
      }

      taskLog.succeedTask(
        taskId,
        `자동 분류 완료: 새 프로젝트 ${plannedGroups.length}개, ${cellsMoved}개 셀 이동`
      )
      return { projectsCreated: plannedGroups.length, cellsMoved }
    } catch (e) {
      taskLog.failTask(taskId, `자동 분류 실패: ${e.message}`)
      throw e // 다이얼로그가 에러 화면 표시
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
            <button
              className="btn-primary"
              onClick={handleSignIn}
              disabled={signingIn}
            >
              {signingIn ? '로그인 중…' : 'Google로 로그인'}
            </button>
            {authError && <div className="error-msg">{authError}</div>}
          </div>
        </main>
      </div>
    )
  }

  const selectedCell = sortedCells.find((c) => c.id === selectedCellId)
  const hasNoProjects = projects.length === 0

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
          onMerge={handleMergeRequest}
          onChangePrefix={handlePrefixRequest}
          onAutoClassify={handleAutoClassifyRequest}
        />

        <main className="workspace">
          {hasNoProjects ? (
            <div className="workspace__welcome">
              <div className="workspace__title">시작하기</div>
              <div className="workspace__sub">
                좌측에서 직접 프로젝트를 만들거나, zip/md 파일로 한 번에 가져올 수 있어요.
              </div>
              <ZipDropzone
                onFileSelected={handleImportFile}
                importing={importing}
                progress={importProgress}
              />
            </div>
          ) : selectedProject ? (
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
                  onMove={handleMove}
                  onDelete={handleBulkDeleteRequest}
                />
              )}

              {!workMode && (
                <>
                  <PromptInput onSubmit={handleAddCells} />
                  <ZipDropzone
                    onFileSelected={handleImportFile}
                    importing={importing}
                    progress={importProgress}
                  />
                </>
              )}

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

      <MoveCellsDialog
        open={!!moveDialog}
        selectedCells={moveDialog?.cells || []}
        projects={projects}
        currentProjectId={selectedProjectId}
        onConfirmMoveToNew={handleConfirmMoveToNew}
        onConfirmMoveToExisting={handleConfirmMoveToExisting}
        onClose={() => setMoveDialog(null)}
      />

      <MergeProjectDialog
        open={!!mergeDialog}
        sourceProject={mergeDialog}
        projects={projects}
        onConfirm={handleConfirmMerge}
        onClose={() => setMergeDialog(null)}
      />

      <ChangePrefixDialog
        open={!!prefixDialog}
        project={prefixDialog}
        existingPrefixes={projects.map((p) => p.prefix)}
        onConfirm={handleConfirmPrefix}
        onClose={() => setPrefixDialog(null)}
      />

      <AutoClassifyDialog
        isOpen={!!autoClassifyDialog}
        onClose={() => setAutoClassifyDialog(null)}
        sourceProject={autoClassifyDialog?.project}
        cells={autoClassifyDialog?.cells || []}
        allProjects={projects}
        onExecute={handleConfirmAutoClassify}
        minGroupSize={50}
      />

      <TaskLog />
    </div>
  )
}

function findExistingProjectByName(name, projects) {
  if (!name) return null
  const normalized = name.trim().toLowerCase()
  return projects.find((p) => p.name?.trim().toLowerCase() === normalized) || null
}

export default function App() {
  return (
    <TaskLogProvider>
      <AppShell />
    </TaskLogProvider>
  )
}
