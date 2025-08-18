// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/*
 ███╗   ██╗███████╗████████╗    ███████╗████████╗ █████╗ ██╗  ██╗██╗███╗   ██╗ ██████╗ 
 ████╗  ██║██╔════╝╚══██╔══╝    ██╔════╝╚══██╔══╝██╔══██╗██║ ██╔╝██║████╗  ██║██╔════╝ 
 ██╔██╗ ██║█████╗     ██║       ███████╗   ██║   ███████║█████╔╝ ██║██╔██╗ ██║██║  ███╗
 ██║╚██╗██║██╔══╝     ██║       ╚════██║   ██║   ██╔══██║██╔═██╗ ██║██║╚██╗██║██║   ██║
 ██║ ╚████║██║        ██║       ███████║   ██║   ██║  ██║██║  ██╗██║██║ ╚████║╚██████╔╝
 ╚═╝  ╚═══╝╚═╝        ╚═╝       ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝ ╚═════╝ 
*/

interface IEvermarkNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    function getEvermarkCreator(uint256 tokenId) external view returns (address);
    function getEvermarkCreationTime(uint256 tokenId) external view returns (uint256);
    function exists(uint256 tokenId) external view returns (bool);
}

interface IEvermarkVoting {
    function getCurrentCycle() external view returns (uint256);
    function getTotalUserVotesInCycle(uint256 cycle, address user) external view returns (uint256);
}

