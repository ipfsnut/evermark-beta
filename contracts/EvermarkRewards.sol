// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/*
 ██████╗ ███████╗██╗    ██╗ █████╗ ██████╗ ██████╗ ███████╗
 ██╔══██╗██╔════╝██║    ██║██╔══██╗██╔══██╗██╔══██╗██╔════╝
 ██████╔╝█████╗  ██║ █╗ ██║███████║██████╔╝██║  ██║███████╗
 ██╔══██╗██╔══╝  ██║███╗██║██╔══██║██╔══██╗██║  ██║╚════██║
 ██║  ██║███████╗╚███╔███╔╝██║  ██║██║  ██║██████╔╝███████║
 ╚═╝  ╚═╝╚══════╝ ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝
*/

interface IWEMARK {
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

/**
 * @title EvermarkRewards
 * @notice Periodic adaptive dual-token rewards with stable periods
 * @dev Combines pool-percentage distribution with Synthetix-style stable periods
 */
contract EvermarkRewards is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    /* ========== ROLES ========== */

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /* ========== STATE VARIABLES ========== */

    IERC20 public emarkToken;         
    IERC20 public wethToken;          // CHANGED: Added WETH token
    IWEMARK public stakingToken; 
    
    // Adaptive configuration
    uint256 public ethDistributionRate;    // Annual % in basis points for WETH (e.g., 1000 = 10%)
    uint256 public emarkDistributionRate;  
    uint256 public rebalancePeriod;        // How often to update rates (e.g., 7 days)
    
    // Current period tracking
    uint256 public currentPeriodStart;
    uint256 public currentPeriodEnd;
    uint256 public ethRewardRate;          // Fixed WETH rate for current period
    uint256 public emarkRewardRate;        // Fixed rate for current period
    
    // Synthetix-style reward tracking
    uint256 public ethLastUpdateTime;
    uint256 public emarkLastUpdateTime;
    uint256 public ethRewardPerTokenStored;
    uint256 public emarkRewardPerTokenStored;
    uint256 public ethTotalDistributed;    // Total WETH distributed
    uint256 public emarkTotalDistributed;
    
    // User reward tracking
    mapping(address => uint256) public userEthRewardPerTokenPaid;
    mapping(address => uint256) public userEmarkRewardPerTokenPaid;
    mapping(address => uint256) public ethRewards_user;    // WETH rewards for users
    mapping(address => uint256) public emarkRewards_user;

    // Pool snapshots for period calculation
    uint256 public lastEthPoolSnapshot;    // Last WETH pool snapshot
    uint256 public lastEmarkPoolSnapshot;

    uint256 public emergencyPauseUntil;

    /* ========== EVENTS ========== */

