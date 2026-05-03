// 셀 이동, 프로젝트 합치기, 접두어 변경의 핵심 로직
// Firestore batch 500 제한 고려, 진행률 보고

import {
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'

const BATCH_SIZE = 400 // Firestore 한도(500)보다 여유있게

/**
 * Firestore에 쓸 객체에서 undefined 필드 제거.
 * (Firebase JS SDK는 ignoreUndefinedProperties 옵션 없으면 undefined를 거부함)
 */
function stripUndefined(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

/**
 * N개 셀을 srcProjectId에서 dstProjectId로 이동.
 * - 대상 프로젝트의 nextNumber를 트랜잭션으로 안전하게 증가
 * - 각 셀에 새 식별어 할당
 * - 원본의 식별어 정보는 originalIdentifier 필드로 보존
 *
 * @param {Object} params
 * @param {string} params.srcProjectId
 * @param {string} params.dstProjectId
 * @param {Array<{id, identifier}>} params.cells - 이동할 셀들
 * @param {(progress: {current, total, label}) => void} [params.onProgress]
 * @returns {Promise<{moved: number, mapping: Array<{from, to}>}>}
 */
export async function moveCellsToProject({
  srcProjectId,
  dstProjectId,
  cells,
  onProgress,
}) {
  if (!cells || cells.length === 0) {
    return { moved: 0, mapping: [] }
  }
  if (srcProjectId === dstProjectId) {
    throw new Error('같은 프로젝트로는 이동할 수 없습니다')
  }

  onProgress?.({ current: 0, total: cells.length, label: '식별어 할당 중…' })

  // 1. 대상 프로젝트의 nextNumber를 cells.length만큼 한 번에 증가
  const dstProjectRef = doc(db, 'projects', dstProjectId)
  const srcProjectRef = doc(db, 'projects', srcProjectId)

  const { startNumber, dstPrefix, srcName } = await runTransaction(
    db,
    async (tx) => {
      const dstSnap = await tx.get(dstProjectRef)
      const srcSnap = await tx.get(srcProjectRef)
      if (!dstSnap.exists()) throw new Error('대상 프로젝트를 찾을 수 없습니다')
      if (!srcSnap.exists()) throw new Error('원본 프로젝트를 찾을 수 없습니다')

      const dstData = dstSnap.data()
      const srcData = srcSnap.data()

      const startNumber = dstData.nextNumber ?? (dstData.cellCount ?? 0) + 1

      tx.update(dstProjectRef, {
        nextNumber: startNumber + cells.length,
        cellCount: (dstData.cellCount ?? 0) + cells.length,
      })
      tx.update(srcProjectRef, {
        cellCount: Math.max(0, (srcData.cellCount ?? 0) - cells.length),
        // nextNumber는 줄이지 않음 (원래 자리 비워둠 = 안전)
      })

      return {
        startNumber,
        dstPrefix: dstData.prefix,
        srcName: srcData.name,
      }
    }
  )

  // 2. 셀 문서를 새 프로젝트의 cells 서브컬렉션으로 이동
  // Firestore 서브컬렉션은 직접 이동이 불가하므로 → 새 위치에 create + 원본 delete
  const mapping = []
  let processed = 0

  for (let chunkStart = 0; chunkStart < cells.length; chunkStart += BATCH_SIZE) {
    const chunk = cells.slice(chunkStart, chunkStart + BATCH_SIZE)
    const batch = writeBatch(db)

    for (let i = 0; i < chunk.length; i++) {
      const cell = chunk[i]
      const newNumber = startNumber + chunkStart + i
      const newIdentifier = `${dstPrefix}${String(newNumber).padStart(2, '0')}`

      // ⚠️ 핵심 fix: id를 객체에서 진짜로 제거 (구조 분해)
      // 기존 `id: undefined` 패턴은 Firebase가 거부함 (ignoreUndefinedProperties 옵션 안 켰을 때)
      // eslint-disable-next-line no-unused-vars
      const { id: _omit, ...cellRest } = cell
      const cleanCellData = stripUndefined(cellRest)

      // 새 위치에 셀 생성
      const newCellRef = doc(collection(db, 'projects', dstProjectId, 'cells'))
      batch.set(newCellRef, {
        ...cleanCellData,
        prefix: dstPrefix,
        number: newNumber,
        identifier: newIdentifier,
        originalIdentifier: cell.identifier ?? null,
        originalProjectName: srcName ?? null,
        movedAt: serverTimestamp(),
      })

      // 원본 셀 삭제
      const oldCellRef = doc(db, 'projects', srcProjectId, 'cells', cell.id)
      batch.delete(oldCellRef)

      mapping.push({ from: cell.identifier, to: newIdentifier })
    }

    await batch.commit()
    processed += chunk.length
    onProgress?.({
      current: processed,
      total: cells.length,
      label: `이동 중… (${processed}/${cells.length})`,
    })
  }

  return { moved: processed, mapping }
}

/**
 * 새 프로젝트를 만들고 셀들을 그곳으로 이동.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.srcProjectId
 * @param {Array<{id, identifier}>} params.cells
 * @param {string} params.newProjectName
 * @param {string} params.newProjectPrefix
 * @param {Function} [params.onProgress]
 * @returns {Promise<{newProjectId: string, moved: number, mapping: Array}>}
 */
export async function moveToCellsToNewProject({
  userId,
  srcProjectId,
  cells,
  newProjectName,
  newProjectPrefix,
  onProgress,
}) {
  if (!newProjectName?.trim() || !newProjectPrefix?.trim()) {
    throw new Error('새 프로젝트 이름과 접두어가 필요합니다')
  }

  onProgress?.({ current: 0, total: cells.length, label: '새 프로젝트 생성 중…' })

  // 새 프로젝트 생성
  const newProjectRef = doc(collection(db, 'projects'))
  const newProjectId = newProjectRef.id

  await runTransaction(db, async (tx) => {
    tx.set(newProjectRef, {
      name: newProjectName.trim(),
      prefix: newProjectPrefix.trim(),
      ownerId: userId,
      cellCount: 0,
      nextNumber: 1,
      createdAt: serverTimestamp(),
    })
  })

  // 그 다음 셀들을 이동
  const result = await moveCellsToProject({
    srcProjectId,
    dstProjectId: newProjectId,
    cells,
    onProgress,
  })

  return {
    newProjectId,
    moved: result.moved,
    mapping: result.mapping,
  }
}

/**
 * 한 프로젝트의 모든 셀을 다른 프로젝트로 합치고, 원본 프로젝트 삭제.
 *
 * @param {Object} params
 * @param {string} params.srcProjectId
 * @param {string} params.dstProjectId
 * @param {Function} [params.onProgress]
 */
export async function mergeProjects({ srcProjectId, dstProjectId, onProgress }) {
  if (srcProjectId === dstProjectId) {
    throw new Error('같은 프로젝트끼리는 합칠 수 없습니다')
  }

  onProgress?.({ current: 0, total: 100, label: '셀 목록 가져오는 중…' })

  // 모든 셀 가져오기
  const cellsSnap = await getDocs(collection(db, 'projects', srcProjectId, 'cells'))
  const cells = cellsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  if (cells.length === 0) {
    // 빈 프로젝트면 그냥 삭제
    const batch = writeBatch(db)
    batch.delete(doc(db, 'projects', srcProjectId))
    await batch.commit()
    return { moved: 0, mapping: [] }
  }

  // 이동
  const result = await moveCellsToProject({
    srcProjectId,
    dstProjectId,
    cells,
    onProgress,
  })

  // 원본 프로젝트 삭제 (모든 셀이 이동된 후)
  onProgress?.({
    current: result.moved,
    total: result.moved,
    label: '원본 프로젝트 삭제 중…',
  })
  const finalBatch = writeBatch(db)
  finalBatch.delete(doc(db, 'projects', srcProjectId))
  await finalBatch.commit()

  return result
}

/**
 * 프로젝트의 접두어를 변경하고 모든 셀의 식별어를 업데이트.
 *
 * @param {Object} params
 * @param {string} params.projectId
 * @param {string} params.newPrefix
 * @param {Function} [params.onProgress]
 */
export async function changeProjectPrefix({ projectId, newPrefix, onProgress }) {
  if (!newPrefix?.trim()) {
    throw new Error('새 접두어가 필요합니다')
  }
  const cleanPrefix = newPrefix.trim()

  onProgress?.({ current: 0, total: 100, label: '셀 목록 가져오는 중…' })

  const cellsSnap = await getDocs(collection(db, 'projects', projectId, 'cells'))
  const cells = cellsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  // 프로젝트 자체 접두어 업데이트
  const projectRef = doc(db, 'projects', projectId)

  if (cells.length === 0) {
    const batch = writeBatch(db)
    batch.update(projectRef, { prefix: cleanPrefix })
    await batch.commit()
    return { changed: 0 }
  }

  let processed = 0
  for (let chunkStart = 0; chunkStart < cells.length; chunkStart += BATCH_SIZE) {
    const chunk = cells.slice(chunkStart, chunkStart + BATCH_SIZE)
    const batch = writeBatch(db)

    // 첫 batch에 프로젝트 업데이트도 포함
    if (chunkStart === 0) {
      batch.update(projectRef, { prefix: cleanPrefix })
    }

    for (const cell of chunk) {
      const number = cell.number
      const padLen = cell.identifier?.match(/\d+$/)?.[0]?.length || 2
      const newIdentifier = `${cleanPrefix}${String(number).padStart(padLen, '0')}`
      const cellRef = doc(db, 'projects', projectId, 'cells', cell.id)
      batch.update(cellRef, {
        prefix: cleanPrefix,
        identifier: newIdentifier,
      })
    }

    await batch.commit()
    processed += chunk.length
    onProgress?.({
      current: processed,
      total: cells.length,
      label: `식별어 변경 중… (${processed}/${cells.length})`,
    })
  }

  return { changed: processed }
}