contract NFTStaking is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant STAKING_MANAGER_ROLE = keccak256("STAKING_MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    struct StakingInfo {
        uint256 tokenId;
        address owner;
        uint256 stakedTime;
        uint256 lockPeriod;
        uint256 lastRewardClaim;
        bool active;
        uint256 accumulatedRewards;
    }

    struct LockTier {
        uint256 duration;
        uint256 multiplier; // in basis points (10000 = 1x)
        uint256 minRewardRate; // base reward rate per day
        bool active;
    }

    // Constants
    uint256 public constant MAX_BATCH_SIZE = 50;
    uint256 public constant BASE_REWARD_RATE = 100 * 10**18; // 100 tokens per day base
    uint256 public constant SECONDS_PER_DAY = 86400;

    // Storage
    IEvermarkNFT public evermarkNFT;
    IEvermarkVoting public evermarkVoting;
    IERC20 public rewardToken;
    
    // Lock tiers: 0=flexible, 1=30days, 2=90days, 3=180days, 4=365days
    mapping(uint256 => LockTier) public lockTiers;
    
    // Staking data
    mapping(uint256 => StakingInfo) public stakingInfo; // tokenId => StakingInfo
    mapping(address => uint256[]) public userStakedTokens; // user => tokenId[]
    mapping(uint256 => uint256) public tokenToUserIndex; // tokenId => index in userStakedTokens
    
    // Global stats
    uint256 public totalStakedNFTs;
    uint256 public totalRewardsDistributed;
    
    // Emergency circuit breaker
    uint256 public emergencyPauseTimestamp;
    
    // Events
    event NFTStaked(
        address indexed user,
        uint256 indexed tokenId,
        uint256 lockPeriod,
        uint256 multiplier
    );
    event NFTUnstaked(
        address indexed user,
        uint256 indexed tokenId,
        uint256 rewards
    );
    event RewardsClaimed(
        address indexed user,
        uint256 indexed tokenId,
        uint256 amount
    );
    event LockTierUpdated(
        uint256 indexed tierId,
        uint256 duration,
        uint256 multiplier,
        uint256 minRewardRate
    );
    event EmergencyPauseSet(uint256 timestamp);

    modifier notInEmergency() {
        require(block.timestamp > emergencyPauseTimestamp, "Emergency pause active");
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _evermarkNFT,
        address _rewardToken
    ) external initializer {
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(STAKING_MANAGER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);

        evermarkNFT = IEvermarkNFT(_evermarkNFT);
        rewardToken = IERC20(_rewardToken);
        
        emergencyPauseTimestamp = 0;
        
        // Initialize lock tiers
        _initializeLockTiers();
    }

    function _initializeLockTiers() internal {
        // Flexible staking (no lock)
        lockTiers[0] = LockTier({
            duration: 0,
            multiplier: 10000, // 1x
            minRewardRate: BASE_REWARD_RATE,
            active: true
        });
        
        // 30 days lock
        lockTiers[1] = LockTier({
            duration: 30 days,
            multiplier: 12000, // 1.2x
            minRewardRate: (BASE_REWARD_RATE * 12000) / 10000,
            active: true
        });
        
        // 90 days lock
        lockTiers[2] = LockTier({
            duration: 90 days,
            multiplier: 15000, // 1.5x
            minRewardRate: (BASE_REWARD_RATE * 15000) / 10000,
            active: true
        });
        
        // 180 days lock
        lockTiers[3] = LockTier({
            duration: 180 days,
            multiplier: 20000, // 2x
            minRewardRate: (BASE_REWARD_RATE * 20000) / 10000,
            active: true
        });
        
        // 365 days lock
        lockTiers[4] = LockTier({
            duration: 365 days,
            multiplier: 30000, // 3x
            minRewardRate: (BASE_REWARD_RATE * 30000) / 10000,
            active: true
        });
    }

    function stakeNFT(uint256 tokenId, uint256 lockTierId) external whenNotPaused notInEmergency nonReentrant {
        require(lockTiers[lockTierId].active, "Invalid lock tier");
        require(evermarkNFT.exists(tokenId), "Token does not exist");
        require(evermarkNFT.ownerOf(tokenId) == msg.sender, "Not token owner");
        require(!stakingInfo[tokenId].active, "Token already staked");
        
        // Transfer NFT to staking contract
        IERC721(address(evermarkNFT)).transferFrom(msg.sender, address(this), tokenId);
        
        // Create staking info
        stakingInfo[tokenId] = StakingInfo({
            tokenId: tokenId,
            owner: msg.sender,
            stakedTime: block.timestamp,
            lockPeriod: lockTiers[lockTierId].duration,
            lastRewardClaim: block.timestamp,
            active: true,
            accumulatedRewards: 0
        });
        
        // Add to user's staked tokens
        userStakedTokens[msg.sender].push(tokenId);
        tokenToUserIndex[tokenId] = userStakedTokens[msg.sender].length - 1;
        
        totalStakedNFTs++;
        
        emit NFTStaked(
            msg.sender,
            tokenId,
            lockTiers[lockTierId].duration,
            lockTiers[lockTierId].multiplier
        );
    }

    function unstakeNFT(uint256 tokenId) external whenNotPaused notInEmergency nonReentrant {
        StakingInfo storage info = stakingInfo[tokenId];
        require(info.active, "Token not staked");
        require(info.owner == msg.sender, "Not token owner");
        
        // Check if lock period has passed
        if (info.lockPeriod > 0) {
            require(
                block.timestamp >= info.stakedTime + info.lockPeriod,
                "Lock period not expired"
            );
        }
        
        // Calculate and claim pending rewards
        uint256 pendingRewards = calculatePendingRewards(tokenId);
        if (pendingRewards > 0) {
            info.accumulatedRewards += pendingRewards;
            totalRewardsDistributed += pendingRewards;
            require(rewardToken.transfer(msg.sender, pendingRewards), "Reward transfer failed");
        }
        
        // Return NFT to owner
        IERC721(address(evermarkNFT)).transferFrom(address(this), msg.sender, tokenId);
        
        // Remove from user's staked tokens array
        _removeFromUserStakedTokens(msg.sender, tokenId);
        
        // Mark as inactive
        info.active = false;
        totalStakedNFTs--;
        
        emit NFTUnstaked(msg.sender, tokenId, pendingRewards);
    }

    function claimRewards(uint256 tokenId) external whenNotPaused notInEmergency nonReentrant {
        StakingInfo storage info = stakingInfo[tokenId];
        require(info.active, "Token not staked");
        require(info.owner == msg.sender, "Not token owner");
        
        uint256 pendingRewards = calculatePendingRewards(tokenId);
        require(pendingRewards > 0, "No rewards to claim");
        
        info.lastRewardClaim = block.timestamp;
        info.accumulatedRewards += pendingRewards;
        totalRewardsDistributed += pendingRewards;
        
        require(rewardToken.transfer(msg.sender, pendingRewards), "Reward transfer failed");
        
        emit RewardsClaimed(msg.sender, tokenId, pendingRewards);
    }

    function batchClaimRewards(uint256[] calldata tokenIds) external whenNotPaused notInEmergency nonReentrant {
        require(tokenIds.length <= MAX_BATCH_SIZE, "Batch size too large");
        
        uint256 totalRewards = 0;
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            StakingInfo storage info = stakingInfo[tokenId];
            
            if (info.active && info.owner == msg.sender) {
                uint256 pendingRewards = calculatePendingRewards(tokenId);
                if (pendingRewards > 0) {
                    info.lastRewardClaim = block.timestamp;
                    info.accumulatedRewards += pendingRewards;
                    totalRewards += pendingRewards;
                    
                    emit RewardsClaimed(msg.sender, tokenId, pendingRewards);
                }
            }
        }
        
        if (totalRewards > 0) {
            totalRewardsDistributed += totalRewards;
            require(rewardToken.transfer(msg.sender, totalRewards), "Reward transfer failed");
        }
    }

    function calculatePendingRewards(uint256 tokenId) public view returns (uint256) {
        StakingInfo memory info = stakingInfo[tokenId];
        if (!info.active) return 0;
        
        uint256 stakingDuration = block.timestamp - info.lastRewardClaim;
        if (stakingDuration == 0) return 0;
        
        // Determine lock tier
        uint256 lockTierId = _getLockTierId(info.lockPeriod);
        LockTier memory tier = lockTiers[lockTierId];
        
        // Base reward calculation
        uint256 baseReward = (tier.minRewardRate * stakingDuration) / SECONDS_PER_DAY;
        
        // Apply multiplier
        uint256 multipliedReward = (baseReward * tier.multiplier) / 10000;
        
        return multipliedReward;
    }

    function _getLockTierId(uint256 lockPeriod) internal pure returns (uint256) {
        if (lockPeriod == 0) return 0;
        if (lockPeriod == 30 days) return 1;
        if (lockPeriod == 90 days) return 2;
        if (lockPeriod == 180 days) return 3;
        if (lockPeriod == 365 days) return 4;
        return 0; // Default to flexible
    }

    function _removeFromUserStakedTokens(address user, uint256 tokenId) internal {
        uint256[] storage userTokens = userStakedTokens[user];
        uint256 index = tokenToUserIndex[tokenId];
        
        // Move last element to the index of the element to remove
        if (index < userTokens.length - 1) {
            uint256 lastTokenId = userTokens[userTokens.length - 1];
            userTokens[index] = lastTokenId;
            tokenToUserIndex[lastTokenId] = index;
        }
        
        // Remove last element
        userTokens.pop();
        delete tokenToUserIndex[tokenId];
    }

    function getUserStakedNFTs(address user) external view returns (
        uint256[] memory tokenIds,
        uint256[] memory stakedTimes,
        uint256[] memory lockPeriods,
        uint256[] memory pendingRewards,
        bool[] memory canUnstake
    ) {
        uint256[] memory userTokens = userStakedTokens[user];
        uint256 length = userTokens.length;
        
        tokenIds = new uint256[](length);
        stakedTimes = new uint256[](length);
        lockPeriods = new uint256[](length);
        pendingRewards = new uint256[](length);
        canUnstake = new bool[](length);
        
        for (uint256 i = 0; i < length; i++) {
            uint256 tokenId = userTokens[i];
            StakingInfo memory info = stakingInfo[tokenId];
            
            tokenIds[i] = tokenId;
            stakedTimes[i] = info.stakedTime;
            lockPeriods[i] = info.lockPeriod;
            pendingRewards[i] = calculatePendingRewards(tokenId);
            canUnstake[i] = info.lockPeriod == 0 || 
                           block.timestamp >= info.stakedTime + info.lockPeriod;
        }
    }

    function getUserStakingSummary(address user) external view returns (
        uint256 totalStaked,
        uint256 totalPendingRewards,
        uint256 totalAccumulatedRewards,
        uint256 flexibleStaked,
        uint256 lockedStaked
    ) {
        uint256[] memory userTokens = userStakedTokens[user];
        
        for (uint256 i = 0; i < userTokens.length; i++) {
            uint256 tokenId = userTokens[i];
            StakingInfo memory info = stakingInfo[tokenId];
            
            if (info.active) {
                totalStaked++;
                totalPendingRewards += calculatePendingRewards(tokenId);
                totalAccumulatedRewards += info.accumulatedRewards;
                
                if (info.lockPeriod == 0) {
                    flexibleStaked++;
                } else {
                    lockedStaked++;
                }
            }
        }
    }

    function getStakingInfo(uint256 tokenId) external view returns (
        address owner,
        uint256 stakedTime,
        uint256 lockPeriod,
        uint256 lastRewardClaim,
        uint256 accumulatedRewards,
        uint256 pendingRewards,
        bool canUnstake,
        bool active
    ) {
        StakingInfo memory info = stakingInfo[tokenId];
        
        return (
            info.owner,
            info.stakedTime,
            info.lockPeriod,
            info.lastRewardClaim,
            info.accumulatedRewards,
            calculatePendingRewards(tokenId),
            info.lockPeriod == 0 || block.timestamp >= info.stakedTime + info.lockPeriod,
            info.active
        );
    }

    function getLockTierInfo(uint256 tierId) external view returns (
        uint256 duration,
        uint256 multiplier,
        uint256 minRewardRate,
        bool active
    ) {
        LockTier memory tier = lockTiers[tierId];
        return (tier.duration, tier.multiplier, tier.minRewardRate, tier.active);
    }

    function getAllLockTiers() external view returns (
        uint256[] memory durations,
        uint256[] memory multipliers,
        uint256[] memory minRewardRates,
        bool[] memory actives
    ) {
        durations = new uint256[](5);
        multipliers = new uint256[](5);
        minRewardRates = new uint256[](5);
        actives = new bool[](5);
        
        for (uint256 i = 0; i < 5; i++) {
            LockTier memory tier = lockTiers[i];
            durations[i] = tier.duration;
            multipliers[i] = tier.multiplier;
            minRewardRates[i] = tier.minRewardRate;
            actives[i] = tier.active;
        }
    }

    // Admin functions for distributing rewards (called by rewards contract)
    function distributeRewards(address[] calldata users, uint256[] calldata amounts) external onlyRole(STAKING_MANAGER_ROLE) {
        require(users.length == amounts.length, "Array length mismatch");
        require(users.length <= MAX_BATCH_SIZE, "Batch size too large");
        
        for (uint256 i = 0; i < users.length; i++) {
            if (amounts[i] > 0) {
                require(rewardToken.transfer(users[i], amounts[i]), "Reward transfer failed");
                totalRewardsDistributed += amounts[i];
            }
        }
    }

    function setEmergencyPause(uint256 pauseUntilTimestamp) external onlyRole(ADMIN_ROLE) {
        emergencyPauseTimestamp = pauseUntilTimestamp;
        emit EmergencyPauseSet(pauseUntilTimestamp);
    }

    function clearEmergencyPause() external onlyRole(ADMIN_ROLE) {
        emergencyPauseTimestamp = 0;
        emit EmergencyPauseSet(0);
    }

    function updateLockTier(
        uint256 tierId,
        uint256 duration,
        uint256 multiplier,
        uint256 minRewardRate,
        bool active
    ) external onlyRole(ADMIN_ROLE) {
        require(tierId < 5, "Invalid tier ID");
        require(multiplier >= 10000, "Multiplier must be >= 1x");
        
        lockTiers[tierId] = LockTier({
            duration: duration,
            multiplier: multiplier,
            minRewardRate: minRewardRate,
            active: active
        });
        
        emit LockTierUpdated(tierId, duration, multiplier, minRewardRate);
    }

    function setEvermarkVoting(address _evermarkVoting) external onlyRole(ADMIN_ROLE) {
        require(_evermarkVoting != address(0), "Invalid address");
        evermarkVoting = IEvermarkVoting(_evermarkVoting);
    }

    function setRewardToken(address _rewardToken) external onlyRole(ADMIN_ROLE) {
        require(_rewardToken != address(0), "Invalid token address");
        rewardToken = IERC20(_rewardToken);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function emergencyWithdraw(address token, uint256 amount, address recipient) external onlyRole(ADMIN_ROLE) {
        require(recipient != address(0), "Invalid recipient");
        
        if (token == address(0)) {
            (bool success, ) = payable(recipient).call{value: amount}("");
            require(success, "ETH withdrawal failed");
        } else {
            IERC20(token).transfer(recipient, amount);
        }
    }

    function emergencyUnstakeNFT(uint256 tokenId, address recipient) external onlyRole(ADMIN_ROLE) {
        require(stakingInfo[tokenId].active, "Token not staked");
        require(recipient != address(0), "Invalid recipient");
        
        StakingInfo storage info = stakingInfo[tokenId];
        address originalOwner = info.owner;
        
        // Return NFT
        IERC721(address(evermarkNFT)).transferFrom(address(this), recipient, tokenId);
        
        // Remove from user's staked tokens
        _removeFromUserStakedTokens(originalOwner, tokenId);
        
        // Mark as inactive
        info.active = false;
        totalStakedNFTs--;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // Receive function for emergency ETH recovery
    receive() external payable {}
}