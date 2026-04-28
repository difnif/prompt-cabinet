import { useEffect, useState } from 'react'

const STORAGE_KEY = 'prompt-cabinet:settings:v1'

const DEFAULT_SETTINGS = {
  // 정렬
  sortBy: 'identifier', // 'identifier' | 'rating-desc' | 'rating-asc' | 'recent' | 'unrated-first'

  // 다운로드 (Step 6에서 사용)
  textDownloadFormat: 'single-txt', // 'single-txt' | 'individual' | 'both'
  imageThumbSize: 512, // 자동 축소 크기

  // UI
  showRatingDots: true,
  showImageCountBadge: true,
}

function readSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function writeSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // 무시
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(() => readSettings())

  useEffect(() => {
    writeSettings(settings)
  }, [settings])

  const update = (patch) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }

  const reset = () => setSettings({ ...DEFAULT_SETTINGS })

  return { settings, update, reset }
}

export { DEFAULT_SETTINGS }
