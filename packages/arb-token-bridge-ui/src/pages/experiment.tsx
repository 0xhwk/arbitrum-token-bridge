import { useAccount, useNetwork, useSigner, WagmiConfig } from 'wagmi'
import { BigNumber, utils } from 'ethers'
import {
  lightTheme,
  RainbowKitProvider,
  ConnectButton
} from '@rainbow-me/rainbowkit'

import { getProps } from '../util/wagmi/setup'
import { PropsWithChildren, useEffect, useState, useMemo } from 'react'
import { Provider, StaticJsonRpcProvider } from '@ethersproject/providers'

import { Loader } from '../components/common/atoms/Loader'
import {
  BridgeTransfer,
  BridgeTransferStatus,
  BridgeTransferType
} from '../__experiments__/BridgeTransfer'
import { BridgeTransferStarterFactory } from '../__experiments__/BridgeTransferStarterFactory'
import { Erc20Deposit } from '../__experiments__/Erc20Deposit'
import { useSwitchNetworkWithConfig } from '../hooks/useSwitchNetworkWithConfig'
import { Erc20Withdrawal } from '../__experiments__/Erc20Withdrawal'
import { ChainId } from '../util/networks'

// Adding claims to bridge
// 1. show the ERC-20 withdrawals in the tx history
// 1.1. The status should keep updating on polling
// 2. In the ERC-20 withdrawal class, implement the claim method
// 3. once ready, claim button should activate on the tx history card

const { wagmiConfigProps, rainbowKitProviderProps } = getProps(null)

function Connected(props: PropsWithChildren<{ fallback: React.ReactNode }>) {
  const { isConnected } = useAccount()

  if (!isConnected) {
    return props.fallback
  }

  return props.children
}

type SmolChain = {
  name: string
  chainId: ChainId
  provider: StaticJsonRpcProvider
  blockExplorer: string
}

const goerli: SmolChain = {
  name: 'Goerli',
  chainId: ChainId.Goerli,
  provider: new StaticJsonRpcProvider(
    `https://goerli.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_KEY}`
  ),
  blockExplorer: 'https://goerli.etherscan.io'
}

const arbitrumGoerli = {
  name: 'Arbitrum Goerli',
  chainId: ChainId.ArbitrumGoerli,
  provider: new StaticJsonRpcProvider(`https://goerli-rollup.arbitrum.io/rpc`),
  blockExplorer: 'https://goerli.arbiscan.io'
}

type Balance = BigNumber | null

function Balance({ provider }: { provider: StaticJsonRpcProvider }) {
  const { address } = useAccount()
  const [balance, setBalance] = useState<BigNumber | null>(null)

  useEffect(() => {
    async function updateBalance() {
      setBalance(null)
      setBalance(await provider.getBalance(address!))
    }

    updateBalance()
  }, [address, provider])

  if (!balance) {
    return <Loader size="small" />
  }

  return <span>{utils.formatEther(balance)} ETH</span>
}

type TxHistoryEntry = {
  type: BridgeTransferType
  sourceChainTxHash: string
  sourceChainProvider: StaticJsonRpcProvider
  destinationChainProvider: StaticJsonRpcProvider
}

const txHistory: TxHistoryEntry[] = [
  {
    type: 'erc20_withdrawal',
    sourceChainTxHash:
      '0x33b04cfe3a9a691d9c804163bd878f2bc340a77ea9d04586eb8b19a0e554e629',
    sourceChainProvider: arbitrumGoerli.provider,
    destinationChainProvider: goerli.provider
  },
  {
    type: 'erc20_deposit',
    sourceChainTxHash:
      '0xffd303a28eb156fd95ae4b424c00944d672a5737ec93c2b93f772e490ba7a6b8',
    sourceChainProvider: goerli.provider,
    destinationChainProvider: arbitrumGoerli.provider
  },
  {
    type: 'erc20_deposit',
    sourceChainTxHash:
      '0x9228d80ee1da15301755de4a577a4baa21614250d6c78d97ad4ca72dbfccdb06',
    sourceChainProvider: goerli.provider,
    destinationChainProvider: arbitrumGoerli.provider
  },
  {
    type: 'erc20_deposit',
    sourceChainTxHash:
      '0x79136479c42ca7f96e6eed6018e4ca015f76270fcf904598eae4e97081a8e509',
    sourceChainProvider: goerli.provider,
    destinationChainProvider: arbitrumGoerli.provider
  }
]

