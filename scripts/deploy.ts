import { ethers, network } from "hardhat";

// onout.org Storage contracts
const STORAGE_ADDRESS_BSC         = "0xa7472f384339D37EfE505a1A71619212495A973A";
const STORAGE_ADDRESS_BSC_TESTNET = "0xF0BCf27a2203E7E8c1e9D36F40EF2C5A8a6E7D0B";

// BSC Mainnet Chainlink feeds
const BSC_MAINNET_FEEDS = {
  WBNB: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE",  // BNB/USD
  WETH: "0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2E",  // ETH/USD
};

// BSC Mainnet token addresses
const BSC_MAINNET_TOKENS = {
  USDT: "0x55d398326f99059fF775485246999027B3197955",   // BSC-USD (USDT)
  WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",  // Wrapped BNB
  WETH: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",  // Wrapped ETH
};

// BSC Testnet Chainlink feeds (testnet)
const BSC_TESTNET_FEEDS = {
  WBNB: "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526",  // BNB/USD testnet
  WETH: "0x143db3CEEfbdfe5631aDD3E50f7614B6ba708BA7",  // ETH/USD testnet
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying BankLendingPool with account:", deployer.address);
  console.log("Network:", network.name);

  const isTestnet = network.name === "bscTestnet" || network.name === "hardhat" || network.name === "localhost";
  const isMainnet = network.name === "bsc";

  let usdtAddress: string;
  let wbnbAddress: string;
  let bnbFeedAddress: string;
  let domain: string;

  if (isMainnet) {
    usdtAddress = BSC_MAINNET_TOKENS.USDT;
    wbnbAddress = BSC_MAINNET_TOKENS.WBNB;
    bnbFeedAddress = BSC_MAINNET_FEEDS.WBNB;
    domain = "lenda.onout.org";
  } else if (network.name === "bscTestnet") {
    // Deploy mock USDT for testnet
    console.log("Deploying MockERC20 USDT for testnet...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockUSDT = await MockERC20.deploy("USDT Testnet", "USDT", 6);
    await mockUSDT.waitForDeployment();
    usdtAddress = await mockUSDT.getAddress();
    console.log("MockUSDT deployed:", usdtAddress);

    // Mint initial supply for testing
    await mockUSDT.mint(deployer.address, BigInt(1_000_000) * BigInt(1e6)); // 1M USDT
    console.log("Minted 1,000,000 USDT to deployer");

    // Mock WBNB
    const mockWBNB = await MockERC20.deploy("Wrapped BNB Test", "WBNB", 18);
    await mockWBNB.waitForDeployment();
    wbnbAddress = await mockWBNB.getAddress();
    console.log("MockWBNB deployed:", wbnbAddress);

    // Mock BNB/USD feed
    const MockAgg = await ethers.getContractFactory("MockAggregator");
    const bnbFeed = await MockAgg.deploy(BigInt(300) * BigInt(1e8), 8, "BNB/USD");
    await bnbFeed.waitForDeployment();
    bnbFeedAddress = await bnbFeed.getAddress();
    console.log("MockBNBFeed deployed:", bnbFeedAddress);

    domain = "lenda-testnet.onout.org";
  } else {
    throw new Error(`Unknown network: ${network.name}`);
  }

  const depositAPY = 800;   // 8%
  const borrowAPY = 1500;   // 15%

  console.log("\nDeploying BankLendingPool...");
  console.log("  Domain:", domain);
  console.log("  USDT:", usdtAddress);
  console.log("  Deposit APY:", depositAPY / 100, "%");
  console.log("  Borrow APY:", borrowAPY / 100, "%");

  const storageAddress = isMainnet ? STORAGE_ADDRESS_BSC : STORAGE_ADDRESS_BSC_TESTNET;
  console.log("  Storage:", storageAddress);

  const BankLendingPool = await ethers.getContractFactory("BankLendingPool");
  const pool = await BankLendingPool.deploy(
    domain,
    usdtAddress,
    depositAPY,
    borrowAPY,
    storageAddress
  );
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();
  console.log("\nBankLendingPool deployed:", poolAddress);

  // Setup collateral
  console.log("\nSetting up BNB collateral (LTV: 75%)...");
  const tx = await pool.setCollateral(wbnbAddress, bnbFeedAddress, 75);
  await tx.wait();
  console.log("BNB collateral configured");

  if (isMainnet) {
    console.log("\nSetting up ETH collateral (LTV: 70%)...");
    const tx2 = await pool.setCollateral(
      BSC_MAINNET_TOKENS.WETH,
      BSC_MAINNET_FEEDS.WETH,
      70
    );
    await tx2.wait();
    console.log("ETH collateral configured");
  }

  console.log("\n=== Deployment Summary ===");
  console.log("Network:", network.name);
  console.log("BankLendingPool:", poolAddress);
  console.log("Deposit Token (USDT):", usdtAddress);
  console.log("WBNB Collateral:", wbnbAddress);
  console.log("BNB/USD Feed:", bnbFeedAddress);
  console.log("Domain:", domain);
  console.log("\nNext steps:");
  console.log("1. Go to Storage admin panel and set poolAddress for domain:", domain);
  console.log("   poolAddress:", poolAddress);
  console.log("2. Fund the pool with initial USDT liquidity");
  console.log("3. Update frontend constants/addresses.ts with deployed address");
  if (isTestnet) {
    console.log("\n4. To verify: npx hardhat verify --network", network.name, poolAddress,
      `"${domain}"`, usdtAddress, depositAPY, borrowAPY);
  }

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    poolAddress,
    usdtAddress,
    wbnbAddress,
    bnbFeedAddress,
    domain,
    depositAPY,
    borrowAPY,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };
  console.log("\nDeployment info:", JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
