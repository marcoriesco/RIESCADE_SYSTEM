import React, { useEffect } from 'react'
import { Dialog, Box, Flex, Heading, Text, Button, Progress } from '@radix-ui/themes'

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

  // Handle keyboard navigation for Cancel / Close
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = (e.key || '').toLowerCase()
      if (key === 'backspace' || key === 'escape' || key === 'z') {
        e.preventDefault()
        e.stopPropagation()
        handleCancel()
      } else if (finished && (key === 'enter' || key === 'x' || key === ' ')) {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
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
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) { if (finished) onClose(); else handleCancel(); } }}>
      <Dialog.Content 
        size="3"
        style={{
          maxWidth: '500px',
          width: '90%',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden'
        }}
      >
        <Flex direction="column" align="center" p="4" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Heading size="4" style={{ letterSpacing: '2px', color: 'var(--theme-color)', textTransform: 'uppercase' }}>
            {finished ? t('SCRAPING COMPLETED') : t('SEARCHING FOR MEDIA')}
          </Heading>
        </Flex>

        <Box p="5" style={{ flexGrow: 1 }}>
          {!finished ? (
            <Flex direction="column" gap="4">
              {/* Current Game Details */}
              <Flex direction="column" align="center" gap="1">
                <Text size="3" weight="bold" style={{ color: 'var(--theme-color)' }}>
                  {progress ? progress.systemName : t('PREPARING...')}
                </Text>
                <Text size="2" color="gray" style={{ textAlign: 'center', wordBreak: 'break-word' }}>
                  {progress ? progress.gameName : t('Loading gamelist...')}
                </Text>
              </Flex>

              {/* Progress Bar Container */}
              <Box>
                <Progress value={percent} style={{ height: '8px' }} />
                <Flex justify="end" mt="1">
                  <Text size="2" weight="bold" style={{ color: 'var(--theme-color)' }}>{percent}%</Text>
                </Flex>
              </Box>

              {/* Stats Grid */}
              <Flex gap="3" p="3" style={{ justifyContent: 'space-around', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                <Flex direction="column" align="center">
                  <Text size="1" color="gray" weight="bold">{t('TOTAL')}</Text>
                  <Text size="4" weight="bold">{progress ? progress.total : 0}</Text>
                </Flex>
                <Flex direction="column" align="center">
                  <Text size="1" color="green" weight="bold">{t('SUCCESS')}</Text>
                  <Text size="4" weight="bold" color="green">
                    {progress ? progress.successCount : 0}
                  </Text>
                </Flex>
                <Flex direction="column" align="center">
                  <Text size="1" color="red" weight="bold">{t('FAILURES')}</Text>
                  <Text size="4" weight="bold" color="red">
                    {progress ? progress.failCount : 0}
                  </Text>
                </Flex>
              </Flex>

              {/* Cancel hint */}
              <Flex direction="column" align="center" gap="2" mt="2">
                <Button color="red" variant="solid" onClick={handleCancel} style={{ cursor: 'pointer', minWidth: '120px', outline: '2px solid #fff' }}>
                  {t('CANCEL')}
                </Button>
                <Text size="1" color="gray">
                  {t('Press B or ESC to cancel')}
                </Text>
              </Flex>
            </Flex>
          ) : (
            <Flex direction="column" gap="4">
              {/* Finished View */}
              <Flex direction="column" align="center" gap="2" p="3">
                {finishReason ? (
                  <Text size="3" style={{ textAlign: 'center' }}>{finishReason}</Text>
                ) : (
                  <Text size="3" color="green" weight="bold" style={{ textAlign: 'center' }}>
                    {t('Scraping completed successfully!')}
                  </Text>
                )}
                <Text size="2">
                  {t('Games updated:')} <strong style={{ color: 'var(--theme-color)' }}>{scrapedCount}</strong>
                </Text>
              </Flex>

              <Flex direction="column" align="center" gap="2" mt="2">
                <Button onClick={onClose} style={{ cursor: 'pointer', minWidth: '120px', outline: '2px solid #fff' }}>
                  {t('OK')}
                </Button>
                <Text size="1" color="gray">
                  {t('Press A or ENTER to close')}
                </Text>
              </Flex>
            </Flex>
          )}
        </Box>
      </Dialog.Content>
    </Dialog.Root>
  )
}
