import { useState, useEffect } from 'react'

export default function SetupProgress({ modelId, accountId, onComplete }) {
  const [progress, setProgress] = useState({
    fans: { current: 0, total: 0, done: false },
    chats: { current: 0, total: 0, done: false },
    vault: { current: 0, total: 0, done: false },
    currentStep: 'fans'
  })
  const [error, setError] = useState(null)

  useEffect(() => {
    if (modelId && accountId) {
      // Bloquear navegación durante setup
      const handleBeforeUnload = (e) => {
        e.preventDefault()
        e.returnValue = 'Setup in progress. Are you sure you want to leave?'
        return e.returnValue
      }

      window.addEventListener('beforeunload', handleBeforeUnload)
      
      startSetup()

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
      }
    }
  }, [modelId, accountId])

  const startSetup = async () => {
    try {
      // Step 1: Initial setup (first batch)
      await runInitialSetup()
      
      // Step 2: Complete fans
      await completeFans()
      
      // Step 3: Complete chats
      await completeChats()
      
      // Step 4: Complete vault
      await completeVault()
      
      // Done!
      if (onComplete) onComplete()
      
    } catch (err) {
      setError(err.message)
    }
  }

  const runInitialSetup = async () => {
    setProgress(prev => ({ ...prev, currentStep: 'initial' }))
    
    const response = await fetch('/api/onlyfans/setup-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId, accountId })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Setup failed')
    }

    // Update progress
    setProgress(prev => ({
      ...prev,
      fans: { current: data.totalFans || 0, total: 0, done: false },
      chats: { current: data.messagesSynced || 0, total: 0, done: false },
      currentStep: 'fans'
    }))
  }

  const completeFans = async () => {
    setProgress(prev => ({ ...prev, currentStep: 'fans' }))
    
    let hasMore = true
    let totalFans = 0
    let currentOffset = 0

    while (hasMore) {
      const response = await fetch('/api/onlyfans/sync-fans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          modelId, 
          accountId,
          offset: currentOffset 
        })
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.needsReauth) {
          throw new Error('Authentication failed. Please reconnect.')
        }
        throw new Error(data.message || 'Sync fans failed')
      }

      totalFans += data.synced || 0
      hasMore = data.hasMore || false
      currentOffset = data.nextOffset || (currentOffset + 20)

      console.log(`[Setup] Fans progress: ${totalFans} total, hasMore: ${hasMore}, nextOffset: ${currentOffset}`)

      setProgress(prev => ({
        ...prev,
        fans: { current: totalFans, total: 0, done: !hasMore }
      }))

      if (!hasMore) break
    }

    setProgress(prev => ({
      ...prev,
      fans: { ...prev.fans, done: true },
      currentStep: 'chats'
    }))
  }

  const completeChats = async () => {
    setProgress(prev => ({ ...prev, currentStep: 'chats' }))
    
    let hasMore = true
    let totalMessages = 0

    while (hasMore) {
      const response = await fetch('/api/onlyfans/sync-chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId, accountId })
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.needsReauth) {
          throw new Error('Authentication failed. Please reconnect.')
        }
        throw new Error(data.message || 'Sync chats failed')
      }

      totalMessages += data.syncedMessages || 0
      hasMore = data.hasMore || false

      setProgress(prev => ({
        ...prev,
        chats: { current: totalMessages, total: 0, done: !hasMore }
      }))

      if (!hasMore) break
    }

    setProgress(prev => ({
      ...prev,
      chats: { ...prev.chats, done: true },
      currentStep: 'vault'
    }))
  }

  const completeVault = async () => {
    setProgress(prev => ({ ...prev, currentStep: 'vault' }))
    
    let hasMore = true
    let totalScraped = 0

    while (hasMore) {
      const response = await fetch('/api/onlyfans/r2-scrape-vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Vault scrape failed')
      }

      totalScraped += data.scraped || 0
      hasMore = data.hasMore || false

      setProgress(prev => ({
        ...prev,
        vault: { current: totalScraped, total: 0, done: !hasMore }
      }))

      if (!hasMore) break
    }

    setProgress(prev => ({
      ...prev,
      vault: { ...prev.vault, done: true },
      currentStep: 'complete'
    }))
  }

  const getOverallProgress = () => {
    const steps = ['fans', 'chats', 'vault']
    const completed = steps.filter(step => progress[step].done).length
    return Math.round((completed / steps.length) * 100)
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border-2 border-red-500 rounded-lg p-6">
          <div className="text-4xl mb-4">❌</div>
          <h3 className="text-xl font-bold text-red-900 mb-2">Setup Failed</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (progress.currentStep === 'complete') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-2xl font-bold text-green-900 mb-2">Setup Complete!</h3>
          <div className="text-green-700 space-y-1">
            <p>✅ {progress.fans.current} fans synced</p>
            <p>✅ {progress.chats.current} messages synced</p>
            <p>✅ {progress.vault.current} media files scraped</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white border-2 border-indigo-500 rounded-lg p-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">
          🔄 Setting up your account...
        </h3>
        
        {/* Overall Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Overall Progress</span>
            <span>{getOverallProgress()}%</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-500"
              style={{ width: `${getOverallProgress()}%` }}
            />
          </div>
        </div>

        {/* Individual Steps */}
        <div className="space-y-4">
          {/* Fans */}
          <div className={`p-4 rounded-lg ${progress.currentStep === 'fans' ? 'bg-indigo-50' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">
                {progress.fans.done ? '✅' : progress.currentStep === 'fans' ? '⏳' : '⏸️'} Syncing Fans
              </span>
              <span className="text-sm text-gray-600">{progress.fans.current} synced</span>
            </div>
            {progress.currentStep === 'fans' && !progress.fans.done && (
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 animate-pulse w-full" />
              </div>
            )}
          </div>

          {/* Chats */}
          <div className={`p-4 rounded-lg ${progress.currentStep === 'chats' ? 'bg-indigo-50' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">
                {progress.chats.done ? '✅' : progress.currentStep === 'chats' ? '⏳' : '⏸️'} Syncing Messages
              </span>
              <span className="text-sm text-gray-600">{progress.chats.current} synced</span>
            </div>
            {progress.currentStep === 'chats' && !progress.chats.done && (
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 animate-pulse w-full" />
              </div>
            )}
          </div>

          {/* Vault */}
          <div className={`p-4 rounded-lg ${progress.currentStep === 'vault' ? 'bg-indigo-50' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">
                {progress.vault.done ? '✅' : progress.currentStep === 'vault' ? '⏳' : '⏸️'} Scraping Vault
              </span>
              <span className="text-sm text-gray-600">{progress.vault.current} media files</span>
            </div>
            {progress.currentStep === 'vault' && !progress.vault.done && (
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 animate-pulse w-full" />
              </div>
            )}
          </div>
        </div>

        <p className="text-sm text-gray-600 mt-6 text-center">
          ⏱️ This may take 3-5 minutes. Please don't close this page.
        </p>
      </div>
    </div>
  )
}
