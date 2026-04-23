import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  getDocs,
} from 'firebase/firestore'
import { db } from '../firebase'

export function useProjects(userId) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) {
      setProjects([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(collection(db, 'projects'), where('ownerId', '==', userId))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => {
          const at = a.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER
          const bt = b.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER
          return at - bt
        })
        setProjects(list)
        setLoading(false)
      },
      (err) => {
        console.error('useProjects query error:', err)
        setError(err.message)
        setLoading(false)
      }
    )
    return unsub
  }, [userId])

  const createProject = async ({ name, prefix, ownerId }) => {
    if (!name?.trim() || !prefix?.trim()) {
      throw new Error('이름과 접두어가 필요합니다')
    }
    const ref = await addDoc(collection(db, 'projects'), {
      name: name.trim(),
      prefix: prefix.trim(),
      ownerId,
      cellCount: 0,
      nextNumber: 1,
      createdAt: serverTimestamp(),
    })
    return ref.id
  }

  const updateProject = async (id, patch) => {
    await updateDoc(doc(db, 'projects', id), patch)
  }

  const deleteProject = async (id) => {
    // 서브컬렉션 cells 먼저 삭제
    const cellsSnap = await getDocs(collection(db, 'projects', id, 'cells'))
    if (!cellsSnap.empty) {
      const batch = writeBatch(db)
      cellsSnap.docs.forEach((d) => batch.delete(d.ref))
      await batch.commit()
    }
    await deleteDoc(doc(db, 'projects', id))
  }

  /**
   * 프롬프트 배열을 받아 셀을 일괄 생성.
   * 트랜잭션으로 프로젝트의 nextNumber를 원자적으로 증가시키고
   * 각 셀에 순번을 부여한다.
   */
  const addCells = async (projectId, prompts) => {
    if (!prompts?.length) return []

    const projectRef = doc(db, 'projects', projectId)

    // 트랜잭션으로 시작 번호를 확정
    const { startNumber, prefix } = await runTransaction(db, async (tx) => {
      const snap = await tx.get(projectRef)
      if (!snap.exists()) throw new Error('프로젝트를 찾을 수 없습니다')
      const data = snap.data()
      const currentNext = data.nextNumber ?? (data.cellCount ?? 0) + 1
      tx.update(projectRef, {
        nextNumber: currentNext + prompts.length,
        cellCount: (data.cellCount ?? 0) + prompts.length,
      })
      return { startNumber: currentNext, prefix: data.prefix }
    })

    // 셀 문서들을 batch로 생성
    const batch = writeBatch(db)
    const createdIds = []
    prompts.forEach((text, idx) => {
      const number = startNumber + idx
      const cellRef = doc(collection(db, 'projects', projectId, 'cells'))
      batch.set(cellRef, {
        prefix,
        number,
        identifier: `${prefix}${String(number).padStart(2, '0')}`,
        prompt: text,
        images: [],
        rating: null,
        createdAt: serverTimestamp(),
      })
      createdIds.push(cellRef.id)
    })
    await batch.commit()
    return createdIds
  }

  return {
    projects,
    loading,
    error,
    createProject,
    updateProject,
    deleteProject,
    addCells,
  }
}
