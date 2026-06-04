import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'fs'
import { getRiescadePath } from './paths'
import { SettingsParser } from '../parsers/SettingsParser'

let logFile: string | null = null

function getLogFile(): string {
  if (logFile) return logFile
  const logsDir = join(getRiescadePath(), 'logs')
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true })
  }
  logFile = join(logsDir, 'es_log.txt')
  // Initialize log file (clear on startup)
  try {
    writeFileSync(logFile, `--- RIESCADE Log Started at ${new Date().toISOString()} ---\n`, 'utf-8')
  } catch (err) {
    console.error('Failed to initialize log file:', err)
  }
  return logFile
}

export function setupLogger() {
  const originalLog = console.log
  const originalWarn = console.warn
  const originalError = console.error

  const getLogLevel = (): string => {
    try {
      const parser = new SettingsParser()
      return parser.getSetting('LogLevel', 'string') || ''
    } catch {
      return ''
    }
  }

  const shouldLog = (level: 'info' | 'warn' | 'error' | 'debug'): boolean => {
    const configLevel = getLogLevel().toLowerCase()
    if (configLevel === 'disabled') return false
    if (configLevel === 'error') return level === 'error'
    if (configLevel === 'warning') return level === 'error' || level === 'warn'
    // debug or default/empty logs everything
    return true
  }

  const writeLog = (level: string, args: any[]) => {
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try { return JSON.stringify(arg) } catch { return String(arg) }
      }
      return String(arg)
    }).join(' ')

    const formatted = `[${new Date().toLocaleTimeString()}] [${level.toUpperCase()}] ${message}\n`
    try {
      appendFileSync(getLogFile(), formatted, 'utf-8')
    } catch (e) {
      originalError('Failed to write to log file:', e)
    }
  }

  console.log = (...args) => {
    if (shouldLog('info')) {
      originalLog(...args)
      writeLog('info', args)
    }
  }

  console.warn = (...args) => {
    if (shouldLog('warn')) {
      originalWarn(...args)
      writeLog('warn', args)
    }
  }

  console.error = (...args) => {
    if (shouldLog('error')) {
      originalError(...args)
      writeLog('error', args)
    }
  }

  // Also setup a debugger function or log debug
  console.debug = (...args) => {
    if (shouldLog('debug')) {
      originalLog('[DEBUG]', ...args)
      writeLog('debug', args)
    }
  }
}
