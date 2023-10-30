import React, { useEffect, useMemo, useState } from 'react'

import { useAccount, useNetwork, WagmiConfig } from 'wagmi'
import { darkTheme, RainbowKitProvider, Theme } from '@rainbow-me/rainbowkit'
import merge from 'lodash-es/merge'
import axios from 'axios'
import { createOvermind, Overmind } from 'overmind'
import { Provider } from 'overmind-react'
import { useLocalStorage } from 'react-use'
import { ConnectionState } from '../../util'
import { TokenBridgeParams } from '../../hooks/useArbTokenBridge'
import { WelcomeDialog } from './WelcomeDialog'
import { BlockedDialog } from './BlockedDialog'
import { AppContextProvider } from './AppContext'
import { config, useActions, useAppState } from '../../state'
import { Alert } from '../common/Alert'
import { MainContent } from '../MainContent/MainContent'
import { ArbTokenBridgeStoreSync } from '../syncers/ArbTokenBridgeStoreSync'
import { BalanceUpdater } from '../syncers/BalanceUpdater'
import { PendingTransactionsUpdater } from '../syncers/PendingTransactionsUpdater'
import { RetryableTxnsIncluder } from '../syncers/RetryableTxnsIncluder'
import { TokenListSyncer } from '../syncers/TokenListSyncer'
import { useDialog } from '../common/Dialog'

import {
  HeaderContent,
  HeaderOverrides,
  HeaderOverridesProps
} from '../common/Header'
import { HeaderNetworkInformation } from '../common/HeaderNetworkInformation'
import { HeaderAccountPopover } from '../common/HeaderAccountPopover'
import { Notifications } from '../common/Notifications'
import { isNetwork } from '../../util/networks'
import { ArbQueryParamProvider } from '../../hooks/useArbQueryParams'
import { NetworkSelectionContainer } from '../common/NetworkSelectionContainer'
import { GET_HELP_LINK, TOS_LOCALSTORAGE_KEY } from '../../constants'
import { getProps } from '../../util/wagmi/setup'
import { useAccountIsBlocked } from '../../hooks/useAccountIsBlocked'
import { useCCTPIsBlocked } from '../../hooks/CCTP/useCCTPIsBlocked'
import { useNetworks } from '../../hooks/useNetworks'
import { useNetworksRelationship } from '../../hooks/useNetworksRelationship'

declare global {
  interface Window {
    Cypress?: any
  }
}

const rainbowkitTheme = merge(darkTheme(), {
  colors: {
    accentColor: 'var(--blue-link)'
  },
  fonts: {
    body: "'Space Grotesk', sans-serif"
  }
} as Theme)

const AppContent = (): JSX.Element => {
  const { chain } = useNetwork()
  const {
    app: { connectionState }
  } = useAppState()

  const headerOverridesProps: HeaderOverridesProps = useMemo(() => {
    const { isTestnet, isGoerli } = isNetwork(chain?.id ?? 0)
    const className = isTestnet ? 'lg:bg-ocl-blue' : 'lg:bg-black'

    if (isGoerli) {
      return { imageSrc: 'images/HeaderArbitrumLogoGoerli.webp', className }
    }

    return { imageSrc: 'images/HeaderArbitrumLogoMainnet.svg', className }
  }, [chain])

  if (connectionState === ConnectionState.SEQUENCER_UPDATE) {
    return (
      <Alert type="red">
        Note: The Arbitrum Sequencer Will be offline today 3pm-5pm EST for
        maintenance. Thanks for your patience!
      </Alert>
    )
  }

  if (connectionState === ConnectionState.NETWORK_ERROR) {
    return (
      <Alert type="red">
        Error: unable to connect to network. Try again soon and contact{' '}
        <a rel="noreferrer" target="_blank" href={GET_HELP_LINK}>
          <u>support</u>
        </a>{' '}
        if problem persists.
      </Alert>
    )
  }

  return (
    <>
      <HeaderOverrides {...headerOverridesProps} />

      <HeaderContent>
        <NetworkSelectionContainer>
          <HeaderNetworkInformation />
        </NetworkSelectionContainer>

        <HeaderAccountPopover />
      </HeaderContent>

      <PendingTransactionsUpdater />
      <RetryableTxnsIncluder />

      <TokenListSyncer />
      <BalanceUpdater />
      <Notifications />
      <MainContent />
    </>
  )
}

