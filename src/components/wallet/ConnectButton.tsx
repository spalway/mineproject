'use client'

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { shortKey } from '@/lib/format'

export function ConnectButton() {
  const { wallets, select, connect, connected, connecting, publicKey, disconnect } = useWallet()
  const [open, setOpen] = useState(false)

  if (connected && publicKey) {
    return (
      <button
        onClick={() => void disconnect()}
        className="border border-pj-dim px-2 py-0.5 text-pj-green hover:bg-pj-green hover:text-pj-bg transition-colors"
      >
        [{shortKey(publicKey.toBase58())}]
      </button>
    )
  }

  const installed = wallets.filter((w) => w.readyState === 'Installed')
  const listed = installed.length > 0 ? installed : wallets

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={connecting}
        className="border border-pj-green px-2 py-0.5 text-pj-green hover:bg-pj-green hover:text-pj-bg transition-colors disabled:opacity-50"
      >
        {connecting ? 'linking' : 'connect'}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border border-pj-dim bg-pj-bg text-pj-green sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="tracking-widest">select wallet</DialogTitle>
            <DialogDescription className="pj-dim">
              {listed.length === 0
                ? 'no solana wallet detected in this browser.'
                : 'devnet. nothing here touches mainnet funds.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1">
            {listed.map((w) => (
              <button
                key={w.adapter.name}
                onClick={async () => {
                  select(w.adapter.name)
                  setOpen(false)
                  try {
                    await connect()
                  } catch {
                    // user dismissed the wallet prompt
                  }
                }}
                className="flex items-center justify-between border border-pj-faint px-3 py-2 text-left hover:border-pj-green hover:bg-pj-green/10"
              >
                <span>{w.adapter.name}</span>
                <span className="pj-dim text-xs">
                  {w.readyState === 'Installed' ? 'detected' : w.readyState.toLowerCase()}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
