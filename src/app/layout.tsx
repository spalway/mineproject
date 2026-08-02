import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { WalletProvider } from '@/components/wallet/WalletProvider'
import { Toaster } from '@/components/ui/sonner'

const pixelta = localFont({
  src: '../../public/fonts/Pixelta.ttf',
  variable: '--font-pixelta',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'nodei',
  description:
    'every pump.fun token belongs to one sector of a 64-cell field, decided by its own mint address. deploy into a sector. when the launch flow grades it highest, it strikes.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${pixelta.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <WalletProvider>{children}</WalletProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  )
}
