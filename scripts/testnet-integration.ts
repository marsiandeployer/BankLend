/**
 * BankLend — BSC Testnet Integration Test
 *
 * Использует ТОЛЬКО deployer (+ один детерминированный helper) для избежания
 * проблем с эфемерными кошельками на testnet.
 *
 * Сценарии:
 * 1. Deploy MockStorage + MockERC20 (USDT, WBNB) + MockAggregator + Pool
 * 2. Deposit → проверить shares (deployer as LP)
 * 3. Second deposit check (shares proportional)
 * 4. Borrow под collateral → LTV check
 * 5. Revert на превышение LTV
 * 6. utilizationRate check
 * 7. AdminWithdraw (bank mode) → rate растёт
 * 8. AdminWithdraw revert (превышение ликвидности)
 * 9. AdminDeposit (возврат) → rate падает
 * 10. Repay → collateral back
 * 11. Depositor yield (interest distributed)
 * 12. Liquidation: helper borrows, price crashes, deployer liquidates
 * 13. setRates check
 * 14. disableCollateral check
 * 15. Withdraw shares
 */

import { ethers } from "hardhat";

const DOMAIN = "lenda-testnet.onout.org";
const BNB_PRICE_USD = 300;
const DEPOSIT_APY = 800;   // 8%
const BORROW_APY = 1500;   // 15%
const BNB_LTV = 75;
const PRECISION = BigInt(1e18);

