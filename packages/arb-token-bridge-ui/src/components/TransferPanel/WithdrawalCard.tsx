import React, { useMemo } from 'react'

import { ExternalLink } from '../common/ExternalLink'
import { MergedTransaction } from '../../state/app/state'
import { useNetworksAndSigners } from '../../hooks/useNetworksAndSigners'
import { shortenTxHash } from '../../util/CommonUtils'
import { trackEvent } from '../../util/AnalyticsUtils'

import { useAppContextActions, useAppContextState } from '../App/AppContext'
import {
  ChainId,
  getExplorerUrl,
  getNetworkLogo,
  isNetwork
} from '../../util/networks'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { findMatchingL1TxForWithdrawal } from '../../state/app/utils'
import Image from 'next/image'
import { ClaimableCardConfirmed } from './ClaimableCardConfirmed'
import { ClaimableCardUnconfirmed } from './ClaimableCardUnconfirmed'
import { twMerge } from 'tailwind-merge'

export function WithdrawalL2TxStatus({
  tx
}: {
  tx: MergedTransaction
}): JSX.Element {
  const { l2 } = useNetworksAndSigners()
  const { network: l2Network } = l2

  if (typeof l2Network === 'undefined') {
    return <span>Not available</span>
  }

  if (tx.direction === 'withdraw' && tx.status === 'pending') {
    return <span>Pending...</span>
  }

  if (tx.txId === 'l2-tx-hash-not-found') {
    return <span>Not available</span>
  }

  return (
    <ExternalLink
      href={`${getExplorerUrl(l2Network.id)}/tx/${tx.txId}`}
      className="arb-hover flex flex-nowrap items-center gap-1 text-blue-link"
    >
      {shortenTxHash(tx.txId)}
      <CheckCircleIcon className="h-4 w-4 text-lime-dark" />
    </ExternalLink>
  )
}

export function WithdrawalL1TxStatus({
  tx
}: {
  tx: MergedTransaction
}): JSX.Element {
  const { l1 } = useNetworksAndSigners()
  const { network: l1Network } = l1

  // Try to find the L1 transaction that matches the L2ToL1 message
  const l1Tx = findMatchingL1TxForWithdrawal(tx)

  if (typeof l1Network === 'undefined') {
    return <span>Not available</span>
  }

  if (typeof l1Tx === 'undefined') {
    return <span>Not available</span>
  }

  return (
    <ExternalLink
      href={`${getExplorerUrl(l1Network.id)}/tx/${l1Tx.txId}`}
      className="arb-hover flex flex-nowrap items-center gap-1 text-blue-link"
    >
      {shortenTxHash(l1Tx.txId)}
      <CheckCircleIcon className="h-4 w-4 text-lime-dark" />
    </ExternalLink>
  )
}

export type WithdrawalCardContainerProps = {
  tx: MergedTransaction
  children: React.ReactNode
}

export function WithdrawalCardContainer({
  tx,
  children
}: WithdrawalCardContainerProps) {
  const { closeTransactionHistoryPanel } = useAppContextActions()
  const {
    layout: { isTransferPanelVisible }
  } = useAppContextState()
  const sourceChainId = tx.cctpData?.sourceChainId ?? ChainId.ArbitrumOne
  const { isEthereum } = isNetwork(sourceChainId)

  const bgClassName = useMemo(() => {
    switch (tx.status) {
      case 'Executed':
        return 'bg-lime'

      case 'Failure':
        return 'bg-brick'

      default:
        return 'bg-white'
    }
  }, [tx])

  return (
    <div
      className={twMerge(
        `box-border w-full overflow-hidden rounded-xl border-4 border-eth-dark ${bgClassName}`,
        !tx.isCctp && 'p-4'
      )}
    >
      {/* Cctp Header */}
      {tx.isCctp && (
        <div className="flex items-center justify-center bg-gradientCctp p-[.65rem]">
          <Image
            src="/icons/cctp.svg"
            className="mr-1 h-5 w-auto"
            alt="Cross Chain Transfer Protocol (Native USDC)"
            width={20}
            height={20}
          />
          Cross Chain Transfer Protocol Transaction
        </div>
      )}
      <div className={`${tx.isCctp && 'p-4'}`}>
        <div className="relative flex flex-col items-center gap-6 lg:flex-row">
          {/* Logo watermark */}
          <Image
            src={
              // Network destination logo
              isEthereum
                ? getNetworkLogo(ChainId.ArbitrumOne)
                : getNetworkLogo(ChainId.Mainnet)
            }
            className="absolute left-0 top-[1px] z-10 mr-4 h-8 max-h-[90px] w-auto p-[2px] lg:relative lg:left-[-30px] lg:top-0 lg:h-[4.5rem] lg:w-[initial] lg:max-w-[90px] lg:translate-x-[0.5rem] lg:scale-[1.5] lg:opacity-[60%]"
            alt={tx.direction}
            width={90}
            height={90}
          />
          {/* Actual content */}
          <div className="z-20 w-full">{children}</div>
        </div>

        {!isTransferPanelVisible && (
          <button
            className="arb-hover absolute bottom-4 right-4 text-ocl-blue underline"
            onClick={() => {
              trackEvent('Move More Funds Click')
              closeTransactionHistoryPanel()
            }}
          >
            Move more funds
          </button>
        )}
      </div>
    </div>
  )
}

export function WithdrawalCard({ tx }: { tx: MergedTransaction }) {
  if (tx.direction === 'withdraw') {
    return <ClaimableCardUnconfirmed tx={tx} />
  }

  switch (tx.status) {
    case 'Unconfirmed':
      return <ClaimableCardUnconfirmed tx={tx} />

    case 'Confirmed':
      return <ClaimableCardConfirmed tx={tx} />

    default:
      return null
  }
}
