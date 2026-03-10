import { useReadContract, useWriteContract, useAccount, useChainId } from 'wagmi'
import { bscTestnet } from 'wagmi/chains'
import { STORAGE_ADDRESSES, DOMAINS } from '../constants/addresses'
import StorageABI from '../contracts/Storage.json'

export interface StorageData {
  owner: `0x${string}`
  data: `0x${string}`
}

export interface PoolConfig {
  poolAddress: string
  depositToken: string
  collateral: Record<string, { symbol: string; ltv: number }>
  depositAPY: number
  borrowAPY: number
  logoUrl: string
  title: string
}

export function useStorage() {
  const chainId = useChainId()
  const { address } = useAccount()

  const storageAddress = (STORAGE_ADDRESSES[chainId] ?? STORAGE_ADDRESSES[56]) as `0x${string}`
  const domain = DOMAINS[chainId] ?? DOMAINS[56]
  const isTestnet = chainId === bscTestnet.id

  const { data: storageData, isLoading, refetch } = useReadContract({
    address: storageAddress,
    abi: StorageABI,
    functionName: 'getData',
    args: [domain],
  })

  const { writeContractAsync, isPending } = useWriteContract()

  const appData = storageData as StorageData | undefined

  // Parse JSON from the data field.
  // Mainnet Storage returns bytes; testnet returns string — both encode identically in ABI,
  // so decoding as bytes and converting via TextDecoder works for both.
  const parseConfig = (): PoolConfig | null => {
    if (!appData?.data || appData.data === '0x') return null
    try {
      const hex = appData.data.slice(2)
      const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)))
      const str = new TextDecoder().decode(bytes)
      return JSON.parse(str)
    } catch {
      return null
    }
  }

  const setConfig = async (config: PoolConfig) => {
    const json = JSON.stringify(config)

    if (isTestnet) {
      // Testnet Storage uses setKeyData(string key, tuple(address owner, string info))
      await writeContractAsync({
        address: storageAddress,
        abi: StorageABI,
        functionName: 'setKeyData',
        args: [domain, { owner: address!, info: json }],
      })
    } else {
      // Mainnet Storage uses setData(string domain, bytes data)
      const bytes = new TextEncoder().encode(json)
      const hex = ('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`
      await writeContractAsync({
        address: storageAddress,
        abi: StorageABI,
        functionName: 'setData',
        args: [domain, hex],
      })
    }
    await refetch()
  }

  const config = parseConfig()

  return {
    owner: appData?.owner,
    config,
    isLoading,
    isPending,
    setConfig,
    refetch,
  }
}
