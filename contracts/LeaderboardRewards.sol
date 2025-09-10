// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IEvermarkVoting {
    function getCurrentSeason() external view returns (uint256);
    function getSeasonEndTime(uint256 season) external view returns (uint256);
}

/**
 * @title LeaderboardRewards
 * @notice Distributes marketplace fees to top Evermark creators based on leaderboard rankings
 * @dev Similar pool-based mechanics to EvermarkRewards but with periodic winner distributions
 */
contract LeaderboardRewards is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // Tokens
    IERC20 public emarkToken;
    IERC20 public wethToken;
    IEvermarkVoting public votingContract;
    
    // Distribution parameters
    uint256 public distributionPeriod; // Typically 7 days, matching voting seasons
    uint256 public ethDistributionRate; // Percentage of pool to distribute (basis points)
    uint256 public emarkDistributionRate;
    
    // Period tracking
    uint256 public currentPeriodNumber;
    uint256 public currentPeriodStart;
    uint256 public currentPeriodEnd;
    
    // Pool snapshots
    uint256 public lastEthPoolSnapshot;
    uint256 public lastEmarkPoolSnapshot;
    
    // Winner distribution percentages (out of 10000)
    uint256[] public winnerPercentages;
    uint256 public constant MAX_WINNERS = 10;
    
    // Period winners and claims
    struct PeriodWinners {
        address[] winners;
        uint256[] evermarkIds;
        uint256 ethAllocated;
        uint256 emarkAllocated;
        bool finalized;
        mapping(address => bool) hasClaimed;
        mapping(address => uint256) ethRewards;
        mapping(address => uint256) emarkRewards;
    }
    
    mapping(uint256 => PeriodWinners) public periodWinners;
    
    // User total rewards tracking
    mapping(address => uint256) public totalEthEarned;
    mapping(address => uint256) public totalEmarkEarned;
    
    // Statistics
    uint256 public totalEthDistributed;
    uint256 public totalEmarkDistributed;
    uint256 public totalPeriodsCompleted;
    
    // Emergency and security
    uint256 public emergencyPauseUntil;
    uint256 public constant EMERGENCY_DELAY = 48 hours;
    uint256 public constant UPGRADE_DELAY = 7 days;
    address public emergencyMultisig;
    mapping(bytes32 => uint256) public emergencyProposals;
    mapping(address => uint256) public pendingUpgrades;
    
    // Events
    event PeriodStarted(uint256 indexed periodNumber, uint256 startTime, uint256 endTime);
    event PeriodFinalized(
        uint256 indexed periodNumber,
        address[] winners,
        uint256 ethAllocated,
        uint256 emarkAllocated
    );
    event RewardsClaimed(
        address indexed winner,
        uint256 indexed periodNumber,
        uint256 ethAmount,
        uint256 emarkAmount
    );
    event PoolFunded(address indexed token, uint256 amount, address indexed from);
    event DistributionRateUpdated(string tokenType, uint256 newRate);
    event WinnerPercentagesUpdated(uint256[] newPercentages);
    
    // Security Events
    event EmergencyWithdrawProposed(address token, uint256 amount, uint256 executeAfter);
    event EmergencyWithdrawExecuted(address token, uint256 amount, address recipient);
    event UpgradeProposed(address indexed newImplementation, uint256 executeAfter);
    event UpgradeExecuted(address indexed newImplementation);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _emarkToken,
        address _wethToken,
        address _votingContract,
        uint256 _ethDistributionRate,
        uint256 _emarkDistributionRate,
        uint256 _distributionPeriod
    ) external initializer {
        require(_emarkToken != address(0), "Invalid EMARK token");
        require(_wethToken != address(0), "Invalid WETH token");
        require(_votingContract != address(0), "Invalid voting contract");
        require(_ethDistributionRate <= 10000, "ETH rate too high");
        require(_emarkDistributionRate <= 10000, "EMARK rate too high");
        require(_distributionPeriod >= 1 days, "Period too short");

        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(DISTRIBUTOR_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);

        emarkToken = IERC20(_emarkToken);
        wethToken = IERC20(_wethToken);
        votingContract = IEvermarkVoting(_votingContract);
        
        ethDistributionRate = _ethDistributionRate;
        emarkDistributionRate = _emarkDistributionRate;
        distributionPeriod = _distributionPeriod;
        
        // Default winner distribution: [40%, 25%, 15%, 10%, 5%, 2%, 1%, 1%, 0.5%, 0.5%]
        winnerPercentages = [4000, 2500, 1500, 1000, 500, 200, 100, 100, 50, 50];
        
        _startNewPeriod();
    }

    modifier onlyWhenActive() {
        require(block.timestamp > emergencyPauseUntil, "Emergency pause active");
        _;
    }

    // ========== PERIOD MANAGEMENT ==========

    function _startNewPeriod() internal {
        currentPeriodNumber++;
        currentPeriodStart = block.timestamp;
        currentPeriodEnd = block.timestamp + distributionPeriod;
        
        // Take pool snapshots for this period's distribution
        lastEthPoolSnapshot = wethToken.balanceOf(address(this));
        lastEmarkPoolSnapshot = emarkToken.balanceOf(address(this));
        
        emit PeriodStarted(currentPeriodNumber, currentPeriodStart, currentPeriodEnd);
    }

    function checkAndAdvancePeriod() external {
        require(block.timestamp >= currentPeriodEnd, "Period not ended");
        _startNewPeriod();
    }

    // ========== WINNER SUBMISSION ==========

    /**
     * @notice Submit winners for a completed period
     * @dev Called by ORACLE_ROLE (likely an automated service reading from leaderboard contract)
     * @param periodNumber The period to finalize
     * @param winners Array of winner addresses (in order of ranking)
     * @param evermarkIds Array of winning Evermark NFT IDs
     */
    function submitPeriodWinners(
        uint256 periodNumber,
        address[] calldata winners,
        uint256[] calldata evermarkIds
    ) external onlyRole(ORACLE_ROLE) {
        require(!periodWinners[periodNumber].finalized, "Period already finalized");
        require(winners.length == evermarkIds.length, "Array length mismatch");
        require(winners.length <= MAX_WINNERS, "Too many winners");
        require(winners.length <= winnerPercentages.length, "More winners than percentages");
        
        PeriodWinners storage period = periodWinners[periodNumber];
        
        // Calculate total rewards for this period
        uint256 ethToDistribute = _calculatePeriodDistribution(lastEthPoolSnapshot, ethDistributionRate);
        uint256 emarkToDistribute = _calculatePeriodDistribution(lastEmarkPoolSnapshot, emarkDistributionRate);
        
        period.winners = winners;
        period.evermarkIds = evermarkIds;
        period.ethAllocated = ethToDistribute;
        period.emarkAllocated = emarkToDistribute;
        period.finalized = true;
        
        // Calculate individual allocations
        for (uint256 i = 0; i < winners.length; i++) {
            uint256 ethShare = (ethToDistribute * winnerPercentages[i]) / 10000;
            uint256 emarkShare = (emarkToDistribute * winnerPercentages[i]) / 10000;
            
            period.ethRewards[winners[i]] += ethShare;
            period.emarkRewards[winners[i]] += emarkShare;
        }
        
        totalPeriodsCompleted++;
        
        emit PeriodFinalized(periodNumber, winners, ethToDistribute, emarkToDistribute);
    }

    function _calculatePeriodDistribution(uint256 poolSize, uint256 rate) internal view returns (uint256) {
        if (poolSize == 0) return 0;
        // Calculate distribution for the period
        return (poolSize * rate * distributionPeriod) / (10000 * 365 days);
    }

    // ========== CLAIMING REWARDS ==========

    /**
     * @notice Claim rewards for a specific period
     * @param periodNumber The period to claim rewards from
     */
    function claimRewards(uint256 periodNumber) external nonReentrant whenNotPaused onlyWhenActive {
        PeriodWinners storage period = periodWinners[periodNumber];
        require(period.finalized, "Period not finalized");
        require(!period.hasClaimed[msg.sender], "Already claimed");
        
        uint256 ethReward = period.ethRewards[msg.sender];
        uint256 emarkReward = period.emarkRewards[msg.sender];
        require(ethReward > 0 || emarkReward > 0, "No rewards to claim");
        
        period.hasClaimed[msg.sender] = true;
        
        if (ethReward > 0) {
            totalEthEarned[msg.sender] += ethReward;
            totalEthDistributed += ethReward;
            wethToken.safeTransfer(msg.sender, ethReward);
        }
        
        if (emarkReward > 0) {
            totalEmarkEarned[msg.sender] += emarkReward;
            totalEmarkDistributed += emarkReward;
            emarkToken.safeTransfer(msg.sender, emarkReward);
        }
        
        emit RewardsClaimed(msg.sender, periodNumber, ethReward, emarkReward);
    }

    /**
     * @notice Claim all unclaimed rewards across all periods
     */
    function claimAllRewards() external nonReentrant whenNotPaused onlyWhenActive {
        uint256 totalEth = 0;
        uint256 totalEmark = 0;
        
        for (uint256 i = 1; i <= currentPeriodNumber; i++) {
            PeriodWinners storage period = periodWinners[i];
            if (period.finalized && !period.hasClaimed[msg.sender]) {
                uint256 ethReward = period.ethRewards[msg.sender];
                uint256 emarkReward = period.emarkRewards[msg.sender];
                
                if (ethReward > 0 || emarkReward > 0) {
                    period.hasClaimed[msg.sender] = true;
                    totalEth += ethReward;
                    totalEmark += emarkReward;
                    
                    emit RewardsClaimed(msg.sender, i, ethReward, emarkReward);
                }
            }
        }
        
        require(totalEth > 0 || totalEmark > 0, "No rewards to claim");
        
        if (totalEth > 0) {
            totalEthEarned[msg.sender] += totalEth;
            totalEthDistributed += totalEth;
            wethToken.safeTransfer(msg.sender, totalEth);
        }
        
        if (totalEmark > 0) {
            totalEmarkEarned[msg.sender] += totalEmark;
            totalEmarkDistributed += totalEmark;
            emarkToken.safeTransfer(msg.sender, totalEmark);
        }
    }

    // ========== VIEW FUNCTIONS ==========

    function getPeriodWinners(uint256 periodNumber) external view returns (
        address[] memory winners,
        uint256[] memory evermarkIds,
        uint256 ethAllocated,
        uint256 emarkAllocated,
        bool finalized
    ) {
        PeriodWinners storage period = periodWinners[periodNumber];
        return (
            period.winners,
            period.evermarkIds,
            period.ethAllocated,
            period.emarkAllocated,
            period.finalized
        );
    }

    function getUserRewardsForPeriod(address user, uint256 periodNumber) external view returns (
        uint256 ethReward,
        uint256 emarkReward,
        bool hasClaimed
    ) {
        PeriodWinners storage period = periodWinners[periodNumber];
        return (
            period.ethRewards[user],
            period.emarkRewards[user],
            period.hasClaimed[user]
        );
    }

    function getUnclaimedRewards(address user) external view returns (
        uint256 totalUnclaimedEth,
        uint256 totalUnclaimedEmark,
        uint256[] memory unclaimedPeriods
    ) {
        uint256 count = 0;
        uint256[] memory periods = new uint256[](currentPeriodNumber);
        
        for (uint256 i = 1; i <= currentPeriodNumber; i++) {
            PeriodWinners storage period = periodWinners[i];
            if (period.finalized && !period.hasClaimed[user]) {
                uint256 ethReward = period.ethRewards[user];
                uint256 emarkReward = period.emarkRewards[user];
                
                if (ethReward > 0 || emarkReward > 0) {
                    totalUnclaimedEth += ethReward;
                    totalUnclaimedEmark += emarkReward;
                    periods[count++] = i;
                }
            }
        }
        
        // Resize array to actual count
        unclaimedPeriods = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            unclaimedPeriods[i] = periods[i];
        }
        
        return (totalUnclaimedEth, totalUnclaimedEmark, unclaimedPeriods);
    }

    function getCurrentPoolStatus() external view returns (
        uint256 ethPoolSize,
        uint256 emarkPoolSize,
        uint256 nextEthDistribution,
        uint256 nextEmarkDistribution,
        uint256 timeUntilNextPeriod
    ) {
        ethPoolSize = wethToken.balanceOf(address(this));
        emarkPoolSize = emarkToken.balanceOf(address(this));
        nextEthDistribution = _calculatePeriodDistribution(ethPoolSize, ethDistributionRate);
        nextEmarkDistribution = _calculatePeriodDistribution(emarkPoolSize, emarkDistributionRate);
        timeUntilNextPeriod = block.timestamp >= currentPeriodEnd ? 0 : currentPeriodEnd - block.timestamp;
        
        return (ethPoolSize, emarkPoolSize, nextEthDistribution, nextEmarkDistribution, timeUntilNextPeriod);
    }

    // ========== ADMIN FUNCTIONS ==========

    function fundEthPool(uint256 amount) external onlyRole(DISTRIBUTOR_ROLE) {
        require(amount > 0, "Amount must be > 0");
        wethToken.safeTransferFrom(msg.sender, address(this), amount);
        emit PoolFunded(address(wethToken), amount, msg.sender);
    }

    function fundEmarkPool(uint256 amount) external onlyRole(DISTRIBUTOR_ROLE) {
        require(amount > 0, "Amount must be > 0");
        emarkToken.safeTransferFrom(msg.sender, address(this), amount);
        emit PoolFunded(address(emarkToken), amount, msg.sender);
    }

    function setDistributionRates(uint256 _ethRate, uint256 _emarkRate) external onlyRole(ADMIN_ROLE) {
        require(_ethRate <= 10000, "ETH rate too high");
        require(_emarkRate <= 10000, "EMARK rate too high");
        
        ethDistributionRate = _ethRate;
        emarkDistributionRate = _emarkRate;
        
        emit DistributionRateUpdated("ETH", _ethRate);
        emit DistributionRateUpdated("EMARK", _emarkRate);
    }

    function setWinnerPercentages(uint256[] calldata percentages) external onlyRole(ADMIN_ROLE) {
        require(percentages.length <= MAX_WINNERS, "Too many winners");
        
        uint256 total = 0;
        for (uint256 i = 0; i < percentages.length; i++) {
            total += percentages[i];
        }
        require(total <= 10000, "Total exceeds 100%");
        
        winnerPercentages = percentages;
        emit WinnerPercentagesUpdated(percentages);
    }

    function setDistributionPeriod(uint256 _period) external onlyRole(ADMIN_ROLE) {
        require(_period >= 1 days, "Period too short");
        distributionPeriod = _period;
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ========== EMERGENCY FUNCTIONS ==========

    function proposeEmergencyWithdraw(address token, uint256 amount) external onlyRole(ADMIN_ROLE) {
        require(token == address(wethToken) || token == address(emarkToken), "Invalid token");
        require(amount > 0 && amount <= IERC20(token).balanceOf(address(this)), "Invalid amount");
        
        bytes32 proposalHash = keccak256(abi.encodePacked(token, amount, block.timestamp));
        emergencyProposals[proposalHash] = block.timestamp + EMERGENCY_DELAY;
        emit EmergencyWithdrawProposed(token, amount, block.timestamp + EMERGENCY_DELAY);
    }

    function executeEmergencyWithdraw(
        address token,
        uint256 amount,
        address recipient
    ) external {
        require(msg.sender == emergencyMultisig, "Not emergency multisig");
        require(recipient != address(0), "Invalid recipient");
        
        bytes32 proposalHash = keccak256(abi.encodePacked(token, amount, block.timestamp - EMERGENCY_DELAY));
        require(emergencyProposals[proposalHash] != 0, "No valid proposal");
        require(block.timestamp >= emergencyProposals[proposalHash], "Delay not met");
        
        delete emergencyProposals[proposalHash];
        IERC20(token).safeTransfer(recipient, amount);
        
        emit EmergencyWithdrawExecuted(token, amount, recipient);
    }

    function setEmergencyMultisig(address _multisig) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_multisig != address(0), "Invalid multisig");
        emergencyMultisig = _multisig;
    }

    // ========== UPGRADE FUNCTIONS ==========

    function proposeUpgrade(address newImplementation) external onlyRole(UPGRADER_ROLE) {
        require(newImplementation != address(0), "Invalid implementation");
        pendingUpgrades[newImplementation] = block.timestamp + UPGRADE_DELAY;
        emit UpgradeProposed(newImplementation, block.timestamp + UPGRADE_DELAY);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {
        require(pendingUpgrades[newImplementation] != 0, "Upgrade not proposed");
        require(block.timestamp >= pendingUpgrades[newImplementation], "Delay not met");
        delete pendingUpgrades[newImplementation];
        emit UpgradeExecuted(newImplementation);
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}