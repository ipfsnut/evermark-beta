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

    event NFTStaked(address indexed staker, uint256 indexed tokenId, uint256 timestamp);
    event UnbondingStarted(address indexed staker, uint256 indexed tokenId, uint256 unbondingEnd);
    event NFTUnstaked(address indexed staker, uint256 indexed tokenId, uint256 timestamp);
    event EmergencyPauseUpdated(uint256 pauseUntilTimestamp);

    modifier notInEmergency() {
        require(block.timestamp > emergencyPauseTimestamp, "Emergency pause active");
        _;
    }

    constructor() {
        _disableInitializers();
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

    function emergencyUnstakeNFT(uint256 tokenId, address recipient) external onlyRole(ADMIN_ROLE) {
        require(stakes[tokenId].staker != address(0), "NFT not staked");
        
        address originalStaker = stakes[tokenId].staker;
        _removeFromUserTokens(originalStaker, tokenId);
        delete stakes[tokenId];
        totalStakedNFTs--;

        evermarkNFT.safeTransferFrom(address(this), recipient, tokenId);
        
        emit NFTUnstaked(originalStaker, tokenId, block.timestamp);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}