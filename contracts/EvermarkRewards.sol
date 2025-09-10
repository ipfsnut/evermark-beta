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

contract EvermarkRewards is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;


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
    mapping(address => uint256) public ethRewards_user;
    mapping(address => uint256) public emarkRewards_user;

    uint256 public lastEthPoolSnapshot;
    uint256 public lastEmarkPoolSnapshot;

    uint256 public emergencyPauseUntil;
    
    // Emergency Security Enhancements
    uint256 public constant EMERGENCY_DELAY = 48 hours;
    uint256 public constant UPGRADE_DELAY = 7 days;
    uint256 public constant ROLE_DELAY = 48 hours;
    address public emergencyMultisig;
    mapping(bytes32 => uint256) public emergencyProposals;
    mapping(address => uint256) public pendingUpgrades;
    mapping(bytes32 => mapping(address => uint256)) public roleTransitions;
    
    // Circuit Breaker
    uint256 public dailyWithdrawLimit = 100 ether; // Higher limit for rewards contract
    uint256 public dailyWithdrawn;
    uint256 public lastWithdrawReset;
    
    // V2 Storage (added for upgrade)
    uint256 public currentPeriodNumber;


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
    
    // Security Events
    event EmergencyWithdrawProposed(address token, uint256 amount, uint256 executeAfter);
    event EmergencyWithdrawExecuted(address token, uint256 amount, address recipient);
    event UpgradeProposed(address indexed newImplementation, uint256 executeAfter);
    event UpgradeExecuted(address indexed newImplementation);
    event RoleTransitionProposed(bytes32 indexed role, address indexed account, uint256 executeAfter);
    event RoleTransitionExecuted(bytes32 indexed role, address indexed account);
    event EmergencyMultisigUpdated(address indexed oldMultisig, address indexed newMultisig);
    event DailyLimitUpdated(uint256 newLimit);

    function initialize(
        address _emarkToken,           
        address _stakingToken,
        address _wethToken,
        uint256 _wethDistributionRate,
        uint256 _emarkDistributionRate,
        uint256 _rebalancePeriod
    ) external initializer {
        require(_emarkToken != address(0), "Invalid EMARK token");
        require(_stakingToken != address(0), "Invalid staking token");
        require(_wethToken != address(0), "Invalid WETH token");
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
        wethToken = IERC20(_wethToken);
        stakingToken = IStakingToken(_stakingToken);
        ethDistributionRate = _wethDistributionRate;
        emarkDistributionRate = _emarkDistributionRate;
        rebalancePeriod = _rebalancePeriod;
        
        _initializePeriod();
    }


    modifier updateReward(address account) {
        _checkAndRebalance();
        _updateEthRewards(account);
        _updateEmarkRewards(account);
        _;
    }

    modifier onlyWhenActive() {
        require(block.timestamp > emergencyPauseUntil, "Emergency pause active");
        _;
    }
    
    modifier onlyEmergencyMultisig() {
        require(msg.sender == emergencyMultisig, "Not emergency multisig");
        _;
    }
    
    modifier circuitBreaker(uint256 amount) {
        if (block.timestamp >= lastWithdrawReset + 1 days) {
            dailyWithdrawn = 0;
            lastWithdrawReset = block.timestamp;
        }
        require(dailyWithdrawn + amount <= dailyWithdrawLimit, "Daily limit exceeded");
        dailyWithdrawn += amount;
        _;
    }


    function _initializePeriod() internal {
        currentPeriodNumber = 1;
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
        _updateEthRewards(address(0));
        _updateEmarkRewards(address(0));
        
        lastEthPoolSnapshot = wethToken.balanceOf(address(this));    // WETH pool snapshot
        lastEmarkPoolSnapshot = emarkToken.balanceOf(address(this));
        
        _calculateNewRates();
        
        currentPeriodStart = block.timestamp;
        currentPeriodEnd = block.timestamp + rebalancePeriod;
        currentPeriodNumber += 1;
        
        emit PeriodRebalanced(
            currentPeriodNumber,
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


    function totalSupply() external view returns (uint256) {
        return stakingToken.totalSupply();
    }

    function balanceOf(address account) external view returns (uint256) {
        return stakingToken.balanceOf(account);
    }

    /**
     * @notice Get current period status for frontend display
     */
    function getPeriodStatus() external view returns (
        uint256 currentPeriod,
        uint256 periodEnd,
        uint256 wethRate,
        uint256 emarkRate
    ) {
        currentPeriod = currentPeriodNumber;
        periodEnd = currentPeriodEnd;
        wethRate = ethRewardRate;
        emarkRate = emarkRewardRate;
    }

    /**
     * @notice Get detailed period information for admin use
     */
    function getDetailedPeriodStatus() external view returns (
        uint256 periodNumber,
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
        periodNumber = currentPeriodNumber;
        periodStart = currentPeriodStart;
        periodEnd = currentPeriodEnd;
        timeUntilRebalance = block.timestamp >= currentPeriodEnd ? 0 : currentPeriodEnd - block.timestamp;
        
        currentEthPool = wethToken.balanceOf(address(this));         // WETH pool balance
        currentEmarkPool = emarkToken.balanceOf(address(this));
        currentEthRate = ethRewardRate;
        currentEmarkRate = emarkRewardRate;
        
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


    function claimRewards() external nonReentrant whenNotPaused onlyWhenActive updateReward(msg.sender) {
        uint256 ethReward = ethRewards_user[msg.sender];    // WETH reward amount
        uint256 emarkReward = emarkRewards_user[msg.sender];
        
        require(ethReward > 0 || emarkReward > 0, "No rewards to claim");
        
        if (ethReward > 0) {
            ethRewards_user[msg.sender] = 0;
            ethTotalDistributed += ethReward;
            
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

    function setRebalancePeriod(uint256 _period) external onlyRole(ADMIN_ROLE) {
        require(_period >= 1 hours, "Period too short");
        rebalancePeriod = _period;
    }

    function setWethToken(address _wethToken) external onlyRole(ADMIN_ROLE) {
        require(_wethToken != address(0), "Invalid WETH address");
        wethToken = IERC20(_wethToken);
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


    // SECURE EMERGENCY WITHDRAW SYSTEM
    function proposeEmergencyWithdraw(address token, uint256 amount) external onlyRole(ADMIN_ROLE) {
        require(token != address(0), "Invalid token");
        require(amount > 0, "Invalid amount");
        
        uint256 balance;
        if (token == address(wethToken)) {
            balance = wethToken.balanceOf(address(this));
        } else if (token == address(emarkToken)) {
            balance = emarkToken.balanceOf(address(this));
        } else {
            revert("Only WETH/EMARK withdrawals allowed");
        }
        
        require(amount <= balance, "Insufficient balance");
        bytes32 proposalHash = keccak256(abi.encodePacked(token, amount, block.timestamp));
        emergencyProposals[proposalHash] = block.timestamp + EMERGENCY_DELAY;
        emit EmergencyWithdrawProposed(token, amount, block.timestamp + EMERGENCY_DELAY);
    }
    
    function executeEmergencyWithdraw(address token, uint256 amount, address recipient) external onlyEmergencyMultisig circuitBreaker(amount) {
        require(recipient != address(0), "Invalid recipient");
        require(token == address(wethToken) || token == address(emarkToken), "Invalid token");
        
        bytes32 proposalHash = keccak256(abi.encodePacked(token, amount, block.timestamp - EMERGENCY_DELAY));
        require(emergencyProposals[proposalHash] != 0, "No valid proposal");
        require(block.timestamp >= emergencyProposals[proposalHash], "Delay not met");
        
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(amount <= balance, "Insufficient balance");
        
        delete emergencyProposals[proposalHash];
        IERC20(token).safeTransfer(recipient, amount);
        
        emit EmergencyWithdrawExecuted(token, amount, recipient);
    }
    
    function setEmergencyMultisig(address _multisig) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_multisig != address(0), "Invalid multisig address");
        address oldMultisig = emergencyMultisig;
        emergencyMultisig = _multisig;
        emit EmergencyMultisigUpdated(oldMultisig, _multisig);
    }
    
    function setDailyWithdrawLimit(uint256 _limit) external onlyRole(ADMIN_ROLE) {
        dailyWithdrawLimit = _limit;
        emit DailyLimitUpdated(_limit);
    }
    
    // SECURE ROLE MANAGEMENT SYSTEM
    function proposeRoleGrant(bytes32 role, address account) external onlyRole(getRoleAdmin(role)) {
        require(account != address(0), "Invalid account");
        if (role == ADMIN_ROLE || role == UPGRADER_ROLE || role == DEFAULT_ADMIN_ROLE) {
            roleTransitions[role][account] = block.timestamp + ROLE_DELAY;
            emit RoleTransitionProposed(role, account, block.timestamp + ROLE_DELAY);
        } else {
            // For non-critical roles, grant immediately
            super.grantRole(role, account);
        }
    }
    
    function executeRoleGrant(bytes32 role, address account) external onlyRole(getRoleAdmin(role)) {
        require(roleTransitions[role][account] != 0, "No pending transition");
        require(block.timestamp >= roleTransitions[role][account], "Delay not met");
        delete roleTransitions[role][account];
        super.grantRole(role, account);
        emit RoleTransitionExecuted(role, account);
    }
    
    // Override grantRole to enforce delays for critical roles
    function grantRole(bytes32 role, address account) public override {
        if (role == ADMIN_ROLE || role == UPGRADER_ROLE || role == DEFAULT_ADMIN_ROLE) {
            // Force use of secure proposal system for critical roles
            revert("Use proposeRoleGrant for critical roles");
        } else {
            super.grantRole(role, account);
        }
    }
    
    // SECURE UPGRADE SYSTEM
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
    
    /**
     * @notice Initialize V2 upgrade - sets period number if not already set
     */
    function initializeV2() external onlyRole(ADMIN_ROLE) {
        if (currentPeriodNumber == 0) {
            currentPeriodNumber = 1;
        }
    }
}