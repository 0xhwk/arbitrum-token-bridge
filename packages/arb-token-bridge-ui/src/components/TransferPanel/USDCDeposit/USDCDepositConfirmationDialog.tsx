import React, { useEffect, useState } from 'react'
import { Tab, Dialog as HeadlessUIDialog } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'

import { Dialog, UseDialogProps } from '../../common/Dialog'
import { Button } from '../../common/Button'
import { ExternalLink } from '../../common/ExternalLink'
import {
  SpecialTokenSymbol,
  USDCFastBridges,
  FastBridgeInfo
} from '../../../util/fastBridges'
import { TabButton } from '../../common/Tab'
import { BridgesTable } from '../../common/BridgesTable'
import { useAppState } from '../../../state'
import { getNetworkName, isNetwork } from '../../../util/networks'
import { trackEvent } from '../../../util/AnalyticsUtils'
import { CommonAddress } from '../../../util/CommonAddressUtils'
import { USDCDepositConfirmationDialogCheckbox } from './USDCDepositConfirmationDialogCheckbox'
import { isTokenGoerliUSDC, isTokenMainnetUSDC } from '../../../util/TokenUtils'
import { CctpTabContent } from '../CctpTabContent'
import { CCTP_DOCUMENTATION } from '../../../constants'
import { useNetworks } from '../../../hooks/useNetworks'

type Props = UseDialogProps & {
  amount: string
}
export function USDCDepositConfirmationDialog(props: Props) {
  const {
    app: { selectedToken }
  } = useAppState()
  const [{ sourceChain, destinationChain }] = useNetworks()
  const { isTestnet } = isNetwork(sourceChain.id)
  const [allCheckboxesCheched, setAllCheckboxesChecked] = useState(false)
  const destinationNetworkName = getNetworkName(destinationChain.id)

  useEffect(() => {
    setAllCheckboxesChecked(false)
  }, [props.isOpen])

  if (!selectedToken) {
    return null
  }

  if (
    !isTokenMainnetUSDC(selectedToken.address) &&
    !isTokenGoerliUSDC(selectedToken.address)
  ) {
    return null
  }

  const tokenSymbol = SpecialTokenSymbol.USDC

  const fastBridges: FastBridgeInfo[] = USDCFastBridges.map(USDCFastBridge => ({
    name: USDCFastBridge.name,
    imageSrc: USDCFastBridge.imageSrc,
    href: USDCFastBridge.getHref({
      from: sourceChain.id,
      to: destinationChain.id,
      fromTokenAddress: isTestnet
        ? CommonAddress.Goerli.USDC
        : CommonAddress.Ethereum.USDC,
      toTokenAddress: isTestnet
        ? CommonAddress.ArbitrumGoerli.USDC
        : CommonAddress.ArbitrumOne.USDC,
      amount: props.amount,
      transferMode: 'deposit'
    })
  }))

  return (
    <Dialog {...props} isCustom>
      <div className="flex max-h-screen w-full flex-col md:w-[750px] lg:w-[925px]">
        <Tab.Group
          onChange={() => {
            setAllCheckboxesChecked(false)
          }}
        >
          <div className="flex flex-row items-center justify-between bg-ocl-blue px-8 py-4">
            <HeadlessUIDialog.Title className="text-2xl font-medium text-white">
              Move funds to {destinationNetworkName}
            </HeadlessUIDialog.Title>
            <button
              className="arb-hover"
              onClick={() => {
                props.onClose(false)
              }}
            >
              <XMarkIcon className="h-6 w-6 text-white" />
            </button>
          </div>
          <Tab.List className="flex bg-ocl-blue">
            <TabButton>Arbitrum&apos;s bridge (USDC.e)</TabButton>
            <TabButton>Third party (USDC)</TabButton>
            <TabButton>Circle (USDC)</TabButton>
          </Tab.List>

          <Tab.Panel className="flex flex-col space-y-3 px-8 py-4">
            <div className="flex flex-col space-y-6">
              <p className="font-light">
                Receive{' '}
                <span className="font-medium">Bridged USDC (USDC.e)</span> on{' '}
                {destinationNetworkName} using Arbitrum&apos;s native bridge.
              </p>

              <div className="flex flex-col space-y-3">
                <USDCDepositConfirmationDialogCheckbox
                  onChange={checked => {
                    setAllCheckboxesChecked(checked)
                  }}
                />
              </div>
            </div>

            <div className="mt-2 flex flex-row justify-end space-x-2">
              <Button variant="secondary" onClick={() => props.onClose(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!allCheckboxesCheched}
                onClick={() => {
                  props.onClose(true, 'bridged')
                  setAllCheckboxesChecked(false)
                  trackEvent('Use Arbitrum Bridge Click', {
                    tokenSymbol
                  })
                }}
              >
                Confirm
              </Button>
            </div>
          </Tab.Panel>

          <Tab.Panel className="flex flex-col space-y-3 px-8 py-4">
            <div className="flex flex-col space-y-3">
              <p className="font-light">
                Receive <span className="font-medium">Native USDC</span> on
                Arbitrum One using a third-party bridge with Circle&apos;s{' '}
                <ExternalLink
                  className="arb-hover text-blue-link underline"
                  href={CCTP_DOCUMENTATION}
                >
                  Cross-Chain Transfer Protocol
                </ExternalLink>{' '}
                integrated.
              </p>
            </div>

            <BridgesTable
              bridgeList={fastBridges}
              selectedNonCanonicalToken={tokenSymbol}
            />
            <div className="mt-2 flex flex-row justify-end space-x-2">
              <Button variant="secondary" onClick={() => props.onClose(false)}>
                Cancel
              </Button>
            </div>
          </Tab.Panel>

          <Tab.Panel className="flex flex-col space-y-3 px-8 py-4">
            <div className="flex flex-col space-y-6">
              <CctpTabContent toNetworkName={destinationNetworkName}>
                <div className="flex flex-col space-y-3">
                  <USDCDepositConfirmationDialogCheckbox
                    onAllCheckboxesCheched={() => {
                      setAllCheckboxesChecked(true)
                    }}
                    onChange={checked => {
                      if (!checked) {
                        setAllCheckboxesChecked(false)
                      }
                    }}
                    isBridgingNativeUSDC
                  />
                </div>
              </CctpTabContent>
            </div>
            <div className="mt-2 flex flex-row justify-end space-x-2">
              <Button variant="secondary" onClick={() => props.onClose(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!allCheckboxesCheched}
                onClick={() => {
                  props.onClose(true, 'cctp')
                  setAllCheckboxesChecked(false)
                  trackEvent('Use Arbitrum Bridge Click', {
                    tokenSymbol
                  })
                }}
              >
                Confirm
              </Button>
            </div>
          </Tab.Panel>
        </Tab.Group>
      </div>
    </Dialog>
  )
}