    event PeriodRebalanced(
        uint256 indexed periodStart,
        uint256 indexed periodEnd,
        uint256 ethPoolSnapshot,    // WETH pool snapshot
        uint256 emarkPoolSnapshot,
        uint256 newEthRate,         // WETH rate
        uint256 newEmarkRate
    );
    event DistributionRateUpdated(string tokenType, uint256 newRate);
    event EthRewardPaid(address indexed user, uint256 reward);        // WETH rewards paid
    event EmarkRewardPaid(address indexed user, uint256 reward);
    event EthPoolFunded(uint256 amount, address indexed from);        // WETH pool funded
    event EmarkPoolFunded(uint256 amount, address indexed from);

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _emarkToken,           
        address _stakingToken,
        address _wethToken,            // NEW: WETH token address
        uint256 _wethDistributionRate, // Annual % in basis points for WETH
        uint256 _emarkDistributionRate,
        uint256 _rebalancePeriod       // Seconds between rebalances (e.g., 7 days)
    ) external initializer {
        require(_emarkToken != address(0), "Invalid EMARK token");
        require(_stakingToken != address(0), "Invalid staking token");
        require(_wethToken != address(0), "Invalid WETH token");     // NEW
        require(_wethDistributionRate <= 50000, "WETH rate too high");
        require(_emarkDistributionRate <= 50000, "EMARK rate too high");
        require(_rebalancePeriod >= 1 hours, "Rebalance period too short");

        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(DISTRIBUTOR_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);

        emarkToken = IERC20(_emarkToken);
        wethToken = IERC20(_wethToken);                              // NEW
        stakingToken = IWEMARK(_stakingToken);
        ethDistributionRate = _wethDistributionRate;
        emarkDistributionRate = _emarkDistributionRate;
        rebalancePeriod = _rebalancePeriod;
        
        // Initialize first period
        _initializePeriod();
    }

    /* ========== MODIFIERS ========== */

    modifier updateReward(address account) {
        _checkAndRebalance(); // Auto-rebalance if period ended
        _updateEthRewards(account);
        _updateEmarkRewards(account);
        _;
    }

    modifier onlyWhenActive() {
        require(block.timestamp > emergencyPauseUntil, "Emergency pause active");
        _;
    }

    /* ========== PERIOD MANAGEMENT ========== */

    function _initializePeriod() internal {
        currentPeriodStart = block.timestamp;
        currentPeriodEnd = block.timestamp + rebalancePeriod;
        ethLastUpdateTime = block.timestamp;
        emarkLastUpdateTime = block.timestamp;
        
        // Set initial rates based on current pool balances
        _calculateNewRates();
    }

    function _checkAndRebalance() internal {
        if (block.timestamp >= currentPeriodEnd) {
            _performRebalance();
        }
    }

    function _performRebalance() internal {
        // Update rewards before changing rates
        _updateEthRewards(address(0));
        _updateEmarkRewards(address(0));
        
        // Take pool snapshots
        lastEthPoolSnapshot = wethToken.balanceOf(address(this));    // WETH pool snapshot
        lastEmarkPoolSnapshot = emarkToken.balanceOf(address(this));
        
        // Calculate new rates based on current pool balances
        _calculateNewRates();
        
        // Start new period
        currentPeriodStart = block.timestamp;
        currentPeriodEnd = block.timestamp + rebalancePeriod;
        
        emit PeriodRebalanced(
            currentPeriodStart,
            currentPeriodEnd,
            lastEthPoolSnapshot,
            lastEmarkPoolSnapshot,
            ethRewardRate,
            emarkRewardRate
        );
    }

    function _calculateNewRates() internal {
        uint256 wethPool = wethToken.balanceOf(address(this));       // WETH pool balance
        uint256 emarkPool = emarkToken.balanceOf(address(this));
        
        // Calculate rates: (pool * percentage) / rebalancePeriod
        if (wethPool > 0) {
            uint256 wethForPeriod = (wethPool * ethDistributionRate * rebalancePeriod) / (10000 * 365 days);
            ethRewardRate = wethForPeriod / rebalancePeriod; // Per second for this period
        } else {
            ethRewardRate = 0;
        }
        
        if (emarkPool > 0) {
            uint256 emarkForPeriod = (emarkPool * emarkDistributionRate * rebalancePeriod) / (10000 * 365 days);
            emarkRewardRate = emarkForPeriod / rebalancePeriod; // Per second for this period
        } else {
            emarkRewardRate = 0;
        }
    }

    /* ========== REWARD CALCULATIONS ========== */

    function _updateEthRewards(address account) internal {
        ethRewardPerTokenStored = ethRewardPerToken();
        ethLastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            ethRewards_user[account] = ethEarned(account);
            userEthRewardPerTokenPaid[account] = ethRewardPerTokenStored;
        }
    }

    function _updateEmarkRewards(address account) internal {
        emarkRewardPerTokenStored = emarkRewardPerToken();
        emarkLastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            emarkRewards_user[account] = emarkEarned(account);
            userEmarkRewardPerTokenPaid[account] = emarkRewardPerTokenStored;
        }
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return Math.min(block.timestamp, currentPeriodEnd);
    }

    function ethRewardPerToken() public view returns (uint256) {
        uint256 totalStaked = stakingToken.totalSupply();
        if (totalStaked == 0) {
            return ethRewardPerTokenStored;
        }
        
        uint256 timeElapsed = lastTimeRewardApplicable() - ethLastUpdateTime;
        return ethRewardPerTokenStored + ((timeElapsed * ethRewardRate * 1e18) / totalStaked);
    }

    function emarkRewardPerToken() public view returns (uint256) {
        uint256 totalStaked = stakingToken.totalSupply();
        if (totalStaked == 0) {
            return emarkRewardPerTokenStored;
        }
        
        uint256 timeElapsed = lastTimeRewardApplicable() - emarkLastUpdateTime;
        return emarkRewardPerTokenStored + ((timeElapsed * emarkRewardRate * 1e18) / totalStaked);
    }

    function ethEarned(address account) public view returns (uint256) {
        uint256 balance = stakingToken.balanceOf(account);
        return ((balance * (ethRewardPerToken() - userEthRewardPerTokenPaid[account])) / 1e18) + ethRewards_user[account];
    }

    function emarkEarned(address account) public view returns (uint256) {
        uint256 balance = stakingToken.balanceOf(account);
        return ((balance * (emarkRewardPerToken() - userEmarkRewardPerTokenPaid[account])) / 1e18) + emarkRewards_user[account];
    }

    /* ========== VIEWS ========== */

    function totalSupply() external view returns (uint256) {
        return stakingToken.totalSupply();
    }

    function balanceOf(address account) external view returns (uint256) {
        return stakingToken.balanceOf(account);
    }

    /**
     * @notice Get current period and pool status
     */
    function getPeriodStatus() external view returns (
        uint256 periodStart,
        uint256 periodEnd,
        uint256 timeUntilRebalance,
        uint256 currentEthPool,
        uint256 currentEmarkPool,
        uint256 currentEthRate,
        uint256 currentEmarkRate,
        uint256 nextEthRate,
        uint256 nextEmarkRate
    ) {
        periodStart = currentPeriodStart;
        periodEnd = currentPeriodEnd;
        timeUntilRebalance = block.timestamp >= currentPeriodEnd ? 0 : currentPeriodEnd - block.timestamp;
        
        currentEthPool = wethToken.balanceOf(address(this));         // WETH pool balance
        currentEmarkPool = emarkToken.balanceOf(address(this));
        currentEthRate = ethRewardRate;
        currentEmarkRate = emarkRewardRate;
        
        // Calculate what rates would be if rebalanced now
        if (currentEthPool > 0) {
            uint256 ethForPeriod = (currentEthPool * ethDistributionRate * rebalancePeriod) / (10000 * 365 days);
            nextEthRate = ethForPeriod / rebalancePeriod;
        }
        if (currentEmarkPool > 0) {
            uint256 emarkForPeriod = (currentEmarkPool * emarkDistributionRate * rebalancePeriod) / (10000 * 365 days);
            nextEmarkRate = emarkForPeriod / rebalancePeriod;
        }
    }

    function getUserRewardInfo(address user) external view returns (
        uint256 pendingEth,     // Pending WETH rewards
        uint256 pendingEmark,
        uint256 stakedAmount,
        uint256 periodEthRewards,    // Period WETH rewards
        uint256 periodEmarkRewards
    ) {
        pendingEth = ethEarned(user);
        pendingEmark = emarkEarned(user);
        stakedAmount = stakingToken.balanceOf(user);
        
        uint256 totalStaked = stakingToken.totalSupply();
        if (stakedAmount > 0 && totalStaked > 0) {
            uint256 remainingTime = block.timestamp >= currentPeriodEnd ? 0 : currentPeriodEnd - block.timestamp;
            periodEthRewards = (ethRewardRate * remainingTime * stakedAmount) / totalStaked;
            periodEmarkRewards = (emarkRewardRate * remainingTime * stakedAmount) / totalStaked;
        }
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function claimRewards() external nonReentrant whenNotPaused onlyWhenActive updateReward(msg.sender) {
        uint256 ethReward = ethRewards_user[msg.sender];    // WETH reward amount
        uint256 emarkReward = emarkRewards_user[msg.sender];
        
        require(ethReward > 0 || emarkReward > 0, "No rewards to claim");
        
        if (ethReward > 0) {
            ethRewards_user[msg.sender] = 0;
            ethTotalDistributed += ethReward;
            
            // Use WETH transfer instead of native ETH
            wethToken.safeTransfer(msg.sender, ethReward);
            
            emit EthRewardPaid(msg.sender, ethReward);
        }
        
        if (emarkReward > 0) {
            emarkRewards_user[msg.sender] = 0;
            emarkTotalDistributed += emarkReward;
            
            emarkToken.safeTransfer(msg.sender, emarkReward);
            
            emit EmarkRewardPaid(msg.sender, emarkReward);
        }
    }

    /* ========== FUNDING FUNCTIONS ========== */

    // CHANGED: Replace fundEthRewards with fundWethRewards
    function fundWethRewards(uint256 amount) external onlyRole(DISTRIBUTOR_ROLE) onlyWhenActive {
        require(amount > 0, "Amount must be > 0");
        wethToken.safeTransferFrom(msg.sender, address(this), amount);
        emit EthPoolFunded(amount, msg.sender);
        // Rates will be updated at next rebalance
    }

    function fundEmarkRewards(uint256 amount) external onlyRole(DISTRIBUTOR_ROLE) onlyWhenActive {
        require(amount > 0, "Amount must be > 0");
        emarkToken.safeTransferFrom(msg.sender, address(this), amount);
        emit EmarkPoolFunded(amount, msg.sender);
        // Rates will be updated at next rebalance
    }

    /* ========== ADMIN FUNCTIONS ========== */

    function setWethDistributionRate(uint256 _rate) external onlyRole(ADMIN_ROLE) {
        require(_rate <= 50000, "Rate too high");
        ethDistributionRate = _rate;
        emit DistributionRateUpdated("WETH", _rate);
    }

    function setEmarkDistributionRate(uint256 _rate) external onlyRole(ADMIN_ROLE) {
        require(_rate <= 50000, "Rate too high");
        emarkDistributionRate = _rate;
        emit DistributionRateUpdated("EMARK", _rate);
    }

    function setRebalancePeriod(uint256 _period) external onlyRole(ADMIN_ROLE) {
        require(_period >= 1 hours, "Period too short");
        rebalancePeriod = _period;
    }

    function setWethToken(address _wethToken) external onlyRole(ADMIN_ROLE) {
        require(_wethToken != address(0), "Invalid WETH address");
        wethToken = IERC20(_wethToken);
    }

    /**
     * @notice Manually trigger rebalance (if needed)
     */
    function manualRebalance() external onlyRole(ADMIN_ROLE) {
        _performRebalance();
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // REMOVED: receive() function - no longer accepting native ETH

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}