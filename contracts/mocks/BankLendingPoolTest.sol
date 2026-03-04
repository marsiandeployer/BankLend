// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IStorage.sol";
import "../interfaces/AggregatorV3Interface.sol";

/// @title BankLendingPoolTest — same as BankLendingPool but with configurable Storage address
/// @notice Used for local hardhat tests where we inject MockStorage
contract BankLendingPoolTest is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant PRECISION = 1e18;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant MAX_LTV = 90;
    uint256 public constant LIQUIDATION_THRESHOLD = 80;
    uint256 public constant LIQUIDATION_BONUS = 5;

    IStorage public storageContract;
    string public domain;
    IERC20 public depositToken;

    uint256 public totalDeposited;
    uint256 public totalShares;
    mapping(address => uint256) public userShares;

    struct Borrow {
        address collateralToken;
        uint256 collateralAmount;
        uint256 principal;
        uint256 interestOwed;
        uint256 startTime;
    }
    mapping(address => Borrow) public borrows;
    uint256 public totalBorrowed;

    uint256 public adminWithdrawn;

    uint256 public depositAPY;
    uint256 public borrowAPY;
    uint256 public lastAccrualTime;

    struct CollateralConfig {
        address priceFeed;
        uint256 ltv;
        bool enabled;
    }
    mapping(address => CollateralConfig) public collateralConfigs;
    address[] public supportedCollaterals;

    event Deposit(address indexed user, uint256 amount, uint256 shares);
    event Withdraw(address indexed user, uint256 shares, uint256 amount);
    event BorrowOpened(address indexed user, address collateral, uint256 collateralAmt, uint256 borrowAmt);
    event Repay(address indexed user, uint256 repayAmt, uint256 collateralReturned);
    event Liquidate(address indexed borrower, address indexed liquidator, uint256 repayAmt, uint256 collateralSeized);
    event AdminWithdraw(address indexed admin, uint256 amount);
    event AdminDeposit(address indexed sender, uint256 amount);
    event RatesUpdated(uint256 depositAPY, uint256 borrowAPY);
    event CollateralAdded(address indexed token, address priceFeed, uint256 ltv);
    event CollateralUpdated(address indexed token, uint256 ltv, bool enabled);

    modifier onlyAdmin() {
        require(
            msg.sender == storageContract.getData(domain).owner,
            "BankLend: not admin"
        );
        _;
    }

    constructor(
        string memory _domain,
        address _depositToken,
        uint256 _depositAPY,
        uint256 _borrowAPY,
        address _storage
    ) {
        require(_depositToken != address(0), "BankLend: zero token");
        require(_depositAPY <= 10000, "BankLend: deposit APY too high");
        require(_borrowAPY <= 10000, "BankLend: borrow APY too high");
        require(_borrowAPY >= _depositAPY, "BankLend: borrow < deposit APY");

        domain = _domain;
        depositToken = IERC20(_depositToken);
        depositAPY = _depositAPY;
        borrowAPY = _borrowAPY;
        storageContract = IStorage(_storage);
        lastAccrualTime = block.timestamp;
    }

    function setCollateral(address token, address priceFeed, uint256 ltv) external onlyAdmin {
        require(token != address(0), "BankLend: zero token");
        require(priceFeed != address(0), "BankLend: zero feed");
        require(ltv > 0 && ltv <= MAX_LTV, "BankLend: invalid LTV");
        if (!collateralConfigs[token].enabled) {
            supportedCollaterals.push(token);
            emit CollateralAdded(token, priceFeed, ltv);
        } else {
            emit CollateralUpdated(token, ltv, true);
        }
        collateralConfigs[token] = CollateralConfig({ priceFeed: priceFeed, ltv: ltv, enabled: true });
    }

    function disableCollateral(address token) external onlyAdmin {
        collateralConfigs[token].enabled = false;
        emit CollateralUpdated(token, collateralConfigs[token].ltv, false);
    }

    function setRates(uint256 _depositAPY, uint256 _borrowAPY) external onlyAdmin {
        require(_depositAPY <= 10000, "BankLend: deposit APY too high");
        require(_borrowAPY <= 10000, "BankLend: borrow APY too high");
        require(_borrowAPY >= _depositAPY, "BankLend: borrow < deposit APY");
        _accrueInterest();
        depositAPY = _depositAPY;
        borrowAPY = _borrowAPY;
        emit RatesUpdated(_depositAPY, _borrowAPY);
    }

    function adminWithdraw(uint256 amount) external onlyAdmin nonReentrant {
        require(amount > 0, "BankLend: zero amount");
        require(amount <= availableLiquidity(), "BankLend: insufficient liquidity");
        adminWithdrawn += amount;
        depositToken.safeTransfer(msg.sender, amount);
        emit AdminWithdraw(msg.sender, amount);
    }

    function adminDeposit(uint256 amount) external nonReentrant {
        require(amount > 0, "BankLend: zero amount");
        require(amount <= adminWithdrawn, "BankLend: excess return");
        depositToken.safeTransferFrom(msg.sender, address(this), amount);
        adminWithdrawn -= amount;
        emit AdminDeposit(msg.sender, amount);
    }

    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "BankLend: zero amount");
        _accrueInterest();
        uint256 shares;
        if (totalShares == 0 || totalDeposited == 0) {
            shares = amount;
        } else {
            shares = (amount * totalShares) / totalDeposited;
        }
        require(shares > 0, "BankLend: zero shares");
        depositToken.safeTransferFrom(msg.sender, address(this), amount);
        totalDeposited += amount;
        totalShares += shares;
        userShares[msg.sender] += shares;
        emit Deposit(msg.sender, amount, shares);
    }

    function withdraw(uint256 shares) external nonReentrant {
        require(shares > 0, "BankLend: zero shares");
        require(userShares[msg.sender] >= shares, "BankLend: insufficient shares");
        _accrueInterest();
        uint256 amount = (shares * totalDeposited) / totalShares;
        require(amount > 0, "BankLend: zero amount");
        require(amount <= availableLiquidity(), "BankLend: insufficient liquidity");
        userShares[msg.sender] -= shares;
        totalShares -= shares;
        totalDeposited -= amount;
        depositToken.safeTransfer(msg.sender, amount);
        emit Withdraw(msg.sender, shares, amount);
    }

    function borrow(address collateralToken, uint256 collateralAmount, uint256 borrowAmount) external nonReentrant {
        require(borrowAmount > 0, "BankLend: zero amount");
        require(borrows[msg.sender].principal == 0, "BankLend: existing borrow");
        CollateralConfig memory cfg = collateralConfigs[collateralToken];
        require(cfg.enabled, "BankLend: collateral not supported");
        uint256 collateralUSD = _getCollateralUSD(collateralToken, collateralAmount);
        uint256 maxBorrow = (collateralUSD * cfg.ltv) / 100;
        require(borrowAmount <= maxBorrow, "BankLend: exceeds LTV");
        require(borrowAmount <= availableLiquidity(), "BankLend: insufficient liquidity");
        _accrueInterest();
        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), collateralAmount);
        borrows[msg.sender] = Borrow({
            collateralToken: collateralToken,
            collateralAmount: collateralAmount,
            principal: borrowAmount,
            interestOwed: 0,
            startTime: block.timestamp
        });
        totalBorrowed += borrowAmount;
        depositToken.safeTransfer(msg.sender, borrowAmount);
        emit BorrowOpened(msg.sender, collateralToken, collateralAmount, borrowAmount);
    }

    function repay(uint256 amount) external nonReentrant {
        Borrow storage b = borrows[msg.sender];
        require(b.principal > 0, "BankLend: no borrow");
        _accrueBorrowerInterest(msg.sender);
        uint256 totalOwed = b.principal + b.interestOwed;
        uint256 repayAmount = amount > totalOwed ? totalOwed : amount;
        depositToken.safeTransferFrom(msg.sender, address(this), repayAmount);
        uint256 collateralReturned;
        if (repayAmount >= totalOwed) {
            collateralReturned = b.collateralAmount;
            totalBorrowed -= b.principal;
            totalDeposited += b.interestOwed;
            IERC20(b.collateralToken).safeTransfer(msg.sender, collateralReturned);
            delete borrows[msg.sender];
        } else {
            uint256 principalPaid = (repayAmount * b.principal) / totalOwed;
            uint256 interestPaid = repayAmount - principalPaid;
            b.principal -= principalPaid;
            b.interestOwed -= interestPaid;
            totalBorrowed -= principalPaid;
            totalDeposited += interestPaid;
            collateralReturned = 0;
        }
        emit Repay(msg.sender, repayAmount, collateralReturned);
    }

    function liquidate(address borrower) external nonReentrant {
        require(borrower != msg.sender, "BankLend: self-liquidation");
        require(borrows[borrower].principal > 0, "BankLend: no borrow");
        _accrueBorrowerInterest(borrower);
        require(!_isHealthy(borrower), "BankLend: position is healthy");
        Borrow memory b = borrows[borrower];
        uint256 totalOwed = b.principal + b.interestOwed;
        depositToken.safeTransferFrom(msg.sender, address(this), totalOwed);
        totalDeposited += b.interestOwed;
        totalBorrowed -= b.principal;
        uint256 bonusCollateral = (b.collateralAmount * LIQUIDATION_BONUS) / 100;
        uint256 seizedCollateral = b.collateralAmount + bonusCollateral;
        uint256 contractBalance = IERC20(b.collateralToken).balanceOf(address(this));
        if (seizedCollateral > contractBalance) seizedCollateral = contractBalance;
        delete borrows[borrower];
        IERC20(b.collateralToken).safeTransfer(msg.sender, seizedCollateral);
        emit Liquidate(borrower, msg.sender, totalOwed, seizedCollateral);
    }

    function availableLiquidity() public view returns (uint256) {
        return depositToken.balanceOf(address(this));
    }

    function utilizationRate() public view returns (uint256) {
        if (totalDeposited == 0) return 0;
        return ((adminWithdrawn + totalBorrowed) * 100) / totalDeposited;
    }

    function sharesToAmount(uint256 shares) public view returns (uint256) {
        if (totalShares == 0) return 0;
        return (shares * totalDeposited) / totalShares;
    }

    function userDepositValue(address user) external view returns (uint256) {
        return sharesToAmount(userShares[user]);
    }

    function healthFactor(address borrower) external view returns (uint256) {
        return _healthFactor(borrower);
    }

    function pendingInterest(address borrower) external view returns (uint256) {
        Borrow memory b = borrows[borrower];
        if (b.principal == 0) return 0;
        uint256 elapsed = block.timestamp - b.startTime;
        return (b.principal * borrowAPY * elapsed) / (SECONDS_PER_YEAR * 10000);
    }

    function admin() external view returns (address) {
        return storageContract.getData(domain).owner;
    }

    function getSupportedCollaterals() external view returns (address[] memory) {
        return supportedCollaterals;
    }

    function _accrueInterest() internal {
        if (totalBorrowed == 0 || block.timestamp == lastAccrualTime) {
            lastAccrualTime = block.timestamp;
            return;
        }
        uint256 elapsed = block.timestamp - lastAccrualTime;
        uint256 interestEarned = (totalBorrowed * borrowAPY * elapsed) / (SECONDS_PER_YEAR * 10000);
        totalDeposited += interestEarned;
        totalBorrowed += interestEarned;
        lastAccrualTime = block.timestamp;
    }

    function _accrueBorrowerInterest(address borrower) internal {
        Borrow storage b = borrows[borrower];
        if (b.principal == 0) return;
        uint256 elapsed = block.timestamp - b.startTime;
        uint256 interest = (b.principal * borrowAPY * elapsed) / (SECONDS_PER_YEAR * 10000);
        b.interestOwed += interest;
        b.startTime = block.timestamp;
    }

    function _getCollateralUSD(address token, uint256 amount) internal view returns (uint256) {
        CollateralConfig memory cfg = collateralConfigs[token];
        AggregatorV3Interface feed = AggregatorV3Interface(cfg.priceFeed);
        (, int256 price,,,) = feed.latestRoundData();
        require(price > 0, "BankLend: invalid price");
        uint8 feedDecimals = feed.decimals();
        uint8 tokenDecimals = _getTokenDecimals(token);
        uint256 usdValue = (amount * uint256(price)) / (10 ** (tokenDecimals + feedDecimals - 6));
        return usdValue;
    }

    function _getTokenDecimals(address token) internal view returns (uint8) {
        try IERC20Metadata(token).decimals() returns (uint8 dec) {
            return dec;
        } catch {
            return 18;
        }
    }

    function _isHealthy(address borrower) internal view returns (bool) {
        return _healthFactor(borrower) >= PRECISION;
    }

    function _healthFactor(address borrower) internal view returns (uint256) {
        Borrow memory b = borrows[borrower];
        if (b.principal == 0) return type(uint256).max;
        uint256 totalOwed = b.principal + b.interestOwed;
        if (totalOwed == 0) return type(uint256).max;
        uint256 collateralUSD = _getCollateralUSD(b.collateralToken, b.collateralAmount);
        uint256 collateralThreshold = (collateralUSD * LIQUIDATION_THRESHOLD) / 100;
        return (collateralThreshold * PRECISION) / totalOwed;
    }
}

interface IERC20Metadata {
    function decimals() external view returns (uint8);
}
