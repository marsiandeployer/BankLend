// BankLend App Configuration

export const APP_CONFIG = {
  name: 'BankLend',
  tagline: 'Earn yield. Borrow against crypto.',
  description: 'A transparent lending pool on BSC with real-time bank utilization dashboard.',

  // Walletconnect project ID — get from cloud.walletconnect.com
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo-project-id',

  // Utilization thresholds for BankRunGauge
  utilization: {
    safe: 70,     // < 70% = green (OK)
    caution: 85,  // 70-85% = orange (Caution)
                  // > 85% = red (Bank Run Risk)
  },

  // Default APY display (overridden by contract values)
  defaultDepositAPY: 800,  // 8% in basis points
  defaultBorrowAPY: 1500,  // 15% in basis points

  // Links
  links: {
    docs: 'https://onout.org/lenda/',
    github: 'https://github.com/noxonsu',
    bscScan: 'https://bscscan.com/address/',
  },
} as const

// Format basis points to percentage string
export const formatAPY = (bps: number): string => {
  return (bps / 100).toFixed(2) + '%'
}

// Format USDT amount (6 decimals)
export const formatUSDT = (amount: bigint, decimals = 2): string => {
  const value = Number(amount) / 1e6
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

// Format token amount with custom decimals
export const formatToken = (amount: bigint, decimals: number, displayDecimals = 4): string => {
  const value = Number(amount) / Math.pow(10, decimals)
  return value.toFixed(displayDecimals)
}
