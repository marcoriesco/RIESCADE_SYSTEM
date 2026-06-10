const escapeFileUrl = (url: string): string => {
  if (url.startsWith('file://')) {
    const [pathPart, ...queryParts] = url.split('?')
    return [pathPart.replace(/#/g, '%23'), ...queryParts].join('?')
  }
  return url
}

/**
 * Resolves a path to a file:// URL suitable for Electron rendering.
 * Handles variables, relative paths, and Windows absolute paths.
 */
export const resolvePath = (path: string | undefined, data?: any): string => {
  if (!path) return ''

  // Resolve variables like ${system.theme}
  let resolved = path.replace(/\${(.*?)}/g, (_, name) => {
    return data?.[name] || ''
  })

  // Resolve dynamic bindings like {system:name}
  resolved = resolved.replace(/{(.*?)}/g, (_, name) => {
    return data?.[name] !== undefined ? data[name] : ''
  })

  // If it's already a file:// or http URL, return it
  if (resolved.startsWith('file://') || resolved.startsWith('http')) {
    let url = resolved
    const mediaRev = data?.['global:mediaRevision']
    if (mediaRev !== undefined && mediaRev !== null) {
      if (url.startsWith('file://') && !url.includes('themeRev=') && !url.includes('rev=')) {
        url = url.includes('?') ? `${url}&rev=${mediaRev}` : `${url}?rev=${mediaRev}`
      }
    }
    return escapeFileUrl(url)
  }

  // Ensure it's a file:/// URL for Electron if it's an absolute path
  let url = resolved
  if (resolved.match(/^[a-zA-Z]:[/\\]/) || resolved.startsWith('/') || resolved.startsWith('\\')) {
    const normalized = resolved.replace(/\\/g, '/')
    if (normalized.match(/^[a-zA-Z]:/)) {
      url = `file:///${normalized}`
    } else {
      url = `file://${normalized}`
    }
  }

  const mediaRev = data?.['global:mediaRevision']
  if (mediaRev !== undefined && mediaRev !== null) {
    if (url.startsWith('file://') && !url.includes('themeRev=') && !url.includes('rev=')) {
      url = url.includes('?') ? `${url}&rev=${mediaRev}` : `${url}?rev=${mediaRev}`
    }
  }

  return escapeFileUrl(url)
}

/**
 * Calculates the next index in a 2D grid/layout using spatial navigation.
 * Evaluates the bounding rectangles of all items and selects the closest one
 * in the requested direction.
 */
export const getNextGridIndex = (
  containerSelector: string,
  itemSelector: string,
  selectedIndex: number,
  direction: 'up' | 'down' | 'left' | 'right'
): number => {
  const container = document.querySelector(containerSelector)
  if (!container) return selectedIndex
  const items = Array.from(container.querySelectorAll(itemSelector))
  if (items.length === 0) return selectedIndex

  const selectedEl = items[selectedIndex] as HTMLElement
  if (!selectedEl) return selectedIndex

  const rectSelected = selectedEl.getBoundingClientRect()
  const cxSelected = rectSelected.left + rectSelected.width / 2
  const cySelected = rectSelected.top + rectSelected.height / 2

  let bestIndex = selectedIndex
  let bestScore = Infinity

  items.forEach((el, index) => {
    if (index === selectedIndex) return

    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2

    const dx = cx - cxSelected
    const dy = cy - cySelected

    let isCandidate = false
    let score = Infinity

    // We penalize the orthogonal axis movement to stay aligned as much as possible
    if (direction === 'left' && dx < -1) {
      isCandidate = true
      score = Math.abs(dx) + Math.abs(dy) * 4
    } else if (direction === 'right' && dx > 1) {
      isCandidate = true
      score = Math.abs(dx) + Math.abs(dy) * 4
    } else if (direction === 'up' && dy < -1) {
      isCandidate = true
      score = Math.abs(dy) + Math.abs(dx) * 4
    } else if (direction === 'down' && dy > 1) {
      isCandidate = true
      score = Math.abs(dy) + Math.abs(dx) * 4
    }

    if (isCandidate && score < bestScore) {
      bestScore = score
      bestIndex = index
    }
  })

  return bestIndex
}

