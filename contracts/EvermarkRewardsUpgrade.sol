// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

interface IStakingToken {
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

/**
 * @title EvermarkRewardsUpgrade
 * @notice V2 upgrade of EvermarkRewards adding winner distribution capabilities
 * @dev Maintains full backward compatibility with existing V1 functionality
 */
contract EvermarkRewardsUpgrade is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    // ========== V1 STORAGE (UNCHANGED) ==========
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    IERC20 public emarkToken;         
    IERC20 public wethToken;
    IStakingToken public stakingToken; 
    
    uint256 public ethDistributionRate;
    uint256 public emarkDistributionRate;  
    uint256 public rebalancePeriod;
    
    uint256 public currentPeriodStart;
    uint256 public currentPeriodEnd;
    uint256 public ethRewardRate;
    uint256 public emarkRewardRate;
    
    uint256 public ethLastUpdateTime;
    uint256 public emarkLastUpdateTime;
    uint256 public ethRewardPerTokenStored;
    uint256 public emarkRewardPerTokenStored;
    uint256 public ethTotalDistributed;
    uint256 public emarkTotalDistributed;
    
    mapping(address => uint256) public userEthRewardPerTokenPaid;
    mapping(address => uint256) public userEmarkRewardPerTokenPaid;
    mapping(address => uint256) public ethRewards_user;  // Legacy mapping
    mapping(address => uint256) public emarkRewards_user; // Legacy mapping

    uint256 public lastEthPoolSnapshot;
    uint256 public lastEmarkPoolSnapshot;
    uint256 public emergencyPauseUntil;
    
    // Security enhancements (from previous upgrade)
    uint256 public constant EMERGENCY_DELAY = 48 hours;
    uint256 public constant UPGRADE_DELAY = 7 days;
    uint256 public constant ROLE_DELAY = 48 hours;
    address public emergencyMultisig;
    mapping(bytes32 => uint256) public emergencyProposals;
    mapping(address => uint256) public pendingUpgrades;
    mapping(bytes32 => mapping(address => uint256)) public roleTransitions;
    uint256 public dailyWithdrawLimit;
    uint256 public dailyWithdrawn;
    uint256 public lastWithdrawReset;
    
    uint256 public currentPeriodNumber; // Already exists from previous upgrade
    
    // ========== V2 STORAGE (NEW) ==========
    
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MAX_WINNERS = 10;
    
    // V2 feature toggle and allocation
    bool public v2Initialized;
    uint256 public winnersAllocation; // Basis points allocated to winners (e.g., 3000 = 30%)
    
    // Winner distributions
    struct PeriodWinners {
        address[] winners;
        uint256[] evermarkIds;
        uint256[] percentages;
        uint256 ethReserved;
        uint256 emarkReserved;
        bool finalized;
        mapping(address => bool) hasClaimed;
        mapping(address => uint256) ethAllocation;
        mapping(address => uint256) emarkAllocation;
    }
    
    mapping(uint256 => PeriodWinners) public periodWinners;
    uint256[] public defaultWinnerPercentages;
    
    // V2 user rewards (cleaner naming)
    mapping(address => uint256) public ethRewards_staking;
    mapping(address => uint256) public emarkRewards_staking;
    
    // V2 statistics
    uint256 public totalEthDistributedToStakers;
    uint256 public totalEmarkDistributedToStakers;
    uint256 public totalEthDistributedToWinners;
    uint256 public totalEmarkDistributedToWinners;
    
    // ========== EVENTS ==========
    
    // V1 Events (unchanged)
    event PeriodRebalanced(
        uint256 indexed periodNumber,
        uint256 indexed periodStart,
        uint256 indexed periodEnd,
        uint256 ethPoolSnapshot,
        uint256 emarkPoolSnapshot,
        uint256 newEthRate,
        uint256 newEmarkRate
    );
    event DistributionRateUpdated(string tokenType, uint256 newRate);
    event EthRewardPaid(address indexed user, uint256 reward);
    event EmarkRewardPaid(address indexed user, uint256 reward);
    event EthPoolFunded(uint256 amount, address indexed from);
    event EmarkPoolFunded(uint256 amount, address indexed from);
    
