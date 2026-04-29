// 이미지 업로드/처리 유틸리티

import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage'
import { arrayUnion, doc, updateDoc } from 'firebase/firestore'
import { db, storage } from '../firebase'

/**
 * Blob/File을 Firebase Storage에 업로드하고 셀에 추가한다.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.projectId
 * @param {string} params.cellId
 * @param {string} params.identifier - 셀 식별어 (예: '굿17')
 * @param {Blob|File} params.blob
 * @param {string} [params.mimeType] - blob.type 우선, 명시적으로 줄 수도 있음
 * @returns {Promise<{url: string, path: string, name: string}>}
 */
export async function uploadCellImage({
  userId,
  projectId,
  cellId,
  identifier,
  blob,
  mimeType,
}) {
  const type = mimeType || blob.type || 'image/png'
  const ext = mimeTypeToExt(type)
  const ts = Date.now()
  const filename = `${identifier}_${ts}.${ext}`
  const path = `users/${userId}/projects/${projectId}/cells/${cellId}/${filename}`

  const ref = storageRef(storage, path)
  await uploadBytes(ref, blob, { contentType: type })
  const url = await getDownloadURL(ref)

  // 셀 문서의 images 배열에 추가
  await updateDoc(doc(db, 'projects', projectId, 'cells', cellId), {
    images: arrayUnion({
      url,
      path,
      name: filename,
      uploadedAt: ts,
      mimeType: type,
    }),
  })

  return { url, path, name: filename }
}

/**
 * 셀의 특정 이미지를 Storage에서 삭제하고 Firestore에서도 제거한다.
 */
export async function deleteCellImage({ projectId, cellId, image, currentImages }) {
  // Storage 객체 삭제
  try {
    await deleteObject(storageRef(storage, image.path))
  } catch (e) {
    // 이미 삭제되었거나 권한 문제일 경우 로그만 남김
    console.warn('Storage delete failed (may already be gone):', e.message)
  }

  // Firestore의 images 배열에서 제거
  const filtered = currentImages.filter((i) => i.path !== image.path)
  await updateDoc(doc(db, 'projects', projectId, 'cells', cellId), {
    images: filtered,
  })
}

/**
 * 클립보드 이벤트에서 이미지 Blob 추출.
 * @returns {Blob|null}
 */
export function extractImageFromClipboard(event) {
  const items = event.clipboardData?.items
  if (!items) return null
  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      return item.getAsFile()
    }
  }
  return null
}

/**
 * MIME 타입을 확장자로 변환
 */
export function mimeTypeToExt(mimeType) {
  const map = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
  }
  return map[mimeType?.toLowerCase()] || 'png'
}

/**
 * 이미지를 캔버스로 리사이즈해서 새 Blob으로 반환.
 * 이번 단계에선 사용하지 않지만 Step 6에서 자동 축소에 쓸 예정.
 */
export async function resizeImage(blob, maxSize = 512, quality = 0.85) {
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    const { width, height } = computeFitSize(img.width, img.height, maxSize)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, width, height)
    return await canvasToBlob(canvas, 'image/jpeg', quality)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

function computeFitSize(w, h, max) {
  if (w <= max && h <= max) return { width: w, height: h }
  const ratio = w / h
  if (w >= h) {
    return { width: max, height: Math.round(max / ratio) }
  } else {
    return { width: Math.round(max * ratio), height: max }
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality)
  })
}
