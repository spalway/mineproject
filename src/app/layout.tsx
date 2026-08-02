import type { Metadata } from 'next'
import { Geist_Mono } from 'next/font/google'
import './globals.css'
import { WalletProvider } from '@/components/wallet/WalletProvider'
import { Toaster } from '@/components/ui/sonner'

const mono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'PUMPJACK // collaborative extraction field',
  description:
    'Every pump.fun token belongs to one sector of a 64-cell field, decided by its own mint address. Deploy into a sector. When the launch flow grades it highest, it strikes.',
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
