import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount, useChainId } from 'wagmi'
import { useState } from 'react'
import { usePoolState } from './usePoolState'
import { useStorage } from './useStorage'
import BankLendingPoolABI from '../contracts/BankLendingPool.json'
import { TOKENS } from '../constants/addresses'

const ERC20_APPROVE_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export function useDeposit() {
  const { address } = useAccount()
  const chainId = useChainId()
  const { poolAddress } = usePoolState()
  const { config } = useStorage()
  const [step, setStep] = useState<'idle' | 'approving' | 'depositing' | 'done'>('idle')

  const chainTokens = TOKENS[chainId as keyof typeof TOKENS]
  const depositTokenAddress = (config?.depositToken || chainTokens?.USDT) as `0x${string}` | undefined

  const { data: allowance } = useReadContract({
    address: depositTokenAddress,
    abi: ERC20_APPROVE_ABI,
    functionName: 'allowance',
    args: address && poolAddress ? [address, poolAddress] : undefined,
    query: { enabled: !!address && !!poolAddress && !!depositTokenAddress },
  })

  const { writeContractAsync, isPending } = useWriteContract()

  const deposit = async (amount: bigint) => {
    if (!poolAddress || !depositTokenAddress) throw new Error('Pool not configured')

    try {
      // Step 1: Approve if needed
      if (!allowance || allowance < amount) {
        setStep('approving')
        await writeContractAsync({
          address: depositTokenAddress,
          abi: ERC20_APPROVE_ABI,
          functionName: 'approve',
          args: [poolAddress, amount],
        })
      }

      // Step 2: Deposit
      setStep('depositing')
      const hash = await writeContractAsync({
        address: poolAddress,
        abi: BankLendingPoolABI as any,
        functionName: 'deposit',
        args: [amount],
      })

      setStep('done')
      return hash
    } catch (e) {
      setStep('idle')
      throw e
    }
  }

  const withdraw = async (shares: bigint) => {
    if (!poolAddress) throw new Error('Pool not configured')

    setStep('depositing') // reuse step state
    try {
      const hash = await writeContractAsync({
        address: poolAddress,
        abi: BankLendingPoolABI as any,
        functionName: 'withdraw',
        args: [shares],
      })
      setStep('done')
      return hash
    } catch (e) {
      setStep('idle')
      throw e
    }
  }

  return {
    deposit,
    withdraw,
    step,
    isPending,
    allowance,
  }
}