    // V2 Events (new)
    event V2Initialized(uint256 winnersAllocation, uint256[] defaultPercentages);
    event WinnersSubmitted(uint256 indexed periodNumber, address[] winners, uint256 ethAllocated, uint256 emarkAllocated);
    event WinnerRewardsPaid(address indexed user, uint256 indexed period, uint256 ethReward, uint256 emarkReward);
    event AllocationUpdated(uint256 newWinnersAllocation);
    event UserRewardsMigrated(address indexed user, uint256 ethAmount, uint256 emarkAmount);
    
    // ========== MODIFIERS ==========
    
    modifier onlyWhenActive() {
        require(block.timestamp > emergencyPauseUntil, "Emergency pause active");
        _;
    }

    modifier updateReward(address account) {
        _checkAndRebalance();
        _updateStakingRewards(account);
        _;
    }
    
    modifier v2Active() {
        require(v2Initialized, "V2 not initialized");
        _;
    }
    
    // ========== V2 INITIALIZATION ==========
    
    /**
     * @notice Initialize V2 features (called after upgrade)
     * @dev Can only be called once by admin
     */
    function initializeV2(
        uint256 _winnersAllocation,
        uint256[] calldata _defaultPercentages
    ) external onlyRole(ADMIN_ROLE) {
        require(!v2Initialized, "Already initialized");
        require(_winnersAllocation <= 5000, "Allocation too high"); // Max 50%
        require(_defaultPercentages.length <= MAX_WINNERS, "Too many percentages");
        
        // Validate percentages sum to 100%
        uint256 total = 0;
        for (uint256 i = 0; i < _defaultPercentages.length; i++) {
            total += _defaultPercentages[i];
        }
        require(total <= BASIS_POINTS, "Total exceeds 100%");
        
        // Initialize V2 state
        winnersAllocation = _winnersAllocation;
        defaultWinnerPercentages = _defaultPercentages;
        
        // Initialize period number if not set
        if (currentPeriodNumber == 0) {
            currentPeriodNumber = 1;
        }
        
        // Grant oracle role to admin initially
        _grantRole(ORACLE_ROLE, msg.sender);
        
        v2Initialized = true;
        
        emit V2Initialized(_winnersAllocation, _defaultPercentages);
    }
    
