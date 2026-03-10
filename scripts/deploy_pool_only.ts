import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

// Already deployed mocks on bscTestnet (from first partial deploy)
const USDT    = "0x0B4Ed842a0b6df71ba19A095DA59db772021Af8c";
const WBNB    = "0x72193591c8FFF4BEea51805346BDF8A08bbD38dF";
const FEED    = "0x745fA0Ce2f318bed5cCA4802eCf4f7F059647b13";
const STORAGE = "0xF0BCf27a2203E7E8c1e9D36F40EF2C5A8a6E7D0B"; // BSC testnet storage
const DOMAIN  = "lenda-testnet.onout.org";

const STORAGE_ABI = [
  "function getData(string key) view returns (tuple(address owner, string info))",
  "function setKeyData(string key, tuple(address owner, string info) data) external",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(bal), "BNB");

  // 1. Register domain in testnet Storage if not yet
  const storage = new ethers.Contract(STORAGE, STORAGE_ABI, deployer);
  const existing = await storage.getData(DOMAIN);
  if (existing.owner === ethers.ZeroAddress) {
    console.log("Registering domain in Storage...");
    const tx = await storage.setKeyData(DOMAIN, { owner: deployer.address, info: "{}" });
    await tx.wait();
    console.log("Domain registered:", DOMAIN, "→ owner:", deployer.address);
  } else {
    console.log("Domain already registered, owner:", existing.owner);
  }

  // 2. Deploy BankLendingPool
  console.log("\nDeploying BankLendingPool...");
  const BankLendingPool = await ethers.getContractFactory("BankLendingPool");
  const pool = await BankLendingPool.deploy(DOMAIN, USDT, 800, 1500, STORAGE);
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();
  console.log("BankLendingPool deployed:", poolAddress);

  // 3. Setup WBNB collateral
  console.log("Setting up WBNB collateral (LTV 75%)...");
  const tx2 = await pool.setCollateral(WBNB, FEED, 75);
  await tx2.wait();
  console.log("Collateral configured");

  console.log("\n=== Deployment Summary ===");
  console.log("Network:  bscTestnet (chainId 97)");
  console.log("Pool:    ", poolAddress);
  console.log("USDT:    ", USDT);
  console.log("WBNB:    ", WBNB);
  console.log("Feed:    ", FEED);
  console.log("Storage: ", STORAGE);
  console.log("Domain:  ", DOMAIN);
  console.log("Admin:   ", deployer.address);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
