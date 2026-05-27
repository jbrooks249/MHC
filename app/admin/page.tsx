'use client'

import { useState } from 'react'
import { ArrowLeft, Database } from 'lucide-react'
import Link from 'next/link'
import AdminPanel from '@/components/admin-panel'

export default function AdminPage() {
  const [isPanelOpen, setIsPanelOpen] = useState(true)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Back to Dashboard</span>
              </Link>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <Database className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
                  <p className="text-sm text-muted-foreground">Manage Properties, AI Tasks & Data</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Admin Panel - Full Page */}
      <AdminPanel 
        isOpen={isPanelOpen} 
        onClose={() => setIsPanelOpen(false)} 
      />
    </div>
  )
}
