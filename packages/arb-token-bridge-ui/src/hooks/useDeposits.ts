import useSWRImmutable from 'swr/immutable'
import { useAccount } from 'wagmi'

import { PageParams } from '../components/TransactionHistory/TransactionsTable/TransactionsTable'
import { useAppContextState } from '../components/App/AppContext'
import { MergedTransaction } from '../state/app/state'
import { isPending, transformDeposits } from '../state/app/utils'
import {
  FetchDepositParams,
  fetchDeposits
} from '../util/deposits/fetchDeposits'
import { Transaction } from './useTransactions'
import {
  getQueryParamsForFetchingReceivedFunds,
  getQueryParamsForFetchingSentFunds
} from '../util/SubgraphUtils'
import { useNetworks } from './useNetworks'
import { useNetworksRelationship } from './useNetworksRelationship'

export type CompleteDepositData = {
  deposits: Transaction[]
  pendingDeposits: Transaction[]
  transformedDeposits: MergedTransaction[]
}

export const fetchCompleteDepositData = async (
  depositParams: FetchDepositParams
): Promise<CompleteDepositData> => {
  // get the original deposits
  const deposits = await fetchDeposits(depositParams)
  // filter out pending deposits
  const pendingDepositsMap = new Map<string, boolean>()
  // get their complete transformed data (so that we get their exact status)
  const completeDepositData = transformDeposits(deposits)
  completeDepositData.forEach(completeTxData => {
    if (isPending(completeTxData)) {
      pendingDepositsMap.set(completeTxData.txId, true)
    }
  })
  const pendingDeposits = deposits.filter(
    tx => typeof pendingDepositsMap.get(tx.txID) !== 'undefined'
  )

  return { deposits, pendingDeposits, transformedDeposits: completeDepositData }
}

export const useDeposits = (depositPageParams: PageParams) => {
  const [networks] = useNetworks()
  const { childProvider, parentProvider } = useNetworksRelationship(networks)
  const { address: walletAddress } = useAccount()
  const {
    layout: { isTransactionHistoryShowingSentTx }
  } = useAppContextState()

  /* return the cached response for the complete pending transactions */
  return useSWRImmutable(
    walletAddress
      ? [
          'deposits',
          walletAddress,
          parentProvider,
          childProvider,
          isTransactionHistoryShowingSentTx,
          depositPageParams.pageNumber,
          depositPageParams.pageSize,
          depositPageParams.searchString
        ]
      : null,
    ([
      ,
      _walletAddress,
      _parentProvider,
      _childProvider,
      _isTransactionHistoryShowingSentTx,
      _pageNumber,
      _pageSize,
      _searchString
    ]) =>
      fetchCompleteDepositData({
        l1Provider: _parentProvider,
        l2Provider: _childProvider,
        pageNumber: _pageNumber,
        pageSize: _pageSize,
        searchString: _searchString,
        ...(_isTransactionHistoryShowingSentTx
          ? getQueryParamsForFetchingSentFunds(_walletAddress)
          : getQueryParamsForFetchingReceivedFunds(_walletAddress))
      })
  )
}
