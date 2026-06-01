'use client'

import { useState, useEffect } from 'react'
import { 
  X, Settings, Key, Save, Loader2, CheckCircle2, 
  AlertCircle, Eye, EyeOff, Sparkles, Zap
} from 'lucide-react'

interface SettingsPanelProps {
  onClose: () => void
}

interface ApiKeyStatus {
  firecrawl: boolean
  openai: boolean
  googleMaps: boolean
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [keyStatus, setKeyStatus] = useState<ApiKeyStatus>({
    firecrawl: false,
    openai: false,
    googleMaps: false
  })
  const [showKeys, setShowKeys] = useState({
    firecrawl: false,
    openai: false,
    googleMaps: false
  })
  const [formData, setFormData] = useState({
    firecrawl: '',
    openai: '',
    googleMaps: ''
  })
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    fetchKeyStatus()
  }, [])

  const fetchKeyStatus = async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        setKeyStatus(data.keyStatus || {
          firecrawl: false,
          openai: false,
          googleMaps: false
        })
      }
    } catch (error) {
      console.error('Failed to fetch API key status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveStatus('idle')
    setErrorMessage('')

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firecrawl_api_key: formData.firecrawl || undefined,
          openai_api_key: formData.openai || undefined,
          google_maps_api_key: formData.googleMaps || undefined
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save settings')
      }

      setSaveStatus('success')
      setFormData({ firecrawl: '', openai: '', googleMaps: '' })
      await fetchKeyStatus()
      
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (error) {
      setSaveStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleShowKey = (key: keyof typeof showKeys) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Settings</h2>
              <p className="text-sm text-muted-foreground">Configure API keys and integrations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)] space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Status Banner */}
              {saveStatus === 'success' && (
                <div className="flex items-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-500">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm font-medium">Settings saved successfully!</p>
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{errorMessage}</p>
                </div>
              )}

              {/* Firecrawl API Key */}
              <div className="space-y-3 p-4 bg-secondary/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Firecrawl API Key</h3>
                      <p className="text-xs text-muted-foreground">Required for web scraping</p>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    keyStatus.firecrawl 
                      ? 'bg-emerald-500/10 text-emerald-500' 
                      : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    {keyStatus.firecrawl ? 'Configured' : 'Not Set'}
                  </div>
                </div>
                <div className="relative">
                  <input
                    type={showKeys.firecrawl ? 'text' : 'password'}
                    value={formData.firecrawl}
                    onChange={(e) => setFormData(prev => ({ ...prev, firecrawl: e.target.value }))}
                    placeholder={keyStatus.firecrawl ? '••••••••••••••••' : 'fc-xxxxxxxxxxxxxxxx'}
                    className="w-full px-3 py-2 pr-10 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('firecrawl')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKeys.firecrawl ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a href="https://firecrawl.dev" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    firecrawl.dev
                  </a>
                </p>
              </div>

              {/* OpenAI API Key */}
              <div className="space-y-3 p-4 bg-secondary/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">OpenAI API Key (ChatGPT)</h3>
                      <p className="text-xs text-muted-foreground">For AI-powered analysis and insights</p>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    keyStatus.openai 
                      ? 'bg-emerald-500/10 text-emerald-500' 
                      : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    {keyStatus.openai ? 'Configured' : 'Not Set'}
                  </div>
                </div>
                <div className="relative">
                  <input
                    type={showKeys.openai ? 'text' : 'password'}
                    value={formData.openai}
                    onChange={(e) => setFormData(prev => ({ ...prev, openai: e.target.value }))}
                    placeholder={keyStatus.openai ? '••••••••••••••••' : 'sk-xxxxxxxxxxxxxxxx'}
                    className="w-full px-3 py-2 pr-10 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('openai')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKeys.openai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    platform.openai.com
                  </a>
                </p>
              </div>

              {/* Google Maps API Key */}
              <div className="space-y-3 p-4 bg-secondary/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Key className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Google Maps API Key</h3>
                      <p className="text-xs text-muted-foreground">For Street View images and geocoding</p>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    keyStatus.googleMaps 
                      ? 'bg-emerald-500/10 text-emerald-500' 
                      : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    {keyStatus.googleMaps ? 'Configured' : 'Not Set'}
                  </div>
                </div>
                <div className="relative">
                  <input
                    type={showKeys.googleMaps ? 'text' : 'password'}
                    value={formData.googleMaps}
                    onChange={(e) => setFormData(prev => ({ ...prev, googleMaps: e.target.value }))}
                    placeholder={keyStatus.googleMaps ? '••••••••••••••••' : 'AIza...'}
                    className="w-full px-3 py-2 pr-10 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('googleMaps')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKeys.googleMaps ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Google Cloud Console
                  </a>
                </p>
              </div>

              {/* Info Box */}
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                <h4 className="font-medium text-foreground mb-2">How API Keys Work</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• API keys are stored securely as environment variables</li>
                  <li>• Keys are never exposed to the frontend</li>
                  <li>• You can update keys at any time by entering a new value</li>
                  <li>• Leave a field blank to keep the existing key unchanged</li>
                </ul>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4">
                <button
                  onClick={handleSave}
                  disabled={isSaving || (!formData.firecrawl && !formData.openai && !formData.googleMaps)}
                  className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