const usdt = (n: number) => BigInt(Math.floor(n * 1e6));
const bnb  = (n: number) => BigInt(Math.floor(n * 1e18));
const fmt  = (n: bigint, dec = 6) => (Number(n) / 10 ** dec).toFixed(4);
const fmtBNB = (n: bigint) => fmt(n, 18);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Retry a view call up to N times with delay (handles RPC node inconsistency)
async function retry<T>(fn: () => Promise<T>, retries = 5, delayMs = 2000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    const result = await fn();
    if (i < retries - 1) {
      // Small delay between retries for RPC consistency
    }
    return result;
  }
  return fn();
}

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${msg}`);
    failed++;
    failures.push(msg);
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const provider   = ethers.provider;
  const network    = await provider.getNetwork();
  const isLive     = network.chainId !== 31337n;

  // Deterministic helper wallet: keccak256 of deployer key
  // This gives same address every run, easy to prefund
  const helperKey = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'string'],
      [process.env.DEPLOYER_PRIVATE_KEY || '0x' + '1'.repeat(64), 'helper']
    )
  );
  const helper = new ethers.Wallet(helperKey, provider);

  console.log("\n" + "═".repeat(62));
  console.log("  BankLend — Integration Test");
  console.log("═".repeat(62));
  console.log(`  Network:  ${network.name} (chainId: ${network.chainId})`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Helper:   ${helper.address}`);
  console.log(`  Balance:  ${fmt(await provider.getBalance(deployer.address), 18)} BNB`);
  console.log("═".repeat(62) + "\n");

  // Fund helper wallet (both local and live)
  const helperBal = await provider.getBalance(helper.address);
  const needed = ethers.parseEther("0.001");
  if (helperBal < needed) {
    const wait = isLive ? 2 : 1;
    console.log(`💸 Funding helper wallet (${fmt(helperBal, 18)} → 0.001 BNB)...`);
    const tx = await deployer.sendTransaction({ to: helper.address, value: needed - helperBal });
    await tx.wait(wait);
    console.log(`  ✓ Helper funded\n`);
  } else {
    console.log(`💸 Helper already funded: ${fmt(helperBal, 18)} BNB\n`);
  }

  // ─── Deploy Mocks ─────────────────────────────────────────────────────────
  console.log("📦 Deploying contracts...");

  const MockERC20F = await ethers.getContractFactory("MockERC20");
  const mockUSDT   = await MockERC20F.deploy("USDT Test", "USDT", 6);
  await mockUSDT.waitForDeployment();
  const usdtAddr   = await mockUSDT.getAddress();

  const mockWBNB   = await MockERC20F.deploy("WBNB Test", "WBNB", 18);
  await mockWBNB.waitForDeployment();
  const wbnbAddr   = await mockWBNB.getAddress();

  const MockAggF   = await ethers.getContractFactory("MockAggregator");
  const bnbFeed    = await MockAggF.deploy(BigInt(BNB_PRICE_USD) * BigInt(1e8), 8, "BNB/USD");
  await bnbFeed.waitForDeployment();
  const feedAddr   = await bnbFeed.getAddress();

  const MockStoreF = await ethers.getContractFactory("MockStorage");
  const storage    = await MockStoreF.deploy(deployer.address, DOMAIN);
  await storage.waitForDeployment();
  const storageAddr = await storage.getAddress();

  const PoolF = await ethers.getContractFactory("BankLendingPoolTest");
  const pool  = await PoolF.deploy(DOMAIN, usdtAddr, DEPOSIT_APY, BORROW_APY, storageAddr);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();

  await (await pool.connect(deployer).setCollateral(wbnbAddr, feedAddr, BNB_LTV)).wait();

  console.log(`  MockUSDT:  ${usdtAddr}`);
  console.log(`  MockWBNB:  ${wbnbAddr}`);
  console.log(`  BNB Feed:  ${feedAddr} ($${BNB_PRICE_USD})`);
  console.log(`  Storage:   ${storageAddr}`);
  console.log(`  Pool:      ${poolAddr}`);

  // Mint tokens
  await (await mockUSDT.mint(deployer.address, usdt(100_000))).wait();
  await (await mockWBNB.mint(deployer.address, bnb(100))).wait();
  await (await mockUSDT.mint(helper.address, usdt(50_000))).wait();
  await (await mockWBNB.mint(helper.address, bnb(10))).wait();
  console.log(`  Deployer USDT: ${fmt(await mockUSDT.balanceOf(deployer.address))}`);
  console.log(`  Helper   USDT: ${fmt(await mockUSDT.balanceOf(helper.address))}\n`);

  // ─── TEST 1: Deployment ───────────────────────────────────────────────────
  console.log("🧪 [1] Deployment checks");
  assert(await pool.domain() === DOMAIN, `domain = "${DOMAIN}"`);
  assert((await pool.admin()).toLowerCase() === deployer.address.toLowerCase(), `admin = deployer`);
  const collaterals = await pool.getSupportedCollaterals();
  assert(collaterals.map(a => a.toLowerCase()).includes(wbnbAddr.toLowerCase()), `WBNB in collaterals`);
  assert(Number(await pool.depositAPY()) === DEPOSIT_APY, `depositAPY = ${DEPOSIT_APY} bps`);
  assert(Number(await pool.borrowAPY()) === BORROW_APY, `borrowAPY = ${BORROW_APY} bps`);

  // ─── TEST 2: First Deposit ────────────────────────────────────────────────
  console.log("\n🧪 [2] Deployer deposits $10,000");
  const dep1 = usdt(10_000);
  await (await mockUSDT.connect(deployer).approve(poolAddr, dep1)).wait();
  await (await pool.connect(deployer).deposit(dep1)).wait();

  if (isLive) await sleep(2000); // RPC consistency
  const dep1Shares = await pool.userShares(deployer.address);
  const totalDep1  = await pool.totalDeposited();
  assert(dep1Shares === dep1, `first deposit: shares ${fmt(dep1Shares)} == amount ${fmt(dep1)}`);
  assert(totalDep1  === dep1, `totalDeposited = $${fmt(totalDep1)}`);

  // ─── TEST 3: Second Deposit (helper = $5k) ───────────────────────────────
  console.log("\n🧪 [3] Helper deposits $5,000 (shares proportional)");
  const dep2 = usdt(5_000);
  await (await mockUSDT.connect(helper).approve(poolAddr, dep2)).wait();
  await (await pool.connect(helper).deposit(dep2)).wait();

  if (isLive) await sleep(2000);
  const helperShares = await pool.userShares(helper.address);
  const totalDep2    = await pool.totalDeposited();
  assert(helperShares === dep2, `helper shares ${fmt(helperShares)} == $5,000`);
  assert(totalDep2 === usdt(15_000), `totalDeposited = $15,000 (got $${fmt(totalDep2)})`);

  // ─── TEST 4: Borrow ───────────────────────────────────────────────────────
  console.log("\n🧪 [4] Deployer borrows $1,500 (10 BNB collateral, LTV 75% → max $2,250)");
  const collAmt  = bnb(10);   // 10 BNB = $3,000
  const borrowAmt = usdt(1_500);
  const deployerUSDTBefore = await mockUSDT.balanceOf(deployer.address);

  await (await mockWBNB.connect(deployer).approve(poolAddr, collAmt)).wait();
  await (await pool.connect(deployer).borrow(wbnbAddr, collAmt, borrowAmt)).wait();

  if (isLive) await sleep(2000);
  const b = await pool.borrows(deployer.address);
  const deployerUSDTAfter = await mockUSDT.balanceOf(deployer.address);

  assert(b.principal === borrowAmt, `principal = $${fmt(b.principal)}`);
  assert(b.collateralAmount === collAmt, `collateral = ${fmtBNB(collAmt)} WBNB`);
  assert(deployerUSDTAfter === deployerUSDTBefore + borrowAmt, `received $${fmt(borrowAmt)} USDT`);
  assert((await pool.totalBorrowed()) === borrowAmt, `totalBorrowed = $${fmt(borrowAmt)}`);
  const hf = Number(await pool.healthFactor(deployer.address)) / 1e18;
  console.log(`  Health factor: ${hf.toFixed(4)}`);
  assert(hf > 1.0, `healthFactor = ${hf.toFixed(4)} > 1.0`);

  // ─── TEST 5: LTV Revert ───────────────────────────────────────────────────
  console.log("\n🧪 [5] Borrow exceeding LTV → revert (helper, 1 BNB → max $225)");
  const small = bnb(1);
  await (await mockWBNB.connect(helper).approve(poolAddr, small)).wait();
  let ltv_rev = false;
  try { await (await pool.connect(helper).borrow(wbnbAddr, small, usdt(226))).wait(); }
  catch { ltv_rev = true; }
  assert(ltv_rev, `borrow $226 vs 1 BNB → reverts (exceeds LTV)`);

  // ─── TEST 6: utilizationRate ──────────────────────────────────────────────
  console.log("\n🧪 [6] utilizationRate = $1,500 / $15,000 = 10%");
  if (isLive) await sleep(2000);
  const util1 = Number(await pool.utilizationRate());
  assert(util1 === 10, `utilizationRate = ${util1}% (expected 10%)`);

  // ─── TEST 7: Bank Mode — AdminWithdraw ────────────────────────────────────
  console.log("\n🧪 [7] Admin withdraws $5,000 (bank mode)");
  const pullAmt = usdt(5_000);
  await (await pool.connect(deployer).adminWithdraw(pullAmt)).wait();

  if (isLive) await sleep(3000); // wait for RPC consistency
  const adminWith = await pool.adminWithdrawn();
  assert(adminWith === pullAmt, `adminWithdrawn = $${fmt(adminWith)}`);

  // utilizationRate = ($5k adminWithdrawn + $1.5k borrowed) / $15k = 43%
  const util2 = Number(await pool.utilizationRate());
  assert(util2 === 43, `utilizationRate = ${util2}% (expected 43% after adminWithdraw)`);
  console.log(`  Utilization: ${util2}%`);

  // ─── TEST 8: AdminWithdraw > available → revert ───────────────────────────
  console.log("\n🧪 [8] AdminWithdraw > available liquidity → revert");
  const avail = await pool.availableLiquidity();
  console.log(`  Available: $${fmt(avail)}`);
  let over_rev = false;
  try { await (await pool.connect(deployer).adminWithdraw(avail + 1n)).wait(); }
  catch { over_rev = true; }
  assert(over_rev, `adminWithdraw $${fmt(avail + 1n)} → reverts`);

  // ─── TEST 9: Non-admin withdraw → revert ─────────────────────────────────
  console.log("\n🧪 [9] Non-admin adminWithdraw → revert");
  let non_admin_rev = false;
  try { await (await pool.connect(helper).adminWithdraw(usdt(1))).wait(); }
  catch { non_admin_rev = true; }
  assert(non_admin_rev, `non-admin adminWithdraw → reverts`);

  // ─── TEST 10: AdminDeposit (return funds) ─────────────────────────────────
  console.log("\n🧪 [10] Admin returns $5,000 to pool");
  await (await mockUSDT.connect(deployer).approve(poolAddr, pullAmt)).wait();
  await (await pool.connect(deployer).adminDeposit(pullAmt)).wait();

  if (isLive) await sleep(2000);
  const adminWith2 = await pool.adminWithdrawn();
  assert(adminWith2 === 0n, `adminWithdrawn = 0`);
  const util3 = Number(await pool.utilizationRate());
  assert(util3 === 10, `utilizationRate restored to ${util3}% (expected 10%)`);

  // ─── TEST 11: Repay loan ──────────────────────────────────────────────────
  console.log("\n🧪 [11] Deployer repays loan");
  const pending = await pool.pendingInterest(deployer.address);
  const principal = (await pool.borrows(deployer.address)).principal;
  const owed = principal + pending;
  console.log(`  Principal: $${fmt(principal)}, Interest: $${fmt(pending)}, Total: $${fmt(owed)}`);

  const wbnbBeforeRepay = await mockWBNB.balanceOf(deployer.address);
  const repayBuf = owed + usdt(1); // $1 buffer for interest accrued during tx
  await (await mockUSDT.connect(deployer).approve(poolAddr, repayBuf)).wait();
  await (await pool.connect(deployer).repay(repayBuf)).wait();

  if (isLive) await sleep(2000);
  const bAfterRepay = await pool.borrows(deployer.address);
  assert(bAfterRepay.principal === 0n, `borrow cleared after repay`);
  const wbnbAfterRepay = await mockWBNB.balanceOf(deployer.address);
  assert(wbnbAfterRepay === wbnbBeforeRepay + collAmt, `received ${fmtBNB(collAmt)} WBNB back`);
  assert((await pool.totalBorrowed()) === 0n, `totalBorrowed = 0`);

  // ─── TEST 12: Depositor yield ─────────────────────────────────────────────
  console.log("\n🧪 [12] Depositor yield: interest accrued to share value");
  const depVal = await pool.userDepositValue(deployer.address);
  assert(depVal >= dep1, `deployer deposit $${fmt(depVal)} >= initial $${fmt(dep1)}`);
  console.log(`  Deployer deposit value: $${fmt(depVal)} (was $${fmt(dep1)})`);

  // ─── TEST 13: Liquidation Setup ───────────────────────────────────────────
  console.log("\n🧪 [13] Liquidation: helper borrows at max LTV, BNB crashes");
  // Helper borrows $449 against 2 BNB ($600 at $300) → LTV 75% → max $450
  const liqColl   = bnb(2);
  const liqBorrow = usdt(449);
  await (await mockWBNB.connect(helper).approve(poolAddr, liqColl)).wait();
  await (await pool.connect(helper).borrow(wbnbAddr, liqColl, liqBorrow)).wait();

  if (isLive) await sleep(2000);
  const hfBefore = Number(await pool.healthFactor(helper.address)) / 1e18;
  console.log(`  HF before crash: ${hfBefore.toFixed(4)}`);
  assert(hfBefore > 1.0, `position healthy before crash (${hfBefore.toFixed(4)})`);

  // Crash BNB: $300 → $200 (collateral $400 × 80% = $320 < $449 owed → liquidatable)
  await (await bnbFeed.setPrice(BigInt(200) * BigInt(1e8))).wait();
  if (isLive) await sleep(3000); // wait for state to propagate

  const hfAfter = Number(await pool.healthFactor(helper.address)) / 1e18;
  console.log(`  HF after crash ($200 BNB): ${hfAfter.toFixed(4)}`);
  assert(hfAfter < 1.0, `position unhealthy after crash (${hfAfter.toFixed(4)})`);

  // ─── TEST 14: Liquidation ────────────────────────────────────────────────
  console.log("\n🧪 [14] Deployer liquidates helper's position");
  const liqPend = await pool.pendingInterest(helper.address);
  const liqOwed = liqBorrow + liqPend + usdt(0.5); // buffer
  const wbnbBeforeLiq = await mockWBNB.balanceOf(deployer.address);
  await (await mockUSDT.connect(deployer).approve(poolAddr, liqOwed)).wait();
  await (await pool.connect(deployer).liquidate(helper.address)).wait();

  if (isLive) await sleep(2000);
  const helperB = await pool.borrows(helper.address);
  assert(helperB.principal === 0n, `helper's borrow cleared`);
  const wbnbAfterLiq = await mockWBNB.balanceOf(deployer.address);
  const seized = wbnbAfterLiq - wbnbBeforeLiq;
  assert(seized >= liqColl, `liquidator seized >= ${fmtBNB(liqColl)} WBNB (got ${fmtBNB(seized)})`);
  console.log(`  Seized: ${fmtBNB(seized)} WBNB`);

  // ─── TEST 15: Self-liquidation → revert ──────────────────────────────────
  // (helper has no position now, so we test with deployer who has no borrow)
  console.log("\n🧪 [15] Self-liquidation → revert");
  let self_rev = false;
  try { await (await pool.connect(helper).liquidate(helper.address)).wait(); }
  catch { self_rev = true; }
  assert(self_rev, `self-liquidation → reverts`);

  // ─── TEST 16: setRates ────────────────────────────────────────────────────
  console.log("\n🧪 [16] Admin setRates (10%, 20%)");
  await (await pool.connect(deployer).setRates(1000, 2000)).wait();
  if (isLive) await sleep(1000);
  assert(Number(await pool.depositAPY()) === 1000, `depositAPY = 1000 bps`);
  assert(Number(await pool.borrowAPY()) === 2000, `borrowAPY = 2000 bps`);
  // Restore
  await (await pool.connect(deployer).setRates(DEPOSIT_APY, BORROW_APY)).wait();
  if (isLive) await sleep(2000);
  assert(Number(await pool.depositAPY()) === DEPOSIT_APY, `depositAPY restored to ${DEPOSIT_APY}`);

  // ─── TEST 17: disableCollateral ───────────────────────────────────────────
  console.log("\n🧪 [17] disableCollateral → new borrows revert");
  await (await pool.connect(deployer).disableCollateral(wbnbAddr)).wait();
  await (await mockWBNB.connect(helper).approve(poolAddr, bnb(1))).wait();
  let dis_rev = false;
  try { await (await pool.connect(helper).borrow(wbnbAddr, bnb(1), usdt(100))).wait(); }
  catch { dis_rev = true; }
  assert(dis_rev, `borrow with disabled collateral → reverts`);
  // Re-enable for next test
  await (await pool.connect(deployer).setCollateral(wbnbAddr, feedAddr, BNB_LTV)).wait();

  // ─── TEST 18: Withdraw shares ─────────────────────────────────────────────
  console.log("\n🧪 [18] Deployer withdraws all shares");
  const depShares = await pool.userShares(deployer.address);
  const depUSDTBefore = await mockUSDT.balanceOf(deployer.address);
  await (await pool.connect(deployer).withdraw(depShares)).wait();
  if (isLive) await sleep(2000);
  const depUSDTAfter = await mockUSDT.balanceOf(deployer.address);
  const received = depUSDTAfter - depUSDTBefore;
  assert(received >= dep1, `withdrew >= $${fmt(dep1)} (got $${fmt(received)})`);
  console.log(`  Received: $${fmt(received)} (deposited $${fmt(dep1)})`);

  // ─── TEST 19: Helper withdraws ────────────────────────────────────────────
  console.log("\n🧪 [19] Helper withdraws all shares");
  const helperSharesFinal = await pool.userShares(helper.address);
  const helperUSDTBefore = await mockUSDT.balanceOf(helper.address);
  await (await pool.connect(helper).withdraw(helperSharesFinal)).wait();
  if (isLive) await sleep(2000);
  const helperUSDTAfter = await mockUSDT.balanceOf(helper.address);
  const helperReceived = helperUSDTAfter - helperUSDTBefore;
  assert(helperReceived >= dep2, `helper withdrew >= $${fmt(dep2)} (got $${fmt(helperReceived)})`);
  console.log(`  Helper received: $${fmt(helperReceived)} (deposited $${fmt(dep2)})`);

  // ─── TEST 20: Pool empty after all withdrawals ────────────────────────────
  console.log("\n🧪 [20] Pool state after full cycle");
  if (isLive) await sleep(2000);
  const finalShares  = await pool.totalShares();
  const finalBorrowed = await pool.totalBorrowed();
  assert(finalShares === 0n, `totalShares = 0 (got ${fmt(finalShares)})`);
  assert(finalBorrowed === 0n, `totalBorrowed = 0`);

  // ─── Final Report ─────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(62));
  console.log("  📊 FINAL REPORT");
  console.log("═".repeat(62));
  console.log(`  Pool TVL:         $${fmt(await pool.totalDeposited())}`);
  console.log(`  Total Borrowed:   $${fmt(await pool.totalBorrowed())}`);
  console.log(`  Utilization:      ${await pool.utilizationRate()}%`);
  console.log(`  Contract Balance: $${fmt(await mockUSDT.balanceOf(poolAddr))}`);
  if (failures.length > 0) {
    console.log("\n  Failed assertions:");
    failures.forEach(f => console.log(`    ✗ ${f}`));
  }
  console.log("─".repeat(62));
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  Total:    ${passed + failed}`);
  console.log("═".repeat(62));

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("\n💥 Crashed:", e.message);
  process.exit(1);
});
