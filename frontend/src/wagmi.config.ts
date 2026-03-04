import { createConfig, http } from 'wagmi'
import { bsc, bscTestnet } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'
import { APP_CONFIG } from './constants/config'

export const wagmiConfig = createConfig({
  chains: [bsc, bscTestnet],
  connectors: [
    injected(),
    walletConnect({ projectId: APP_CONFIG.walletConnectProjectId }),
  ],
  transports: {
    [bsc.id]: http('https://bsc-dataseed.binance.org/'),
    [bscTestnet.id]: http('https://data-seed-prebsc-1-s1.binance.org:8545'),
  },
})
