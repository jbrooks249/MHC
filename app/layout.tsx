import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MHC Acquisition Intelligence Platform',
  description: 'Discover and analyze manufactured housing community acquisition opportunities',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-dark text-white">
        {children}
      </body>
    </html>
  )
}
