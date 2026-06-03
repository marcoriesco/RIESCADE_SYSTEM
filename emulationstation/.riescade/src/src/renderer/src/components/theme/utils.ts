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
