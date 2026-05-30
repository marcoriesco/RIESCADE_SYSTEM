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
    <div className="scraper-progress-overlay">
      <div className="scraper-progress-card">
        {/* Decorative Header Border */}
        <div className="scraper-progress-glow"></div>

        <h2 className="scraper-progress-title">
          {finished ? t('SCRAPING COMPLETED') : t('SEARCHING FOR MEDIA')}
        </h2>

        {!finished ? (
          <>
            {/* Current Game Details */}
            <div className="scraper-progress-details">
              <div className="scraper-progress-system">
                {progress ? progress.systemName : t('PREPARANDO...')}
              </div>
              <div className="scraper-progress-game">
                {progress ? progress.gameName : t('Carregando lista de jogos...')}
              </div>
            </div>

            {/* Progress Bar Container */}
            <div className="scraper-progress-track">
              <div
                className="scraper-progress-fill"
                style={{
                  width: `${percent}%`
                }}
              />
            </div>
            <div className="scraper-progress-percent">{percent}%</div>

            {/* Stats Grid */}
            <div className="scraper-progress-grid">
              <div className="scraper-progress-item">
                <span className="scraper-progress-label">{t('TOTAL')}</span>
                <span className="scraper-progress-val">{progress ? progress.total : 0}</span>
              </div>
              <div className="scraper-progress-item">
                <span className="scraper-progress-label">{t('SUCESSO')}</span>
                <span className="scraper-progress-val success">
                  {progress ? progress.successCount : 0}
                </span>
              </div>
              <div className="scraper-progress-item">
                <span className="scraper-progress-label">{t('FALHAS')}</span>
                <span className="scraper-progress-val fail">
                  {progress ? progress.failCount : 0}
                </span>
              </div>
            </div>

            {/* Cancel hint */}
            <div className="scraper-progress-cancel" onClick={handleCancel}>
              <button className="scraper-progress-cancel-btn">
                {t('CANCELAR')}
              </button>
              <div className="scraper-progress-hint">
                {t('Pressione B ou ESC para cancelar')}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Finished View */}
            <div className="scraper-progress-finished">
              {finishReason ? (
                <div className="scraper-progress-reason">{finishReason}</div>
              ) : (
                <div className="scraper-progress-success-msg">
                  {t('Scraping finalizado com sucesso!')}
                </div>
              )}
              <div className="scraper-progress-final-count">
                {t('Jogos atualizados:')} <strong style={{ color: 'var(--theme-color, #f042b0)' }}>{scrapedCount}</strong>
              </div>
            </div>

            <div className="scraper-progress-close" onClick={onClose}>
              <button className="scraper-progress-close-btn">
                {t('OK')}
              </button>
              <div className="scraper-progress-hint">
                {t('Pressione A ou ENTER para fechar')}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