async function loadTxHistory(): Promise<(Erc20Deposit | Erc20Withdrawal)[]> {
  return Promise.all(
    Object.values(txHistory).map(async tx => {
      const isDeposit = tx.type.includes('deposit')
      const Factory = isDeposit ? Erc20Deposit : Erc20Withdrawal
      return Factory.initializeFromSourceChainTxHash({
        sourceChainTxHash: tx.sourceChainTxHash,
        sourceChainProvider: tx.sourceChainProvider,
        destinationChainProvider: tx.destinationChainProvider
      })
    })
  )
}

function BridgeTransferListItem({
  bridgeTransfer,
  sourceChainBlockExplorer,
  destinationChainBlockExplorer
}: {
  bridgeTransfer: Erc20Deposit | Erc20Withdrawal
  sourceChainBlockExplorer: string
  destinationChainBlockExplorer: string
}) {
  const { data: signer } = useSigner()
  const { address } = useAccount()

  const [timeRemaining, setTimeRemaining] = useState('')

  useEffect(() => {
    const fetchTimeRemaining = async () => {
      setTimeRemaining('Loading...')
      setTimeRemaining(await bridgeTransfer.fetchTimeRemaining())
    }
    fetchTimeRemaining()
  }, [bridgeTransfer])

  return (
    <li
      key={bridgeTransfer.sourceChainTx.hash}
      className="flex flex-col gap-2 border p-2"
    >
      <span className="font-medium">
        sourceChainTxHash:{' '}
        <a
          href={`${sourceChainBlockExplorer}/tx/${bridgeTransfer.sourceChainTx.hash}`}
          target="_blank"
          className="underline"
        >
          {bridgeTransfer.sourceChainTx.hash}
        </a>
      </span>
      <span className="font-medium">
        destinationChainTxHash:{' '}
        {bridgeTransfer.destinationChainTxReceipt ? (
          <a
            href={`${destinationChainBlockExplorer}/tx/${bridgeTransfer.destinationChainTxReceipt.transactionHash}`}
            target="_blank"
            className="underline"
          >
            {bridgeTransfer.destinationChainTxReceipt.transactionHash}
          </a>
        ) : (
          '??'
        )}
      </span>
      <span className="font-medium">status: {bridgeTransfer.status}</span>
      <span>{bridgeTransfer.isFetchingStatus ? 'Fetching...' : 'Fetched'}</span>
      <span>Time remaining: {timeRemaining}</span>
      {bridgeTransfer instanceof Erc20Withdrawal && (
        <button
          className="bg-black text-white"
          disabled={!bridgeTransfer.isClaimable}
          onClick={() => {
            if (!signer || !address) throw 'No signer, walletaddress found'
            // todo: also add a check for incorrect chain signer (connected network wrong)
            bridgeTransfer.claim({
              destinationChainSigner: signer,
              walletAddress: address,
              successCallback: () => {
                alert('Claim successful')
              },
              errorCallback: () => {
                alert('Claim failed')
              }
            })
          }}
        >
          Claim
        </button>
      )}
    </li>
  )
}

