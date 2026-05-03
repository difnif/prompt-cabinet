import { createContext, useCallback, useContext, useRef, useState } from 'react'
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
 * Firestore 셀 doc → 안전한 셀 객체로 변환.
 * - undefined 필드 모두 제거 (Firestore가 batch.set 시 거부함)
 * - id는 d.id로 강제 (data 안에 id:undefined가 섞여 있어도 안전)
 */
function sanitizeCell(d) {
  const data = d.data() || {}
  const out = {}
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && k !== 'id') out[k] = v
  }
  out.id = d.id
  return out
}

/**
 * 자동 분류 시스템 — 전역 상태 + 작업 실행기
 */
export function AutoClassifyProvider({ children }) {
  const [currentJob, setCurrentJob] = useState(getCurrentJob())
  const [queue, setQueue] = useState(getQueue())
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' })
  const [phase, setPhase] = useState('idle') // idle|analyzing|preview|running|cancelling|done|error
  const [pendingPreview, setPendingPreview] = useState(null)
  const [error, setError] = useState(null)
  const [cardCollapsed, setCardCollapsed] = useState(false)

  const runtimeRef = useRef({ userId: null, projects: [], taskLog: null })
  const runningRef = useRef(false)
  const cancelRequestedRef = useRef(false)
  const resumedOnceRef = useRef(false)

  const setRuntime = useCallback((rt) => {
    runtimeRef.current = { ...runtimeRef.current, ...rt }

    // 첫 userId 들어오는 시점에 미완료 작업 자동 재개
    if (rt.userId && !resumedOnceRef.current) {
      resumedOnceRef.current = true
      const job = getCurrentJob()
      if (!job) return
      if (job.userId !== rt.userId) return
      if (runningRef.current) return

      // ⚠️ 가드: 이전에 실패한 그룹이 있으면 자동 재개 안 함
      // (예: WriteBatch 에러로 끝난 작업이 새로고침마다 또 같은 에러 → 무한 루프 방지)
      const hasFailed = job.plannedGroups.some((g) => g.status === 'failed')
      if (hasFailed) {
        setCurrentJob(job)
        setPhase('error')
        setError(
          '이전 작업이 오류로 중단됐어요. "닫기"를 눌러 정리한 후 다시 시도해 주세요.'
        )
        const tl = runtimeRef.current.taskLog
        if (tl?.startTask && tl?.failTask) {
          const t = tl.startTask('이전 자동 분류 작업이 오류 상태')
          tl.failTask(t, '자동 분류 카드에서 닫기를 누르세요')
        }
        return
      }

      // 정상 재개
      const tl = runtimeRef.current.taskLog
      if (tl?.startTask && tl?.succeedTask) {
        const t = tl.startTask('이전 작업 이어서 진행')
        tl.succeedTask(t, `"${job.sourceProjectName}" 자동 분류 재개`)
      }
      updateCurrentJob({ resumedFromInterrupt: true })
      setCurrentJob(getCurrentJob())
      setTimeout(() => tryRunCurrent(), 300)
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
      const cellsData = snap.docs.map(sanitizeCell)
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

    const usedPrefixes = new Set(projects.map((p) => p.prefix).filter(Boolean))
    const usedNames = new Set(projects.map((p) => p.name).filter(Boolean))

    const plannedGroups = classification.groups.map((g) => {
      const info = generateGroupProjectInfo(g, project.name, usedPrefixes, usedNames)
      usedPrefixes.add(info.prefix)
      usedNames.add(info.name)
      // 안전하게 cellId 추출 (undefined 제거)
      const cellIds = g.cells.map((c) => c.id).filter((id) => typeof id === 'string')
      return {
        categoryId: g.id,
        label: g.label,
        prefix: g.prefix,
        newProjectName: info.name,
        newPrefix: info.prefix,
        cellIds,
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

        // 셀 데이터 다시 로드 + sanitize
        const snap = await getDocs(
          collection(db, 'projects', job.sourceProjectId, 'cells')
        )
        const allCells = snap.docs.map(sanitizeCell)
        const cellIdSet = new Set(g.cellIds)
        const cellsToMove = allCells.filter((c) => cellIdSet.has(c.id))

        if (cellsToMove.length === 0) {
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
        setCurrentJob(job)

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
        setCurrentJob(job)
      }

      if (cancelRequestedRef.current) {
        await rollbackCreatedProjects(job, taskId)
      } else {
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
        setTimeout(() => finishAndAdvance(), 3000)
      }
    } catch (e) {
      taskLog?.failTask?.(taskId, `자동 분류 실패: ${e.message}`)
      setError(e.message)
      setPhase('error')
      updateCurrentJob((j) => {
        const groups = [...j.plannedGroups]
        const idx = j.currentGroupIndex
        if (groups[idx])
          groups[idx] = { ...groups[idx], status: 'failed', error: e.message }
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

    taskLog?.succeedTask?.(parentTaskId, `취소 완료: ${merged}개 프로젝트 원복됨`)
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
