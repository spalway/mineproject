'use client'

import { useMemo } from 'react'
import { clusterApiUrl } from '@solana/web3.js'
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from '@solana/wallet-adapter-react'

/**
 * No wallet adapter packages are installed on purpose. Phantom, Solflare and
 * Backpack all self-register through Wallet Standard, and the meta-package
 * pulls in @stellar/stellar-sdk whose postinstall needs yarn.
 */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(
    () =>
      process.env.NEXT_PUBLIC_RPC_URL ??
      clusterApiUrl(process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ? 'mainnet-beta' : 'devnet'),
    [],
  )

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={[]} autoConnect>
        {children}
      </SolanaWalletProvider>
    </ConnectionProvider>
  )
}