    /**
     * @notice Migrate user rewards from V1 mapping to V2 mapping
     * @dev Needed to transition from ethRewards_user to ethRewards_staking
     */
    function migrateUserRewards(address[] calldata users) external onlyRole(ADMIN_ROLE) {
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            
            // Migrate ETH rewards
            uint256 ethAmount = ethRewards_user[user];
            if (ethAmount > 0 && ethRewards_staking[user] == 0) {
                ethRewards_staking[user] = ethAmount;
                ethRewards_user[user] = 0;
            }
            
            // Migrate EMARK rewards
            uint256 emarkAmount = emarkRewards_user[user];
            if (emarkAmount > 0 && emarkRewards_staking[user] == 0) {
                emarkRewards_staking[user] = emarkAmount;
                emarkRewards_user[user] = 0;
            }
            
            if (ethAmount > 0 || emarkAmount > 0) {
                emit UserRewardsMigrated(user, ethAmount, emarkAmount);
            }
        }
    }
    
    // ========== PERIOD MANAGEMENT (ENHANCED) ==========
    
    function _initializePeriod() internal {
        currentPeriodNumber = currentPeriodNumber == 0 ? 1 : currentPeriodNumber;
        currentPeriodStart = block.timestamp;
        currentPeriodEnd = block.timestamp + rebalancePeriod;
        ethLastUpdateTime = block.timestamp;
        emarkLastUpdateTime = block.timestamp;
        
        _calculateNewRates();
    }

    function _checkAndRebalance() internal {
        if (block.timestamp >= currentPeriodEnd) {
            _performRebalance();
        }
    }

    function _performRebalance() internal {
        _updateStakingRewards(address(0));
        
        lastEthPoolSnapshot = wethToken.balanceOf(address(this));
        lastEmarkPoolSnapshot = emarkToken.balanceOf(address(this));
        
        // Calculate distributions
        if (v2Initialized && winnersAllocation > 0) {
            // V2: Split between stakers and winners
            uint256 ethTotalForPeriod = _calculatePeriodDistribution(lastEthPoolSnapshot, ethDistributionRate);
            uint256 emarkTotalForPeriod = _calculatePeriodDistribution(lastEmarkPoolSnapshot, emarkDistributionRate);
            
            uint256 ethForWinners = (ethTotalForPeriod * winnersAllocation) / BASIS_POINTS;
            uint256 emarkForWinners = (emarkTotalForPeriod * winnersAllocation) / BASIS_POINTS;
            uint256 ethForStakers = ethTotalForPeriod - ethForWinners;
            uint256 emarkForStakers = emarkTotalForPeriod - emarkForWinners;
            
            // Reserve funds for winners
            PeriodWinners storage period = periodWinners[currentPeriodNumber];
            period.ethReserved = ethForWinners;
            period.emarkReserved = emarkForWinners;
            
            // Set staker rates
            ethRewardRate = ethForStakers / rebalancePeriod;
            emarkRewardRate = emarkForStakers / rebalancePeriod;
        } else {
            // V1: All to stakers (backward compatibility)
            _calculateNewRates();
        }
        
        currentPeriodStart = block.timestamp;
        currentPeriodEnd = block.timestamp + rebalancePeriod;
        currentPeriodNumber += 1;
        
        emit PeriodRebalanced(
            currentPeriodNumber - 1,
            currentPeriodStart,
            currentPeriodEnd,
            lastEthPoolSnapshot,
            lastEmarkPoolSnapshot,
            ethRewardRate,
            emarkRewardRate
        );
    }
    
    function _calculatePeriodDistribution(uint256 poolSize, uint256 rate) internal view returns (uint256) {
        if (poolSize == 0) return 0;
        return (poolSize * rate * rebalancePeriod) / (BASIS_POINTS * 365 days);
    }

    function _calculateNewRates() internal {
        uint256 wethPool = wethToken.balanceOf(address(this));
        uint256 emarkPool = emarkToken.balanceOf(address(this));
        
        if (wethPool > 0) {
            uint256 wethForPeriod = (wethPool * ethDistributionRate * rebalancePeriod) / (10000 * 365 days);
            ethRewardRate = wethForPeriod / rebalancePeriod;
        } else {
            ethRewardRate = 0;
        }
        
        if (emarkPool > 0) {
            uint256 emarkForPeriod = (emarkPool * emarkDistributionRate * rebalancePeriod) / (10000 * 365 days);
            emarkRewardRate = emarkForPeriod / rebalancePeriod;
        } else {
            emarkRewardRate = 0;
        }
    }
    
    // ========== STAKING REWARDS (V1 COMPATIBLE) ==========

    function _updateStakingRewards(address account) internal {
        ethRewardPerTokenStored = ethRewardPerToken();
        emarkRewardPerTokenStored = emarkRewardPerToken();
        ethLastUpdateTime = lastTimeRewardApplicable();
        emarkLastUpdateTime = lastTimeRewardApplicable();
        
        if (account != address(0)) {
            // Use V2 mapping if initialized, fallback to V1
            if (v2Initialized) {
                ethRewards_staking[account] = ethEarnedStaking(account);
                emarkRewards_staking[account] = emarkEarnedStaking(account);
            } else {
                ethRewards_user[account] = ethEarned(account);
                emarkRewards_user[account] = emarkEarned(account);
            }
            userEthRewardPerTokenPaid[account] = ethRewardPerTokenStored;
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

    // V1 Compatible functions
    function ethEarned(address account) public view returns (uint256) {
        uint256 balance = stakingToken.balanceOf(account);
        uint256 pending = ((balance * (ethRewardPerToken() - userEthRewardPerTokenPaid[account])) / 1e18);
        
        if (v2Initialized) {
            return pending + ethRewards_staking[account] + ethRewards_user[account];
        } else {
            return pending + ethRewards_user[account];
        }
    }

    function emarkEarned(address account) public view returns (uint256) {
        uint256 balance = stakingToken.balanceOf(account);
        uint256 pending = ((balance * (emarkRewardPerToken() - userEmarkRewardPerTokenPaid[account])) / 1e18);
        
        if (v2Initialized) {
            return pending + emarkRewards_staking[account] + emarkRewards_user[account];
        } else {
            return pending + emarkRewards_user[account];
        }
    }

    // V2 Specific functions
    function ethEarnedStaking(address account) public view returns (uint256) {
        uint256 balance = stakingToken.balanceOf(account);
        uint256 pending = ((balance * (ethRewardPerToken() - userEthRewardPerTokenPaid[account])) / 1e18);
        return pending + ethRewards_staking[account] + ethRewards_user[account];
    }

    function emarkEarnedStaking(address account) public view returns (uint256) {
        uint256 balance = stakingToken.balanceOf(account);
        uint256 pending = ((balance * (emarkRewardPerToken() - userEmarkRewardPerTokenPaid[account])) / 1e18);
        return pending + emarkRewards_staking[account] + emarkRewards_user[account];
    }
    
    // ========== WINNER REWARDS (V2 ONLY) ==========

    function submitPeriodWinners(
        uint256 periodNumber,
        address[] calldata winners,
        uint256[] calldata evermarkIds
    ) external onlyRole(ORACLE_ROLE) v2Active {
        require(periodNumber < currentPeriodNumber, "Period not ended");
        PeriodWinners storage period = periodWinners[periodNumber];
        require(!period.finalized, "Already finalized");
        require(winners.length == evermarkIds.length, "Array mismatch");
        require(winners.length <= MAX_WINNERS, "Too many winners");
        require(winners.length <= defaultWinnerPercentages.length, "More winners than percentages");
        
        period.winners = winners;
        period.evermarkIds = evermarkIds;
        period.percentages = new uint256[](winners.length);
        
        for (uint256 i = 0; i < winners.length; i++) {
            period.percentages[i] = defaultWinnerPercentages[i];
            uint256 ethShare = (period.ethReserved * defaultWinnerPercentages[i]) / BASIS_POINTS;
            uint256 emarkShare = (period.emarkReserved * defaultWinnerPercentages[i]) / BASIS_POINTS;
            
            period.ethAllocation[winners[i]] += ethShare;
            period.emarkAllocation[winners[i]] += emarkShare;
        }
        
        period.finalized = true;
        
        emit WinnersSubmitted(periodNumber, winners, period.ethReserved, period.emarkReserved);
    }
    
    // ========== CLAIMING (UNIFIED V2) ==========
    
    /**
     * @notice V1 Compatible claim function
     * @dev Claims staking rewards only (maintains backward compatibility)
     */
    function claimRewards() external nonReentrant whenNotPaused onlyWhenActive updateReward(msg.sender) {
        uint256 ethReward = ethEarned(msg.sender);
        uint256 emarkReward = emarkEarned(msg.sender);
        
        require(ethReward > 0 || emarkReward > 0, "No rewards to claim");
        
        // Clear balances from both mappings
        if (v2Initialized) {
            ethRewards_staking[msg.sender] = 0;
            emarkRewards_staking[msg.sender] = 0;
        }
        ethRewards_user[msg.sender] = 0;
        emarkRewards_user[msg.sender] = 0;
        
        // Update statistics
        if (ethReward > 0) {
            ethTotalDistributed += ethReward;
            if (v2Initialized) totalEthDistributedToStakers += ethReward;
            wethToken.safeTransfer(msg.sender, ethReward);
        }
        
        if (emarkReward > 0) {
            emarkTotalDistributed += emarkReward;
            if (v2Initialized) totalEmarkDistributedToStakers += emarkReward;
            emarkToken.safeTransfer(msg.sender, emarkReward);
        }
        
        emit EthRewardPaid(msg.sender, ethReward);
        emit EmarkRewardPaid(msg.sender, emarkReward);
    }
    
    /**
     * @notice V2 Unified claim function
     * @dev Claims both staking and winner rewards
     */
    function claimAllRewards() external nonReentrant whenNotPaused onlyWhenActive v2Active updateReward(msg.sender) {
        // Calculate staking rewards
        uint256 ethStaking = ethEarnedStaking(msg.sender);
        uint256 emarkStaking = emarkEarnedStaking(msg.sender);
        
        // Calculate winner rewards
        uint256 ethWinner = 0;
        uint256 emarkWinner = 0;
        
        for (uint256 i = 1; i < currentPeriodNumber; i++) {
            PeriodWinners storage period = periodWinners[i];
            if (period.finalized && !period.hasClaimed[msg.sender]) {
                uint256 periodEth = period.ethAllocation[msg.sender];
                uint256 periodEmark = period.emarkAllocation[msg.sender];
                
                if (periodEth > 0 || periodEmark > 0) {
                    period.hasClaimed[msg.sender] = true;
                    ethWinner += periodEth;
                    emarkWinner += periodEmark;
                    
                    emit WinnerRewardsPaid(msg.sender, i, periodEth, periodEmark);
                }
            }
        }
        
        uint256 totalEth = ethStaking + ethWinner;
        uint256 totalEmark = emarkStaking + emarkWinner;
        
        require(totalEth > 0 || totalEmark > 0, "No rewards to claim");
        
        // Clear staking balances
        if (ethStaking > 0) {
            ethRewards_staking[msg.sender] = 0;
            ethRewards_user[msg.sender] = 0;
            totalEthDistributedToStakers += ethStaking;
            ethTotalDistributed += ethStaking;
        }
        
        if (emarkStaking > 0) {
            emarkRewards_staking[msg.sender] = 0;
            emarkRewards_user[msg.sender] = 0;
            totalEmarkDistributedToStakers += emarkStaking;
            emarkTotalDistributed += emarkStaking;
        }
        
        // Update winner statistics
        if (ethWinner > 0) {
            totalEthDistributedToWinners += ethWinner;
        }
        if (emarkWinner > 0) {
            totalEmarkDistributedToWinners += emarkWinner;
        }
        
        // Transfer rewards
        if (totalEth > 0) {
            wethToken.safeTransfer(msg.sender, totalEth);
        }
        if (totalEmark > 0) {
            emarkToken.safeTransfer(msg.sender, totalEmark);
        }
        
        emit EthRewardPaid(msg.sender, ethStaking);
        emit EmarkRewardPaid(msg.sender, emarkStaking);
    }
    
    // ========== V2 ADMIN FUNCTIONS ==========
    
    function setWinnersAllocation(uint256 _allocation) external onlyRole(ADMIN_ROLE) v2Active {
        require(_allocation <= 5000, "Too high"); // Max 50%
        winnersAllocation = _allocation;
        emit AllocationUpdated(_allocation);
    }
    
    function setDefaultWinnerPercentages(uint256[] calldata percentages) external onlyRole(ADMIN_ROLE) v2Active {
        require(percentages.length <= MAX_WINNERS, "Too many winners");
        
        uint256 total = 0;
        for (uint256 i = 0; i < percentages.length; i++) {
            total += percentages[i];
        }
        require(total <= BASIS_POINTS, "Total exceeds 100%");
        
        defaultWinnerPercentages = percentages;
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    function getTotalRewards(address account) external view returns (
        uint256 stakingEth,
        uint256 stakingEmark,
        uint256 winnerEth,
        uint256 winnerEmark
    ) {
        stakingEth = ethEarned(account);
        stakingEmark = emarkEarned(account);
        
        if (v2Initialized) {
            for (uint256 i = 1; i < currentPeriodNumber; i++) {
                PeriodWinners storage period = periodWinners[i];
                if (period.finalized && !period.hasClaimed[account]) {
                    winnerEth += period.ethAllocation[account];
                    winnerEmark += period.emarkAllocation[account];
                }
            }
        }
    }
    
    function isV2Active() external view returns (bool) {
        return v2Initialized;
    }
    
    // ========== EXISTING V1 FUNCTIONS (UNCHANGED) ==========
    
    function totalSupply() external view returns (uint256) {
        return stakingToken.totalSupply();
    }

    function balanceOf(address account) external view returns (uint256) {
        return stakingToken.balanceOf(account);
    }

    function fundWethRewards(uint256 amount) external onlyRole(DISTRIBUTOR_ROLE) onlyWhenActive {
        require(amount > 0, "Amount must be > 0");
        wethToken.safeTransferFrom(msg.sender, address(this), amount);
        emit EthPoolFunded(amount, msg.sender);
    }

    function fundEmarkRewards(uint256 amount) external onlyRole(DISTRIBUTOR_ROLE) onlyWhenActive {
        require(amount > 0, "Amount must be > 0");
        emarkToken.safeTransferFrom(msg.sender, address(this), amount);
        emit EmarkPoolFunded(amount, msg.sender);
    }

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

    function manualRebalance() external onlyRole(ADMIN_ROLE) {
        _performRebalance();
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {
        require(pendingUpgrades[newImplementation] != 0, "Upgrade not proposed");
        require(block.timestamp >= pendingUpgrades[newImplementation], "Delay not met");
        delete pendingUpgrades[newImplementation];
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // Initialize V2 function for existing deployments
    function initializeV2() external onlyRole(ADMIN_ROLE) {
        if (currentPeriodNumber == 0) {
            currentPeriodNumber = 1;
        }
    }
}