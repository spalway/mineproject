import type { Metadata } from 'next'
import { Geist_Mono } from 'next/font/google'
import './globals.css'
import { WalletProvider } from '@/components/wallet/WalletProvider'
import { Toaster } from '@/components/ui/sonner'

const mono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
})

export const metadata: Metadata = {
  title: 'nodei',
  description:
    'a collaborative mining field over the pump.fun launch stream. hold the token, claim a sector, earn a share of creator fees every ten minutes.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${mono.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <WalletProvider>{children}</WalletProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  )
}