const Injector = ({ children }: { children: React.ReactNode }): JSX.Element => {
  const actions = useActions()
  const { chain } = useNetwork()
  const { address, isConnected } = useAccount()
  const { isBlocked } = useAccountIsBlocked()
  const [networks] = useNetworks()
  const { parentProvider, parentChain, childProvider } =
    useNetworksRelationship(networks)

  // We want to be sure this fetch is completed by the time we open the USDC modals
  useCCTPIsBlocked()

  const [tokenBridgeParams, setTokenBridgeParams] =
    useState<TokenBridgeParams | null>(null)

  // Listen for account and network changes
  useEffect(() => {
    // Any time one of those changes
    setTokenBridgeParams(null)
    actions.app.setConnectionState(ConnectionState.LOADING)

    const chain = networks.from
    if (!chain) {
      return
    }

    const isConnectedToArbitrum = isNetwork(chain.id).isArbitrum
    const isConnectedToOrbitChain = isNetwork(chain.id).isOrbitChain

    const fromNetworkChainId = parentProvider.network.chainId
    const toNetworkChainId = childProvider.network.chainId
    const isParentChainEthereum = isNetwork(parentChain.id).isEthereum

    actions.app.reset(chain.id)
    actions.app.setChainIds({
      l1NetworkChainId: fromNetworkChainId,
      l2NetworkChainId: toNetworkChainId
    })

    if (
      (isParentChainEthereum && isConnectedToArbitrum) ||
      isConnectedToOrbitChain
    ) {
      console.info('Withdrawal mode detected:')
      actions.app.setIsDepositMode(false)
      actions.app.setConnectionState(ConnectionState.L2_CONNECTED)
    } else {
      console.info('Deposit mode detected:')
      actions.app.setIsDepositMode(true)
      actions.app.setConnectionState(ConnectionState.L1_CONNECTED)
    }

    setTokenBridgeParams({
      l1: {
        network: parentProvider.network,
        provider: parentProvider
      },
      l2: {
        network: childProvider.network,
        provider: childProvider
      }
    })
  }, [
    networks.from,
    isConnected,
    address,
    actions.app,
    parentProvider,
    childProvider,
    parentChain.id
  ])

  useEffect(() => {
    axios
      .get(
        'https://raw.githubusercontent.com/OffchainLabs/arb-token-lists/aff40a59608678cfd9b034dd198011c90b65b8b6/src/WarningList/warningTokens.json'
      )
      .then(res => {
        actions.app.setWarningTokens(res.data)
      })
      .catch(err => {
        console.warn('Failed to fetch warning tokens:', err)
      })
  }, [])

  if (address && isBlocked) {
    return (
      <BlockedDialog
        address={address}
        isOpen={true}
        // ignoring until we use the package
        // https://github.com/OffchainLabs/config-monorepo/pull/11
        //
        // eslint-disable-next-line
        onClose={() => {}}
      />
    )
  }

  return (
    <>
      {tokenBridgeParams && (
        <ArbTokenBridgeStoreSync tokenBridgeParams={tokenBridgeParams} />
      )}
      {children}
    </>
  )
}

// We're doing this as a workaround so users can select their preferred chain on WalletConnect.
//
// https://github.com/orgs/WalletConnect/discussions/2733
// https://github.com/wagmi-dev/references/blob/main/packages/connectors/src/walletConnect.ts#L114
function useProviderProps() {
  const [searchParams] = useState(
    new URLSearchParams(global.window?.location.search ?? '')
  )
  const targetChainKey = searchParams.get('walletConnectChain')
  const localStorage = global.window?.localStorage
  const { wagmiConfigProps, rainbowKitProviderProps } = useMemo(
    () => getProps(targetChainKey),
    [targetChainKey]
  )

  // Clear cache for everything related to WalletConnect v2.
  // TODO: Remove this once the fix for the infinite loop / memory leak is identified.
  useEffect(() => {
    if (!localStorage) {
      return
    }
    Object.keys(localStorage).forEach(key => {
      if (key === 'wagmi.requestedChains' || key.startsWith('wc@2')) {
        localStorage.removeItem(key)
      }
    })
  }, [localStorage])

  return { wagmiConfigProps, rainbowKitProviderProps }
}

export default function App() {
  const [overmind] = useState<Overmind<typeof config>>(createOvermind(config))
  const { wagmiConfigProps, rainbowKitProviderProps } = useProviderProps()
  const [tosAccepted, setTosAccepted] =
    useLocalStorage<string>(TOS_LOCALSTORAGE_KEY)
  const [welcomeDialogProps, openWelcomeDialog] = useDialog()

  const isTosAccepted = tosAccepted !== undefined

  useEffect(() => {
    if (!isTosAccepted) {
      openWelcomeDialog()
    }
  }, [isTosAccepted, openWelcomeDialog])

  function onClose(confirmed: boolean) {
    // Only close after confirming (agreeing to terms)
    if (confirmed) {
      setTosAccepted('true')
      welcomeDialogProps.onClose(confirmed)
    }
  }

  if (!wagmiConfigProps || !rainbowKitProviderProps) {
    return null
  }

  return (
    <Provider value={overmind}>
      <ArbQueryParamProvider>
        <WagmiConfig {...wagmiConfigProps}>
          <RainbowKitProvider
            theme={rainbowkitTheme}
            {...rainbowKitProviderProps}
          >
            <WelcomeDialog {...welcomeDialogProps} onClose={onClose} />
            <AppContextProvider>
              <Injector>{<AppContent />}</Injector>
            </AppContextProvider>
          </RainbowKitProvider>
        </WagmiConfig>
      </ArbQueryParamProvider>
    </Provider>
  )
}
