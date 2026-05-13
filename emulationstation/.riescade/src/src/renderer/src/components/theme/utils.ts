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
    return resolved
  }

  // Ensure it's a file:/// URL for Electron if it's an absolute path
  if (resolved.match(/^[a-zA-Z]:[/\\]/) || resolved.startsWith('/') || resolved.startsWith('\\')) {
    const normalized = resolved.replace(/\\/g, '/')
    if (normalized.match(/^[a-zA-Z]:/)) {
      return `file:///${normalized}`
    }
    return `file://${normalized}`
  }

  return resolved
}