function App() {
  const { address } = useAccount()
  const { data: signer } = useSigner()

  const { switchNetwork } = useSwitchNetworkWithConfig()
  const { chain } = useNetwork()

  const [amount, setAmount] = useState<string>('')
  const [erc20, setErc20] = useState<string>('')
  const [fromChain, setFromChain] = useState<SmolChain>(goerli)
  const [toChain, setToChain] = useState<SmolChain>(arbitrumGoerli)

  const [bridgeTransferMap, setBridgeTransferMap] = useState<
    (Erc20Deposit | Erc20Withdrawal)[]
  >([])

  useEffect(() => {
    async function update() {
      const result = await loadTxHistory()
      setBridgeTransferMap(result)
    }
    update()
  }, [fromChain.provider, toChain.provider])

  const swap = async () => {
    setFromChain(toChain)
    setToChain(fromChain)
  }

  const updateConnectedChain = async () => {
    if (address) {
      const connectedChainId = chain?.id
      const fromChainId = await (await fromChain.provider.getNetwork()).chainId
      if (fromChainId && connectedChainId !== fromChainId) {
        switchNetwork?.(fromChainId)
      }
    }
  }

  useEffect(() => {
    updateConnectedChain()
  }, [address, fromChain])

  async function bridge() {
    if (!signer) {
      throw new Error('signer not found')
    }

    const sourceChainErc20ContractAddress = erc20 !== '' ? erc20 : undefined
    const destinationChainErc20ContractAddress =
      erc20 !== '' ? erc20 : undefined

    const bridgeTransferStarter = await BridgeTransferStarterFactory.create({
      sourceChainProvider: fromChain.provider,
      destinationChainProvider: toChain.provider,
      sourceChainErc20ContractAddress,
      destinationChainErc20ContractAddress
    })

    const startProps = {
      sourceChainSigner: signer,
      amount: utils.parseEther(amount)
    }

    if (await bridgeTransferStarter.requiresApproval(startProps)) {
      const approvalTx = await bridgeTransferStarter.approve(startProps)
      await approvalTx.wait()
    }

    const bridgeTransfer = await bridgeTransferStarter.start(startProps)

    setBridgeTransferMap(prevBridgeTransferMap => ({
      ...prevBridgeTransferMap,
      [bridgeTransfer.sourceChainTx.hash]: bridgeTransfer
    }))

    bridgeTransfer.pollForStatus({
      onChange: _bridgeTranfer =>
        setBridgeTransferMap(prevBridgeTransferMap => ({
          ...prevBridgeTransferMap,
          [_bridgeTranfer.sourceChainTx.hash]: _bridgeTranfer
        }))
    })
  }

  return (
    <div className="min-h-screen bg-white p-6 text-black">
      <h1 className="text-2xl font-medium">Experimental Bridge UI</h1>

      <Connected fallback={<ConnectButton label="Connect" />}>
        Connected: <span className="font-medium">{address}</span>
      </Connected>

      <div className="flex flex-row gap-4">
        <div className="flex min-w-[200px] flex-col">
          <span>
            From: <span className="font-medium">{fromChain.name}</span>
          </span>
          <Balance provider={fromChain.provider} />
        </div>
        <button onClick={swap}>{'<>'}</button>
        <div className="flex flex-col">
          <span>
            To: <span className="font-medium">{toChain.name}</span>
          </span>
          <Balance provider={toChain.provider} />
        </div>
      </div>

      <div className="flex max-w-[480px] flex-col gap-2">
        <input
          placeholder="source chain erc-20 address"
          className="w-full border p-1"
          value={erc20}
          onChange={event => setErc20(event.target.value)}
        />

        <input
          placeholder="amount"
          className="w-full border p-1"
          value={amount}
          onChange={event => setAmount(event.target.value)}
        />

        <button
          className="bg-black px-4 py-2 font-medium text-white"
          onClick={bridge}
        >
          Bridge
        </button>
      </div>

      <div>
        <h3 className="text-lg font-medium">Transaction History</h3>

        <ol className="flex flex-col gap-2">
          {Object.values(bridgeTransferMap).map((bridgeTransfer, index) => (
            <BridgeTransferListItem
              key={index}
              bridgeTransfer={bridgeTransfer}
              sourceChainBlockExplorer={fromChain.blockExplorer}
              destinationChainBlockExplorer={toChain.blockExplorer}
            />
          ))}
        </ol>
      </div>
    </div>
  )
}

export default function Experiment() {
  return (
    <WagmiConfig {...wagmiConfigProps}>
      <RainbowKitProvider theme={lightTheme()} {...rainbowKitProviderProps}>
        <App />
      </RainbowKitProvider>
    </WagmiConfig>
  )
}

Experiment.displayName = 'Experiment'
