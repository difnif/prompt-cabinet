import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { moveToCellsToNewProject, mergeProjects } from '../utils/cellMover'
import {
  classifyCells,
  generateGroupProjectInfo,
} from '../utils/autoClassifier'
import {
  getCurrentJob,
  getQueue,
  enqueueJob,
  updateCurrentJob,
  finishCurrentJob,
  generateJobId,
} from '../utils/autoClassifyJobStore'

const AutoClassifyContext = createContext(null)

export function useAutoClassify() {
  const ctx = useContext(AutoClassifyContext)
  if (!ctx) throw new Error('useAutoClassify는 AutoClassifyProvider 안에서만 사용')
  return ctx
}

/**
 * 자동 분류 시스템 — 전역 상태 + 작업 실행기
 *
 * Provider는 외부에서 한 번만 감싸고, 내부에서 setRuntime({ userId, projects, taskLog })
 * 으로 데이터 주입. 이렇게 하면 인증 전/후에도 Provider 위치를 옮기지 않아도 됨.
 *
 * 책임:
 * - 새 작업 시작 (현재 작업 중이면 큐에 쌓기)
 * - 페이지 로드 시 미완료 작업 자동 재개
 * - 그룹별 순차 처리 + 진행률 보고
 * - 취소 시 지금까지 만든 프로젝트들을 원본에 다시 합쳐 원복
 * - 완료 시 큐에서 다음 작업 꺼내 실행
 */
