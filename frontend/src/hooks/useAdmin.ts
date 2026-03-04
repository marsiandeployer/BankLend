import { useWriteContract, useAccount } from 'wagmi'
import { useState } from 'react'
import { usePoolState } from './usePoolState'
import { useStorage } from './useStorage'
import BankLendingPoolABI from '../contracts/BankLendingPool.json'
import { STORAGE_ADDRESS } from '../constants/addresses'

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
] as const

export function useAdmin() {
  const { address } = useAccount()
  const { poolAddress } = usePoolState()
  const { owner, config, setConfig, isPending: storagePending } = useStorage()
  const [step, setStep] = useState<'idle' | 'approving' | 'pending' | 'done'>('idle')

  const { writeContractAsync } = useWriteContract()

  const isAdmin = !!address && !!owner && address.toLowerCase() === owner.toLowerCase()

  const adminWithdraw = async (amount: bigint) => {
    if (!poolAddress || !isAdmin) throw new Error('Not authorized')

    setStep('pending')
    try {
      const hash = await writeContractAsync({
        address: poolAddress,
        abi: BankLendingPoolABI as any,
        functionName: 'adminWithdraw',
        args: [amount],
      })
      setStep('done')
      return hash
    } catch (e) {
      setStep('idle')
      throw e
    }
  }

  const adminDeposit = async (amount: bigint, depositToken: `0x${string}`) => {
    if (!poolAddress || !isAdmin) throw new Error('Not authorized')

    try {
      // Approve USDT first
      setStep('approving')
      await writeContractAsync({
        address: depositToken,
        abi: ERC20_APPROVE_ABI,
        functionName: 'approve',
        args: [poolAddress, amount],
      })

      // Deposit back to pool
      setStep('pending')
      const hash = await writeContractAsync({
        address: poolAddress,
        abi: BankLendingPoolABI as any,
        functionName: 'adminDeposit',
        args: [amount],
      })
      setStep('done')
      return hash
    } catch (e) {
      setStep('idle')
      throw e
    }
  }

  const setRates = async (depositAPY: number, borrowAPY: number) => {
    if (!poolAddress || !isAdmin) throw new Error('Not authorized')

    setStep('pending')
    try {
      const hash = await writeContractAsync({
        address: poolAddress,
        abi: BankLendingPoolABI as any,
        functionName: 'setRates',
        args: [depositAPY, borrowAPY],
      })
      setStep('done')
      return hash
    } catch (e) {
      setStep('idle')
      throw e
    }
  }

  const setCollateral = async (
    token: `0x${string}`,
    priceFeed: `0x${string}`,
    ltv: number,
  ) => {
    if (!poolAddress || !isAdmin) throw new Error('Not authorized')

    setStep('pending')
    try {
      const hash = await writeContractAsync({
        address: poolAddress,
        abi: BankLendingPoolABI as any,
        functionName: 'setCollateral',
        args: [token, priceFeed, ltv],
      })
      setStep('done')
      return hash
    } catch (e) {
      setStep('idle')
      throw e
    }
  }

  const updateStorageConfig = async (updates: Partial<typeof config>) => {
    if (!isAdmin) throw new Error('Not authorized')
    const current = config || {
      poolAddress: '',
      depositToken: '',
      collateral: {},
      depositAPY: 800,
      borrowAPY: 1500,
      logoUrl: '',
      title: 'BankLend',
    }
    await setConfig({ ...current, ...updates } as any)
  }

  return {
    isAdmin,
    adminWithdraw,
    adminDeposit,
    setRates,
    setCollateral,
    updateStorageConfig,
    step,
    storagePending,
  }
}
