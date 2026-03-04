import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import type { BankLendingPool, MockERC20, MockAggregator, MockStorage } from "../typechain-types";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("BankLendingPool", function () {
  let pool: BankLendingPool;
  let usdt: MockERC20;
  let wbnb: MockERC20; // wrapped BNB as collateral token
  let bnbFeed: MockAggregator;
  let storage: MockStorage;

  let admin: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let liquidator: SignerWithAddress;

  const DOMAIN = "lenda.onout.org";
  const DEPOSIT_APY = 800;   // 8%
  const BORROW_APY = 1500;   // 15%
  const BNB_LTV = 75;        // 75%
  const BNB_PRICE_USD = 300; // $300 per BNB (8 decimals like Chainlink)
  const BNB_PRICE = BigInt(BNB_PRICE_USD) * BigInt(1e8);

  // Helper: 6 decimals for USDT
  const usdtAmount = (n: number) => BigInt(n) * BigInt(1e6);
  // Helper: 18 decimals for WBNB
  const bnbAmount = (n: number) => BigInt(n) * BigInt(1e18);

  beforeEach(async function () {
    [admin, alice, bob, liquidator] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    usdt = await MockERC20Factory.deploy("USDT", "USDT", 6) as MockERC20;
    wbnb = await MockERC20Factory.deploy("Wrapped BNB", "WBNB", 18) as MockERC20;

    // Deploy mock price feed: BNB/USD $300, 8 decimals
    const MockAggFactory = await ethers.getContractFactory("MockAggregator");
    bnbFeed = await MockAggFactory.deploy(BNB_PRICE, 8, "BNB/USD") as MockAggregator;

    // Deploy mock Storage with admin as owner
    const MockStorageFactory = await ethers.getContractFactory("MockStorage");
    storage = await MockStorageFactory.deploy(admin.address, DOMAIN) as MockStorage;

    // Deploy pool — override STORAGE constant is not possible without linking
    // For local tests we use a modified BankLendingPool with configurable storage
    // (see BankLendingPoolTest helper below or deploy with constructor arg)
    // Since the real contract uses a constant, we test logic with deployed mocks
    // and verify via pool's admin() which reads from storage

    // For testing we deploy a test variant that accepts storage address
    const PoolFactory = await ethers.getContractFactory("BankLendingPoolTest");
    pool = await PoolFactory.deploy(
      DOMAIN,
      await usdt.getAddress(),
      DEPOSIT_APY,
      BORROW_APY,
      await storage.getAddress()
    ) as unknown as BankLendingPool;

    // Setup collateral
    await pool.connect(admin).setCollateral(
      await wbnb.getAddress(),
      await bnbFeed.getAddress(),
      BNB_LTV
    );

    // Mint USDT for participants
    await usdt.mint(alice.address, usdtAmount(10_000));
    await usdt.mint(bob.address, usdtAmount(5_000));
    await usdt.mint(liquidator.address, usdtAmount(50_000));

    // Mint WBNB for borrowers
    await wbnb.mint(bob.address, bnbAmount(100));
    await wbnb.mint(alice.address, bnbAmount(10));
  });

  // ─── Deploy & Setup ────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("should set domain and tokens correctly", async function () {
      expect(await pool.domain()).to.equal(DOMAIN);
      expect(await pool.depositToken()).to.equal(await usdt.getAddress());
      expect(await pool.depositAPY()).to.equal(DEPOSIT_APY);
      expect(await pool.borrowAPY()).to.equal(BORROW_APY);
    });

    it("should read admin from Storage", async function () {
      expect(await pool.admin()).to.equal(admin.address);
    });

    it("should list BNB as supported collateral", async function () {
      const collaterals = await pool.getSupportedCollaterals();
      expect(collaterals).to.include(await wbnb.getAddress());
    });
  });

  // ─── Deposit ───────────────────────────────────────────────────────────────

  describe("Deposit", function () {
    it("first deposit: shares = amount", async function () {
      await usdt.connect(alice).approve(await pool.getAddress(), usdtAmount(1_000));
      await pool.connect(alice).deposit(usdtAmount(1_000));

      expect(await pool.userShares(alice.address)).to.equal(usdtAmount(1_000));
      expect(await pool.totalShares()).to.equal(usdtAmount(1_000));
      expect(await pool.totalDeposited()).to.equal(usdtAmount(1_000));
    });

    it("second deposit: shares proportional to totalDeposited", async function () {
      // Alice deposits 1000
      await usdt.connect(alice).approve(await pool.getAddress(), usdtAmount(1_000));
      await pool.connect(alice).deposit(usdtAmount(1_000));

      // Bob deposits 500
      await usdt.connect(bob).approve(await pool.getAddress(), usdtAmount(500));
      await pool.connect(bob).deposit(usdtAmount(500));

      // Bob should have 500 shares (50% of 1500 total pool = 500 shares)
      expect(await pool.userShares(bob.address)).to.equal(usdtAmount(500));
      expect(await pool.totalShares()).to.equal(usdtAmount(1_500));
    });

    it("emit Deposit event", async function () {
      await usdt.connect(alice).approve(await pool.getAddress(), usdtAmount(100));
      await expect(pool.connect(alice).deposit(usdtAmount(100)))
        .to.emit(pool, "Deposit")
        .withArgs(alice.address, usdtAmount(100), usdtAmount(100));
    });

    it("revert on zero amount", async function () {
      await expect(pool.connect(alice).deposit(0))
        .to.be.revertedWith("BankLend: zero amount");
    });
  });

  // ─── Withdraw ──────────────────────────────────────────────────────────────

  describe("Withdraw", function () {
    beforeEach(async function () {
      await usdt.connect(alice).approve(await pool.getAddress(), usdtAmount(1_000));
      await pool.connect(alice).deposit(usdtAmount(1_000));
    });

    it("full withdrawal returns original amount (no interest yet)", async function () {
      const sharesBefore = await pool.userShares(alice.address);
      const balanceBefore = await usdt.balanceOf(alice.address);

      await pool.connect(alice).withdraw(sharesBefore);

      expect(await pool.userShares(alice.address)).to.equal(0);
      expect(await usdt.balanceOf(alice.address)).to.equal(balanceBefore + usdtAmount(1_000));
    });

    it("partial withdrawal", async function () {
      const halfShares = (await pool.userShares(alice.address)) / 2n;
      await pool.connect(alice).withdraw(halfShares);
      expect(await pool.userShares(alice.address)).to.equal(halfShares);
    });

    it("revert on insufficient shares", async function () {
      const shares = await pool.userShares(alice.address);
      await expect(pool.connect(alice).withdraw(shares + 1n))
        .to.be.revertedWith("BankLend: insufficient shares");
    });

    it("revert on insufficient liquidity (all borrowed)", async function () {
      // Bob borrows most of pool
      await wbnb.connect(bob).approve(await pool.getAddress(), bnbAmount(10));
      await pool.connect(bob).borrow(
        await wbnb.getAddress(),
        bnbAmount(10), // 10 BNB = $3000 collateral
        usdtAmount(500) // borrow $500 (< $3000 * 75% = $2250)
      );

      // Admin withdraws remaining
      await pool.connect(admin).adminWithdraw(usdtAmount(499)); // leaves only $1

      // Alice can't withdraw 1000
      const shares = await pool.userShares(alice.address);
      await expect(pool.connect(alice).withdraw(shares))
        .to.be.revertedWith("BankLend: insufficient liquidity");
    });
  });

  // ─── Borrow ────────────────────────────────────────────────────────────────

  describe("Borrow", function () {
    beforeEach(async function () {
      // Alice provides liquidity
      await usdt.connect(alice).approve(await pool.getAddress(), usdtAmount(5_000));
      await pool.connect(alice).deposit(usdtAmount(5_000));
    });

    it("borrow within LTV succeeds", async function () {
      const collateral = bnbAmount(1); // 1 BNB = $300
      const maxBorrow = usdtAmount(225); // $300 * 75% = $225

      await wbnb.connect(bob).approve(await pool.getAddress(), collateral);
      await pool.connect(bob).borrow(
        await wbnb.getAddress(),
        collateral,
        maxBorrow
      );

      const b = await pool.borrows(bob.address);
      expect(b.principal).to.equal(maxBorrow);
      expect(b.collateralAmount).to.equal(collateral);
    });

    it("revert if exceeds LTV", async function () {
      const collateral = bnbAmount(1); // 1 BNB = $300
      const tooMuch = usdtAmount(226); // > $225 max

      await wbnb.connect(bob).approve(await pool.getAddress(), collateral);
      await expect(
        pool.connect(bob).borrow(await wbnb.getAddress(), collateral, tooMuch)
      ).to.be.revertedWith("BankLend: exceeds LTV");
    });

    it("revert on unsupported collateral", async function () {
      await expect(
        pool.connect(bob).borrow(await usdt.getAddress(), 100n, 50n)
      ).to.be.revertedWith("BankLend: collateral not supported");
    });

    it("revert on existing borrow", async function () {
      const collateral = bnbAmount(2);
      await wbnb.connect(bob).approve(await pool.getAddress(), collateral * 2n);
      await pool.connect(bob).borrow(await wbnb.getAddress(), collateral, usdtAmount(100));
      await expect(
        pool.connect(bob).borrow(await wbnb.getAddress(), collateral, usdtAmount(100))
      ).to.be.revertedWith("BankLend: existing borrow");
    });

    it("totalBorrowed increases", async function () {
      await wbnb.connect(bob).approve(await pool.getAddress(), bnbAmount(2));
      await pool.connect(bob).borrow(await wbnb.getAddress(), bnbAmount(2), usdtAmount(200));
      expect(await pool.totalBorrowed()).to.equal(usdtAmount(200));
    });
  });

  // ─── Repay ─────────────────────────────────────────────────────────────────

  describe("Repay", function () {
    beforeEach(async function () {
      await usdt.connect(alice).approve(await pool.getAddress(), usdtAmount(5_000));
      await pool.connect(alice).deposit(usdtAmount(5_000));

      await wbnb.connect(bob).approve(await pool.getAddress(), bnbAmount(5));
      await pool.connect(bob).borrow(await wbnb.getAddress(), bnbAmount(5), usdtAmount(500));
    });

    it("full repay returns collateral", async function () {
      const borrowed = usdtAmount(500);
      const wbnbBefore = await wbnb.balanceOf(bob.address);

      // Wait 1 year for interest
      await time.increase(365 * 24 * 3600);

      // Interest = 500 * 15% = 75 USDT
      const pending = await pool.pendingInterest(bob.address);
      expect(pending).to.be.approximately(usdtAmount(75), usdtAmount(1)); // ±$1 precision

      const totalOwed = borrowed + pending;
      await usdt.connect(bob).approve(await pool.getAddress(), totalOwed + usdtAmount(1));
      await pool.connect(bob).repay(totalOwed + usdtAmount(1)); // overpay is clamped

      const borrowAfter = await pool.borrows(bob.address);
      expect(borrowAfter.principal).to.equal(0n);
      expect(await wbnb.balanceOf(bob.address)).to.equal(wbnbBefore + bnbAmount(5));
    });

    it("partial repay reduces principal", async function () {
      await usdt.connect(bob).approve(await pool.getAddress(), usdtAmount(100));
      await pool.connect(bob).repay(usdtAmount(100));
      const b = await pool.borrows(bob.address);
      expect(b.principal).to.be.lessThan(usdtAmount(500));
    });

    it("interest goes to depositors (share value increases)", async function () {
      const sharesBefore = await pool.userShares(alice.address);
      const valueBefore = await pool.sharesToAmount(sharesBefore);

      // Time passes, interest accrues
      await time.increase(365 * 24 * 3600);

      // Bob repays with interest
      const pending = await pool.pendingInterest(bob.address);
      const totalOwed = usdtAmount(500) + pending;
      await usdt.connect(bob).approve(await pool.getAddress(), totalOwed);
      await pool.connect(bob).repay(totalOwed);

      const valueAfter = await pool.sharesToAmount(sharesBefore);
      expect(valueAfter).to.be.greaterThan(valueBefore);
    });
  });

  // ─── Interest Accrual ──────────────────────────────────────────────────────

  describe("Interest Accrual", function () {
    it("pendingInterest grows over time", async function () {
      await usdt.connect(alice).approve(await pool.getAddress(), usdtAmount(5_000));
      await pool.connect(alice).deposit(usdtAmount(5_000));

      await wbnb.connect(bob).approve(await pool.getAddress(), bnbAmount(5));
      await pool.connect(bob).borrow(await wbnb.getAddress(), bnbAmount(5), usdtAmount(500));

      const interestDay1 = await pool.pendingInterest(bob.address);
      await time.increase(86400); // 1 day
      const interestDay2 = await pool.pendingInterest(bob.address);

      expect(interestDay2).to.be.greaterThan(interestDay1);
    });
  });

  // ─── Admin Withdraw / Bank Mode ────────────────────────────────────────────

  describe("Bank Mode", function () {
    beforeEach(async function () {
      await usdt.connect(alice).approve(await pool.getAddress(), usdtAmount(10_000));
      await pool.connect(alice).deposit(usdtAmount(10_000));
    });

    it("admin can withdraw from pool", async function () {
      const adminBalBefore = await usdt.balanceOf(admin.address);
      await pool.connect(admin).adminWithdraw(usdtAmount(5_000));

      expect(await pool.adminWithdrawn()).to.equal(usdtAmount(5_000));
      expect(await usdt.balanceOf(admin.address)).to.equal(adminBalBefore + usdtAmount(5_000));
    });

    it("utilizationRate rises after adminWithdraw", async function () {
      expect(await pool.utilizationRate()).to.equal(0);
      await pool.connect(admin).adminWithdraw(usdtAmount(6_500));
      expect(await pool.utilizationRate()).to.equal(65); // 6500/10000 = 65%
    });

    it("admin can return funds (adminDeposit)", async function () {
      await pool.connect(admin).adminWithdraw(usdtAmount(5_000));
      await usdt.connect(admin).approve(await pool.getAddress(), usdtAmount(5_000));
      await pool.connect(admin).adminDeposit(usdtAmount(5_000));

      expect(await pool.adminWithdrawn()).to.equal(0);
      expect(await pool.utilizationRate()).to.equal(0);
    });

    it("revert if non-admin calls adminWithdraw", async function () {
      await expect(
        pool.connect(alice).adminWithdraw(usdtAmount(100))
      ).to.be.revertedWith("BankLend: not admin");
    });

    it("revert if adminWithdraw exceeds available liquidity", async function () {
      await expect(
        pool.connect(admin).adminWithdraw(usdtAmount(10_001))
      ).to.be.revertedWith("BankLend: insufficient liquidity");
    });

    it("revert if adminDeposit exceeds adminWithdrawn", async function () {
      await pool.connect(admin).adminWithdraw(usdtAmount(1_000));
      await usdt.connect(alice).approve(await pool.getAddress(), usdtAmount(2_000));
      await expect(
        pool.connect(alice).adminDeposit(usdtAmount(2_000))
      ).to.be.revertedWith("BankLend: excess return");
    });
  });

  // ─── Liquidation ───────────────────────────────────────────────────────────

  describe("Liquidation", function () {
    beforeEach(async function () {
      await usdt.connect(alice).approve(await pool.getAddress(), usdtAmount(5_000));
      await pool.connect(alice).deposit(usdtAmount(5_000));

      // Bob borrows at max LTV: 1 BNB ($300) → borrow $225
      await wbnb.connect(bob).approve(await pool.getAddress(), bnbAmount(1));
      await pool.connect(bob).borrow(
        await wbnb.getAddress(),
        bnbAmount(1),
        usdtAmount(225)
      );
    });

    it("position is healthy at $300", async function () {
      const hf = await pool.healthFactor(bob.address);
      expect(hf).to.be.greaterThanOrEqual(ethers.parseEther("1"));
    });

    it("liquidation succeeds when price crashes", async function () {
      // Crash BNB from $300 to $200 — now collateral = $200 * 80% = $160 < $225 owed
      await bnbFeed.setPrice(BigInt(200) * BigInt(1e8));

      const hf = await pool.healthFactor(bob.address);
      expect(hf).to.be.lessThan(ethers.parseEther("1"));

      const liquidatorWbnbBefore = await wbnb.balanceOf(liquidator.address);
      // Approve extra to cover small interest accrued between blocks
      const approveAmt = usdtAmount(226); // $225 principal + up to $1 interest
      await usdt.connect(liquidator).approve(await pool.getAddress(), approveAmt);
      await pool.connect(liquidator).liquidate(bob.address);

      // Liquidator should have received collateral (up to 1 BNB + 5% bonus, capped by pool balance)
      const wbnbSeized = await wbnb.balanceOf(liquidator.address) - liquidatorWbnbBefore;
      expect(wbnbSeized).to.be.greaterThanOrEqual(bnbAmount(1));
      // Borrower position cleared
      expect((await pool.borrows(bob.address)).principal).to.equal(0n);
    });

    it("revert liquidation on healthy position", async function () {
      await usdt.connect(liquidator).approve(await pool.getAddress(), usdtAmount(500));
      await expect(
        pool.connect(liquidator).liquidate(bob.address)
      ).to.be.revertedWith("BankLend: position is healthy");
    });

    it("revert self-liquidation", async function () {
      await bnbFeed.setPrice(BigInt(200) * BigInt(1e8));
      await expect(
        pool.connect(bob).liquidate(bob.address)
      ).to.be.revertedWith("BankLend: self-liquidation");
    });
  });

  // ─── Admin Settings ────────────────────────────────────────────────────────

  describe("Admin Settings", function () {
    it("setRates updates APY", async function () {
      await pool.connect(admin).setRates(1000, 2000);
      expect(await pool.depositAPY()).to.equal(1000);
      expect(await pool.borrowAPY()).to.equal(2000);
    });

    it("revert if borrow < deposit APY", async function () {
      await expect(
        pool.connect(admin).setRates(1500, 1000)
      ).to.be.revertedWith("BankLend: borrow < deposit APY");
    });

    it("disableCollateral prevents new borrows", async function () {
      await pool.connect(admin).disableCollateral(await wbnb.getAddress());
      await wbnb.connect(bob).approve(await pool.getAddress(), bnbAmount(1));
      await expect(
        pool.connect(bob).borrow(await wbnb.getAddress(), bnbAmount(1), usdtAmount(100))
      ).to.be.revertedWith("BankLend: collateral not supported");
    });
  });
});

// Helper extension for approximate equality
declare global {
  namespace Chai {
    interface Assertion {
      approximately(value: bigint, delta: bigint): void;
    }
  }
}
