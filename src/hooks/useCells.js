import { useEffect, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'

export function useCells(projectId) {
  const [cells, setCells] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!projectId) {
      setCells([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(collection(db, 'projects', projectId, 'cells'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        // 번호 오름차순
        list.sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
        setCells(list)
        setLoading(false)
      },
      (err) => {
        console.error('useCells query error:', err)
        setError(err.message)
        setLoading(false)
      }
    )
    return unsub
  }, [projectId])

  const deleteCell = async (projectId, cellId) => {
    await deleteDoc(doc(db, 'projects', projectId, 'cells', cellId))
  }

  const updateCell = async (projectId, cellId, patch) => {
    await updateDoc(doc(db, 'projects', projectId, 'cells', cellId), patch)
  }

  return { cells, loading, error, deleteCell, updateCell }
}
