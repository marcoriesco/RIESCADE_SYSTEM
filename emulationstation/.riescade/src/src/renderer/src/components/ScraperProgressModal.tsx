import React, { useEffect } from 'react'

interface ScraperProgressModalProps {
  isOpen: boolean
  onClose: () => void
  t: (key: string) => string
}

export const ScraperProgressModal: React.FC<ScraperProgressModalProps> = ({ isOpen, onClose, t }) => {
  const [progress, setProgress] = React.useState<{
    systemName: string
    gameName: string
    current: number
    total: number
    successCount: number
    failCount: number
  } | null>(null)

  const [finished, setFinished] = React.useState<boolean>(false)
  const [finishReason, setFinishReason] = React.useState<string>('')
  const [scrapedCount, setScrapedCount] = React.useState<number>(0)

  useEffect(() => {
    if (!isOpen) return

    // Reset state when opening
    setProgress(null)
    setFinished(false)
    setFinishReason('')
    setScrapedCount(0)

    // Listen to progress events from Main process
    const removeProgress = window.api.on('scrape-progress', (_, data: any) => {
      setProgress(data)
    })

    const removeFinished = window.api.on('scrape-finished', (_, data: any) => {
      setFinished(true)
      setFinishReason(data.reason || '')
      setScrapedCount(data.count || 0)
    })

    // Start scraper in main process
    window.api.startScrape()

    return () => {
      removeProgress()
      removeFinished()
    }
  }, [isOpen])

  // Handle keyboard navigation for Cancel
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' || e.key === 'Escape') {
        e.preventDefault()
        handleCancel()
      } else if (finished && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, finished, onClose])

  const handleCancel = () => {
    window.api.cancelScrape()
    onClose()
  }

  if (!isOpen) return null

  // Calculate percentage
  const percent = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0

  return (
    <div style={styles.overlay}>
      <div style={styles.modalCard}>
        {/* Decorative Header Border */}
        <div style={styles.glowBorder}></div>

        <h2 style={styles.title}>
          {finished ? t('SCRAPING COMPLETED') : t('BUSCANDO MÍDIAS')}
        </h2>

        {!finished ? (
          <>
            {/* Current Game Details */}
            <div style={styles.detailsContainer}>
              <div style={styles.systemText}>
                {progress ? progress.systemName : t('PREPARANDO...')}
              </div>
              <div style={styles.gameText}>
                {progress ? progress.gameName : t('Carregando lista de jogos...')}
              </div>
            </div>

            {/* Progress Bar Container */}
            <div style={styles.progressTrack}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${percent}%`
                }}
              />
            </div>
            <div style={styles.percentText}>{percent}%</div>

            {/* Stats Grid */}
            <div style={styles.statsGrid}>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>{t('TOTAL')}</span>
                <span style={styles.statVal}>{progress ? progress.total : 0}</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>{t('SUCESSO')}</span>
                <span style={{ ...styles.statVal, color: '#4ade80' }}>
                  {progress ? progress.successCount : 0}
                </span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>{t('FALHAS')}</span>
                <span style={{ ...styles.statVal, color: '#f87171' }}>
                  {progress ? progress.failCount : 0}
                </span>
              </div>
            </div>

            {/* Cancel hint */}
            <div style={styles.cancelContainer} onClick={handleCancel}>
              <button style={styles.cancelBtn}>
                {t('CANCELAR')}
              </button>
              <div style={styles.hint}>
                {t('Pressione B ou ESC para cancelar')}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Finished View */}
            <div style={styles.finishedDetails}>
              {finishReason ? (
                <div style={styles.reasonText}>{finishReason}</div>
              ) : (
                <div style={styles.successMessage}>
                  {t('Scraping finalizado com sucesso!')}
                </div>
              )}
              <div style={styles.finalCount}>
                {t('Jogos atualizados:')} <strong style={{ color: 'var(--theme-color, #f042b0)' }}>{scrapedCount}</strong>
              </div>
            </div>

            <div style={styles.closeContainer} onClick={onClose}>
              <button style={styles.closeBtn}>
                {t('OK')}
              </button>
              <div style={styles.hint}>
                {t('Pressione A ou ENTER para fechar')}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20000,
    fontFamily: '"Outfit", "Inter", sans-serif'
  },
  modalCard: {
    background: 'rgba(20, 20, 20, 0.9)',
    border: '2px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '20px',
    width: '500px',
    padding: '40px',
    boxShadow: '0 30px 60px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    overflow: 'hidden'
  },
  glowBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: 'linear-gradient(to right, var(--theme-color, #f042b0), #9333ea)',
    boxShadow: '0 2px 20px var(--theme-color, #f042b0)'
  },
  title: {
    color: '#fff',
    fontSize: '1.4rem',
    fontWeight: 800,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    marginBottom: '30px',
    marginTop: '0'
  },
  detailsContainer: {
    width: '100%',
    textAlign: 'center',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    padding: '20px 15px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    marginBottom: '25px'
  },
  systemText: {
    color: 'var(--theme-color, #f042b0)',
    fontSize: '0.8rem',
    fontWeight: 800,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    marginBottom: '6px'
  },
  gameText: {
    color: '#fff',
    fontSize: '1.1rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    width: '100%'
  },
  progressTrack: {
    width: '100%',
    height: '10px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '5px',
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.03)',
    marginBottom: '10px'
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(to right, var(--theme-color, #f042b0), #a855f7)',
    borderRadius: '5px',
    boxShadow: '0 0 10px var(--theme-color, #f042b0)',
    transition: 'width 0.15s ease'
  },
  percentText: {
    color: '#fff',
    fontSize: '1.1rem',
    fontWeight: 800,
    marginBottom: '25px'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    width: '100%',
    gap: '15px',
    marginBottom: '35px'
  },
  statItem: {
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.03)',
    borderRadius: '10px',
    padding: '12px 10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  statLabel: {
    fontSize: '0.65rem',
    color: '#888',
    fontWeight: 800,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    marginBottom: '4px'
  },
  statVal: {
    fontSize: '1.2rem',
    color: '#fff',
    fontWeight: 800
  },
  cancelContainer: {
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    width: '100%'
  },
  cancelBtn: {
    background: 'rgba(248, 113, 113, 0.1)',
    border: '2px solid #f87171',
    color: '#f87171',
    borderRadius: '30px',
    padding: '12px 40px',
    fontSize: '0.9rem',
    fontWeight: 800,
    letterSpacing: '1.5px',
    cursor: 'pointer',
    width: '80%',
    transition: 'all 0.2s ease',
    textTransform: 'uppercase'
  },
  hint: {
    fontSize: '0.7rem',
    color: '#666',
    fontWeight: 600,
    letterSpacing: '0.5px'
  },
  finishedDetails: {
    textAlign: 'center',
    width: '100%',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    padding: '30px 20px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    marginBottom: '35px'
  },
  successMessage: {
    fontSize: '1.15rem',
    color: '#4ade80',
    fontWeight: 700,
    marginBottom: '15px'
  },
  reasonText: {
    fontSize: '1.1rem',
    color: '#e2e8f0',
    fontWeight: 600,
    marginBottom: '15px'
  },
  finalCount: {
    fontSize: '1rem',
    color: '#fff',
    fontWeight: 500
  },
  closeContainer: {
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    width: '100%'
  },
  closeBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '2px solid var(--theme-color, #f042b0)',
    color: '#fff',
    borderRadius: '30px',
    padding: '12px 50px',
    fontSize: '0.9rem',
    fontWeight: 800,
    letterSpacing: '1.5px',
    cursor: 'pointer',
    width: '80%',
    transition: 'all 0.2s ease',
    textTransform: 'uppercase',
    boxShadow: '0 0 10px rgba(240, 66, 176, 0.2)'
  }
}
