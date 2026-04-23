import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
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
    const q = query(
      collection(db, 'projects'),
      where('ownerId', '==', userId)
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        // 클라이언트 측 정렬 (createdAt asc, 없으면 맨 뒤)
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
      createdAt: serverTimestamp(),
    })
    return ref.id
  }

  const updateProject = async (id, patch) => {
    await updateDoc(doc(db, 'projects', id), patch)
  }

  const deleteProject = async (id) => {
    await deleteDoc(doc(db, 'projects', id))
  }

  return { projects, loading, error, createProject, updateProject, deleteProject }
}
