import { useWriteContract, useReadContract, useAccount } from 'wagmi'
import { useState } from 'react'
import { usePoolState } from './usePoolState'
import { useStorage } from './useStorage'
import BankLendingPoolABI from '../contracts/BankLendingPool.json'

const ERC20_ABI = [
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

export type BorrowStep = 'idle' | 'approving-collateral' | 'borrowing' | 'approving-usdt' | 'repaying' | 'done'

export function useBorrow() {
  const { address } = useAccount()
  const { poolAddress } = usePoolState()
  const { config } = useStorage()
  const [step, setStep] = useState<BorrowStep>('idle')

  const { writeContractAsync, isPending } = useWriteContract()

  const borrow = async (
    collateralToken: `0x${string}`,
    collateralAmount: bigint,
    borrowAmount: bigint,
  ) => {
    if (!poolAddress) throw new Error('Pool not configured')

    try {
      // Approve collateral
      setStep('approving-collateral')
      await writeContractAsync({
        address: collateralToken,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [poolAddress, collateralAmount],
      })

      // Borrow
      setStep('borrowing')
      const hash = await writeContractAsync({
        address: poolAddress,
        abi: BankLendingPoolABI as any,
        functionName: 'borrow',
        args: [collateralToken, collateralAmount, borrowAmount],
      })

      setStep('done')
      return hash
    } catch (e) {
      setStep('idle')
      throw e
    }
  }

  const repay = async (amount: bigint) => {
    if (!poolAddress || !config?.depositToken) throw new Error('Pool not configured')

    const depositToken = config.depositToken as `0x${string}`

    try {
      // Approve USDT
      setStep('approving-usdt')
      await writeContractAsync({
        address: depositToken,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [poolAddress, amount],
      })

      // Repay
      setStep('repaying')
      const hash = await writeContractAsync({
        address: poolAddress,
        abi: BankLendingPoolABI as any,
        functionName: 'repay',
        args: [amount],
      })

      setStep('done')
      return hash
    } catch (e) {
      setStep('idle')
      throw e
    }
  }

  const liquidate = async (borrower: `0x${string}`, totalOwed: bigint) => {
    if (!poolAddress || !config?.depositToken) throw new Error('Pool not configured')

    const depositToken = config.depositToken as `0x${string}`

    try {
      setStep('approving-usdt')
      await writeContractAsync({
        address: depositToken,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [poolAddress, totalOwed],
      })

      setStep('repaying')
      const hash = await writeContractAsync({
        address: poolAddress,
        abi: BankLendingPoolABI as any,
        functionName: 'liquidate',
        args: [borrower],
      })

      setStep('done')
      return hash
    } catch (e) {
      setStep('idle')
      throw e
    }
  }

  return { borrow, repay, liquidate, step, isPending }
}
