// 자동 분류 작업의 영구 저장소
// LocalStorage에 작업 큐와 진행 상태를 저장해서 새로고침 시 재개 가능하게 함
//
// 데이터 구조:
// {
//   currentJob: {
//     id: 'job_xxxxx',
//     userId: 'uid',
//     sourceProjectId: 'projectId',
//     sourceProjectName: 'plaza-emoji',
//     plannedGroups: [
//       {
//         categoryId: 'animal',
//         label: '동물',
//         prefix: '동',
//         newProjectName: 'plaza-emoji-동물',
//         newPrefix: '동',
//         cellIds: ['cell1', 'cell2', ...],  // ID만 저장 (전체 데이터는 Firestore에서 로드)
//         createdProjectId: null | 'newProjectId', // 완료된 그룹은 만들어진 프로젝트 id
//         status: 'pending' | 'running' | 'done' | 'failed',
//         error: null | 'message',
//       },
//       ...
//     ],
//     currentGroupIndex: 0,
//     status: 'running' | 'paused' | 'cancelling' | 'done',
//     startedAt: timestamp,
//     resumedFromInterrupt: false, // 새로고침 후 재개됐는지
//   },
//   queue: [ /* 같은 형태의 job들 */ ],
//   createdProjectIds: ['newProjectId1', 'newProjectId2'], // 취소 시 원복용
// }

const STORAGE_KEY = 'prompt-cabinet/auto-classify-state'

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { currentJob: null, queue: [] }
    return JSON.parse(raw)
  } catch (e) {
    console.warn('자동 분류 상태 읽기 실패:', e)
    return { currentJob: null, queue: [] }
  }
}

function write(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('자동 분류 상태 저장 실패:', e)
  }
}

export function getState() {
  return read()
}

export function getCurrentJob() {
  return read().currentJob
}

export function getQueue() {
  return read().queue
}

// 새 작업을 currentJob으로 설정 (currentJob이 없을 때만)
// 이미 있으면 queue에 추가
export function enqueueJob(job) {
  const state = read()
  if (!state.currentJob) {
    state.currentJob = job
  } else {
    state.queue.push(job)
  }
  write(state)
  return state
}

// currentJob 업데이트 (그룹 진행 상태 갱신 등)
export function updateCurrentJob(updater) {
  const state = read()
  if (!state.currentJob) return state
  state.currentJob = typeof updater === 'function' ? updater(state.currentJob) : { ...state.currentJob, ...updater }
  write(state)
  return state
}

// currentJob 종료 + queue에서 다음 작업 꺼내기
export function finishCurrentJob() {
  const state = read()
  state.currentJob = state.queue.shift() || null
  if (state.currentJob) {
    state.currentJob.status = 'running'
    state.currentJob.resumedFromInterrupt = false
  }
  write(state)
  return state
}

// 모든 진행 중 작업 취소 + queue도 비우기 (전체 클리어)
export function clearAll() {
  write({ currentJob: null, queue: [] })
}

// queue에서 특정 작업 제거
export function removeFromQueue(jobId) {
  const state = read()
  state.queue = state.queue.filter((j) => j.id !== jobId)
  write(state)
  return state
}

export function generateJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
