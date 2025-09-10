// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IEvermarkNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    function exists(uint256 tokenId) external view returns (bool);
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
}

contract NFTStaking is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    struct StakeInfo {
        address staker;
        uint256 stakedTime;
        uint256 unbondingStartTime;
        bool isUnbonding;
    }

    IEvermarkNFT public evermarkNFT;
    uint256 public constant UNBONDING_PERIOD = 7 days;
    
    mapping(uint256 => StakeInfo) public stakes;
    mapping(address => uint256[]) public userStakedTokens;
    mapping(uint256 => uint256) private tokenToUserIndex;
    
    uint256 public totalStakedNFTs;
    uint256 public emergencyPauseTimestamp;
    
    // Emergency Security Enhancements
    uint256 public constant EMERGENCY_DELAY = 48 hours;
    uint256 public constant UPGRADE_DELAY = 7 days;
    uint256 public constant ROLE_DELAY = 48 hours;
    address public emergencyMultisig;
    mapping(bytes32 => uint256) public emergencyProposals;
    mapping(address => uint256) public pendingUpgrades;
    mapping(bytes32 => mapping(address => uint256)) public roleTransitions;

    event NFTStaked(address indexed staker, uint256 indexed tokenId, uint256 timestamp);
    event UnbondingStarted(address indexed staker, uint256 indexed tokenId, uint256 unbondingEnd);
    event NFTUnstaked(address indexed staker, uint256 indexed tokenId, uint256 timestamp);
    event EmergencyPauseUpdated(uint256 pauseUntilTimestamp);
    
    // Security Events
    event EmergencyNFTWithdrawProposed(uint256 indexed tokenId, uint256 executeAfter);
    event EmergencyNFTWithdrawExecuted(uint256 indexed tokenId, address recipient);
    event UpgradeProposed(address indexed newImplementation, uint256 executeAfter);
    event UpgradeExecuted(address indexed newImplementation);
    event RoleTransitionProposed(bytes32 indexed role, address indexed account, uint256 executeAfter);
    event RoleTransitionExecuted(bytes32 indexed role, address indexed account);
    event EmergencyMultisigUpdated(address indexed oldMultisig, address indexed newMultisig);

    modifier notInEmergency() {
        require(block.timestamp > emergencyPauseTimestamp, "Emergency pause active");
        _;
    }
    
    modifier onlyEmergencyMultisig() {
        require(msg.sender == emergencyMultisig, "Not emergency multisig");
        _;
    }

    function initialize(address _evermarkNFT) external initializer {
        require(_evermarkNFT != address(0), "Invalid NFT address");
        
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);

        evermarkNFT = IEvermarkNFT(_evermarkNFT);
        emergencyPauseTimestamp = 0;
    }

    function stakeNFT(uint256 tokenId) external whenNotPaused notInEmergency nonReentrant {
        require(evermarkNFT.exists(tokenId), "NFT does not exist");
        require(evermarkNFT.ownerOf(tokenId) == msg.sender, "Not NFT owner");
        require(stakes[tokenId].staker == address(0), "NFT already staked");

        evermarkNFT.safeTransferFrom(msg.sender, address(this), tokenId);

        stakes[tokenId] = StakeInfo({
            staker: msg.sender,
            stakedTime: block.timestamp,
            unbondingStartTime: 0,
            isUnbonding: false
        });

        userStakedTokens[msg.sender].push(tokenId);
        tokenToUserIndex[tokenId] = userStakedTokens[msg.sender].length - 1;
        totalStakedNFTs++;

        emit NFTStaked(msg.sender, tokenId, block.timestamp);
    }

    function startUnbonding(uint256 tokenId) external whenNotPaused notInEmergency nonReentrant {
        StakeInfo storage stake = stakes[tokenId];
        require(stake.staker == msg.sender, "Not your staked NFT");
        require(!stake.isUnbonding, "Already unbonding");

        stake.unbondingStartTime = block.timestamp;
        stake.isUnbonding = true;

        uint256 unbondingEnd = block.timestamp + UNBONDING_PERIOD;
        emit UnbondingStarted(msg.sender, tokenId, unbondingEnd);
    }

    function unstakeNFT(uint256 tokenId) external whenNotPaused notInEmergency nonReentrant {
        StakeInfo storage stake = stakes[tokenId];
        require(stake.staker == msg.sender, "Not your staked NFT");
        require(stake.isUnbonding, "Must start unbonding first");
        require(
            block.timestamp >= stake.unbondingStartTime + UNBONDING_PERIOD,
            "Unbonding period not complete"
        );

        _removeFromUserTokens(msg.sender, tokenId);
        delete stakes[tokenId];
        totalStakedNFTs--;

        evermarkNFT.safeTransferFrom(address(this), msg.sender, tokenId);

        emit NFTUnstaked(msg.sender, tokenId, block.timestamp);
    }

    function _removeFromUserTokens(address user, uint256 tokenId) private {
        uint256[] storage userTokens = userStakedTokens[user];
        uint256 tokenIndex = tokenToUserIndex[tokenId];
        uint256 lastTokenIndex = userTokens.length - 1;
        
        if (tokenIndex != lastTokenIndex) {
            uint256 lastTokenId = userTokens[lastTokenIndex];
            userTokens[tokenIndex] = lastTokenId;
            tokenToUserIndex[lastTokenId] = tokenIndex;
        }
        
        userTokens.pop();
        delete tokenToUserIndex[tokenId];
    }

    function isStaked(uint256 tokenId) external view returns (bool) {
        return stakes[tokenId].staker != address(0);
    }

    function getStakeInfo(uint256 tokenId) external view returns (
        address staker,
        uint256 stakedTime,
        uint256 unbondingStartTime,
        bool isUnbonding,
        uint256 timeUntilUnstake
    ) {
        StakeInfo memory stake = stakes[tokenId];
        
        uint256 timeUntil = 0;
        if (stake.isUnbonding && stake.unbondingStartTime + UNBONDING_PERIOD > block.timestamp) {
            timeUntil = (stake.unbondingStartTime + UNBONDING_PERIOD) - block.timestamp;
        }
        
        return (
            stake.staker,
            stake.stakedTime,
            stake.unbondingStartTime,
            stake.isUnbonding,
            timeUntil
        );
    }

    function getUserStakedTokens(address user) external view returns (uint256[] memory) {
        return userStakedTokens[user];
    }

    function getUserStakeCount(address user) external view returns (uint256) {
        return userStakedTokens[user].length;
    }

    function isVerifiedCreator(address user) external view returns (bool) {
        return userStakedTokens[user].length > 0;
    }

    function canUnstake(uint256 tokenId) external view returns (bool) {
        StakeInfo memory stake = stakes[tokenId];
        return stake.isUnbonding && 
               block.timestamp >= stake.unbondingStartTime + UNBONDING_PERIOD;
    }

    function setEmergencyPause(uint256 pauseUntilTimestamp) external onlyRole(ADMIN_ROLE) {
        emergencyPauseTimestamp = pauseUntilTimestamp;
        emit EmergencyPauseUpdated(pauseUntilTimestamp);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // SECURE EMERGENCY WITHDRAW SYSTEM
    function proposeEmergencyNFTWithdraw(uint256 tokenId) external onlyRole(ADMIN_ROLE) {
        require(stakes[tokenId].staker != address(0), "NFT not staked");
        bytes32 proposalHash = keccak256(abi.encodePacked(tokenId, block.timestamp));
        emergencyProposals[proposalHash] = block.timestamp + EMERGENCY_DELAY;
        emit EmergencyNFTWithdrawProposed(tokenId, block.timestamp + EMERGENCY_DELAY);
    }
    
    function executeEmergencyNFTWithdraw(uint256 tokenId, address recipient) external onlyEmergencyMultisig {
        require(recipient != address(0), "Invalid recipient");
        require(stakes[tokenId].staker != address(0), "NFT not staked");
        
        bytes32 proposalHash = keccak256(abi.encodePacked(tokenId, block.timestamp - EMERGENCY_DELAY));
        require(emergencyProposals[proposalHash] != 0, "No valid proposal");
        require(block.timestamp >= emergencyProposals[proposalHash], "Delay not met");
        
        address originalStaker = stakes[tokenId].staker;
        _removeFromUserTokens(originalStaker, tokenId);
        delete stakes[tokenId];
        totalStakedNFTs--;
        delete emergencyProposals[proposalHash];

        evermarkNFT.safeTransferFrom(address(this), recipient, tokenId);
        
        emit EmergencyNFTWithdrawExecuted(tokenId, recipient);
    }
    
    function setEmergencyMultisig(address _multisig) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_multisig != address(0), "Invalid multisig address");
        address oldMultisig = emergencyMultisig;
        emergencyMultisig = _multisig;
        emit EmergencyMultisigUpdated(oldMultisig, _multisig);
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

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}