export function AutoClassifyProvider({ children }) {
  const [currentJob, setCurrentJob] = useState(getCurrentJob())
  const [queue, setQueue] = useState(getQueue())
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' })
  const [phase, setPhase] = useState('idle') // idle|analyzing|preview|running|cancelling|done|error
  const [pendingPreview, setPendingPreview] = useState(null)
  const [error, setError] = useState(null)
  const [cardCollapsed, setCardCollapsed] = useState(false)

  // 외부에서 주입되는 런타임 (App에서 setRuntime으로 갱신)
  const runtimeRef = useRef({ userId: null, projects: [], taskLog: null })
  const runningRef = useRef(false)
  const cancelRequestedRef = useRef(false)
  const resumedOnceRef = useRef(false)

  const setRuntime = useCallback((rt) => {
    runtimeRef.current = { ...runtimeRef.current, ...rt }
    // 처음 userId가 들어오는 시점에 자동 재개 시도
    if (rt.userId && !resumedOnceRef.current) {
      resumedOnceRef.current = true
      const job = getCurrentJob()
      if (job && job.userId === rt.userId && !runningRef.current) {
        // 자동 재개 알림 + 시작
        const tl = runtimeRef.current.taskLog
        if (tl?.startTask && tl?.succeedTask) {
          const t = tl.startTask('이전 작업 이어서 진행')
          tl.succeedTask(t, `"${job.sourceProjectName}" 자동 분류 재개`)
        }
        updateCurrentJob({ resumedFromInterrupt: true })
        setCurrentJob(getCurrentJob())
        // 약간의 지연 후 시작 (UI 마운트 대기)
        setTimeout(() => tryRunCurrent(), 300)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─────────────────────────────────────
  // 사용자가 ⋯ 메뉴에서 자동 분류 클릭
  // ─────────────────────────────────────
  const requestClassification = async (project) => {
    const { userId, taskLog } = runtimeRef.current
    if (!userId) {
      console.warn('자동 분류: 로그인 필요')
      return
    }
    setPhase('analyzing')
    setPendingPreview(null)
    setError(null)
    setCardCollapsed(false)

    const taskId = taskLog?.startTask?.(`"${project.name}" 셀 분석 중…`)
    try {
      const snap = await getDocs(collection(db, 'projects', project.id, 'cells'))
      const cellsData = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const classification = classifyCells(cellsData, { minGroupSize: 50 })
      taskLog?.succeedTask?.(taskId, `${cellsData.length}개 분석 완료`)
      setPendingPreview({ project, cells: cellsData, classification })
      setPhase('preview')
    } catch (e) {
      taskLog?.failTask?.(taskId, `분석 실패: ${e.message}`)
      setError(e.message)
      setPhase('error')
    }
  }

  // ─────────────────────────────────────
  // 미리보기에서 "실행" 클릭 → 작업 등록
  // ─────────────────────────────────────
  const confirmAndStart = () => {
    if (!pendingPreview) return
    const { userId, projects } = runtimeRef.current
    const { project, classification } = pendingPreview

    // 그룹별 새 프로젝트 정보 미리 결정
    const usedPrefixes = new Set(projects.map((p) => p.prefix).filter(Boolean))
    const usedNames = new Set(projects.map((p) => p.name).filter(Boolean))

    const plannedGroups = classification.groups.map((g) => {
      const info = generateGroupProjectInfo(g, project.name, usedPrefixes, usedNames)
      usedPrefixes.add(info.prefix)
      usedNames.add(info.name)
      return {
        categoryId: g.id,
        label: g.label,
        prefix: g.prefix,
        newProjectName: info.name,
        newPrefix: info.prefix,
        cellIds: g.cells.map((c) => c.id),
        createdProjectId: null,
        status: 'pending',
        error: null,
      }
    })

    const job = {
      id: generateJobId(),
      userId,
      sourceProjectId: project.id,
      sourceProjectName: project.name,
      plannedGroups,
      currentGroupIndex: 0,
      status: 'running',
      startedAt: Date.now(),
      resumedFromInterrupt: false,
    }

    enqueueJob(job)
    setPendingPreview(null)
    setCurrentJob(getCurrentJob())
    setQueue(getQueue())

    if (!runningRef.current) {
      tryRunCurrent()
    }
  }

  const cancelPreview = () => {
    setPendingPreview(null)
    setPhase('idle')
  }

  // ─────────────────────────────────────
  // 현재 작업 실행 — 그룹 순차 처리
  // ─────────────────────────────────────
  const tryRunCurrent = async () => {
    if (runningRef.current) return
    let job = getCurrentJob()
    if (!job) return

    const { userId, taskLog } = runtimeRef.current
    if (!userId) {
      console.warn('자동 분류 실행 보류: 로그인 정보 없음')
      return
    }

    runningRef.current = true
    cancelRequestedRef.current = false
    setPhase('running')
    setError(null)

    const taskId = taskLog?.startTask?.(
      `"${job.sourceProjectName}" 자동 분류 (${job.plannedGroups.length}개 그룹)`
    )

    try {
      for (let i = job.currentGroupIndex; i < job.plannedGroups.length; i++) {
        if (cancelRequestedRef.current) break

        const g = job.plannedGroups[i]
        if (g.status === 'done') continue

        setProgress({
          current: i,
          total: job.plannedGroups.length,
          label: `${g.label} 분리 중 (${g.cellIds.length}개)`,
        })

        // 셀 데이터 다시 로드
        const snap = await getDocs(
          collection(db, 'projects', job.sourceProjectId, 'cells')
        )
        const allCells = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        const cellIdSet = new Set(g.cellIds)
        const cellsToMove = allCells.filter((c) => cellIdSet.has(c.id))

        if (cellsToMove.length === 0) {
          // 이미 처리됐거나 삭제된 그룹
          updateCurrentJob((j) => {
            const groups = [...j.plannedGroups]
            groups[i] = { ...g, status: 'done' }
            return { ...j, plannedGroups: groups, currentGroupIndex: i + 1 }
          })
          job = getCurrentJob()
          continue
        }

        updateCurrentJob((j) => {
          const groups = [...j.plannedGroups]
          groups[i] = { ...g, status: 'running' }
          return { ...j, plannedGroups: groups, currentGroupIndex: i }
        })
        job = getCurrentJob()

        const result = await moveToCellsToNewProject({
          userId,
          srcProjectId: job.sourceProjectId,
          cells: cellsToMove,
          newProjectName: g.newProjectName,
          newProjectPrefix: g.newPrefix,
          onProgress: (p) => {
            setProgress({
              current: i,
              total: job.plannedGroups.length,
              label: `[${g.label}] ${p.label}`,
            })
          },
        })

        updateCurrentJob((j) => {
          const groups = [...j.plannedGroups]
          groups[i] = {
            ...g,
            status: 'done',
            createdProjectId: result.newProjectId,
          }
          return { ...j, plannedGroups: groups, currentGroupIndex: i + 1 }
        })
        job = getCurrentJob()
        // UI 갱신
        setCurrentJob(job)
      }

      if (cancelRequestedRef.current) {
        await rollbackCreatedProjects(job, taskId)
      } else {
        // 정상 완료
        const completed = job.plannedGroups.filter((g) => g.status === 'done').length
        const totalMoved = job.plannedGroups
          .filter((g) => g.status === 'done')
          .reduce((s, g) => s + g.cellIds.length, 0)
        taskLog?.succeedTask?.(
          taskId,
          `자동 분류 완료: ${completed}개 프로젝트, ${totalMoved}개 셀 이동`
        )
        setProgress({
          current: job.plannedGroups.length,
          total: job.plannedGroups.length,
          label: '완료',
        })
        setPhase('done')
        // 3초 후 자동 닫기 + 다음 큐
        setTimeout(() => finishAndAdvance(), 3000)
      }
    } catch (e) {
      taskLog?.failTask?.(taskId, `자동 분류 실패: ${e.message}`)
      setError(e.message)
      setPhase('error')
      // 그룹의 status를 failed로
      updateCurrentJob((j) => {
        const groups = [...j.plannedGroups]
        const idx = j.currentGroupIndex
        if (groups[idx]) groups[idx] = { ...groups[idx], status: 'failed', error: e.message }
        return { ...j, plannedGroups: groups }
      })
      setCurrentJob(getCurrentJob())
    } finally {
      runningRef.current = false
    }
  }

  // ─────────────────────────────────────
  // 취소·되돌리기
  // ─────────────────────────────────────
  const rollbackCreatedProjects = async (job, parentTaskId) => {
    const { taskLog } = runtimeRef.current
    setPhase('cancelling')
    const created = job.plannedGroups.filter(
      (g) => g.status === 'done' && g.createdProjectId
    )

    if (created.length === 0) {
      taskLog?.succeedTask?.(parentTaskId, '취소됨 (변경된 내용 없음)')
      finishAndAdvance()
      return
    }

    setProgress({ current: 0, total: created.length, label: '되돌리는 중…' })
    let merged = 0
    for (let i = 0; i < created.length; i++) {
      const g = created[i]
      setProgress({
        current: i,
        total: created.length,
        label: `${g.label} 되돌리는 중…`,
      })
      try {
        await mergeProjects({
          srcProjectId: g.createdProjectId,
          dstProjectId: job.sourceProjectId,
        })
        merged++
      } catch (e) {
        console.warn(`Rollback failed for ${g.newProjectName}:`, e.message)
      }
    }

    taskLog?.succeedTask?.(
      parentTaskId,
      `취소 완료: ${merged}개 프로젝트 원복됨`
    )
    finishAndAdvance()
  }

  // ─────────────────────────────────────
  // 종료 + 큐 다음 작업 진행
  // ─────────────────────────────────────
  const finishAndAdvance = () => {
    finishCurrentJob()
    const next = getCurrentJob()
    setCurrentJob(next)
    setQueue(getQueue())
    setProgress({ current: 0, total: 0, label: '' })
    setError(null)
    cancelRequestedRef.current = false
    runningRef.current = false

    if (next) {
      setPhase('running')
      setTimeout(() => tryRunCurrent(), 100)
    } else {
      setPhase('idle')
    }
  }

  const requestCancel = () => {
    if (!runningRef.current) {
      finishAndAdvance()
      return
    }
    cancelRequestedRef.current = true
  }

  const value = {
    setRuntime,
    currentJob,
    queue,
    progress,
    phase,
    pendingPreview,
    error,
    cardCollapsed,
    requestClassification,
    confirmAndStart,
    cancelPreview,
    requestCancel,
    setCardCollapsed,
    finishAndAdvance,
  }

  return (
    <AutoClassifyContext.Provider value={value}>
      {children}
    </AutoClassifyContext.Provider>
  )
}
