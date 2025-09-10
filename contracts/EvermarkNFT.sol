// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

interface IFeeCollector {
    function collectNftCreationFees() external payable;
}

contract EvermarkNFT is 
    Initializable,
    ERC721Upgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 public constant MINTING_FEE = 0.00007 ether;
    uint256 public constant REFERRAL_PERCENTAGE = 10;

    struct EvermarkMetadata {
        string title;
        string creator;
        string metadataURI;
        uint256 creationTime;
        address minter;
        address referrer;
    }

    uint256 private _nextTokenId;
    address public feeCollector;
    uint256 public emergencyPauseTimestamp;
    
    // Emergency Security Enhancements
    uint256 public constant EMERGENCY_DELAY = 48 hours;
    uint256 public constant UPGRADE_DELAY = 7 days;
    address public emergencyMultisig;
    mapping(bytes32 => uint256) public emergencyProposals;
    mapping(address => uint256) public pendingUpgrades;
    mapping(bytes32 => mapping(address => uint256)) public roleTransitions;
    uint256 public constant ROLE_DELAY = 48 hours;
    
    mapping(uint256 => EvermarkMetadata) public evermarkData;
    mapping(address => uint256) public referralCounts;
    mapping(address => uint256) public referralEarnings;
    mapping(uint256 => address) public evermarkReferrers;
    mapping(address => uint256) public pendingReferralPayments;
    
    event EvermarkMinted(uint256 indexed tokenId, address indexed minter, address indexed referrer, string title);
    event ReferralEarned(address indexed referrer, address indexed referred, uint256 amount);
    event ReferralPaymentFailed(address indexed referrer, address indexed referred, uint256 amount);
    event ReferralPaymentClaimed(address indexed referrer, uint256 amount);
    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);
    event FeeCollectionFailed(uint256 amount, string reason);
    event FeeCollectionSucceeded(uint256 amount);
    
    // Security Events
    event EmergencyWithdrawProposed(uint256 amount, uint256 executeAfter);
    event EmergencyWithdrawExecuted(uint256 amount, address recipient);
    event UpgradeProposed(address indexed newImplementation, uint256 executeAfter);
    event UpgradeExecuted(address indexed newImplementation);
    event RoleTransitionProposed(bytes32 indexed role, address indexed account, uint256 executeAfter);
    event RoleTransitionExecuted(bytes32 indexed role, address indexed account);
    event EmergencyMultisigUpdated(address indexed oldMultisig, address indexed newMultisig);

    modifier notInEmergency() {
        require(block.timestamp > emergencyPauseTimestamp);
        _;
    }
    
    modifier onlyEmergencyMultisig() {
        require(msg.sender == emergencyMultisig, "Not emergency multisig");
        _;
    }

    function initialize() external initializer {
        __ERC721_init("Evermark", "EVERMARK");
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        
        _nextTokenId = 1;
    }

    function mintEvermark(
        string calldata metadataURI,
        string calldata title, 
        string calldata creator
    ) external payable whenNotPaused notInEmergency returns (uint256) {
        return mintEvermarkWithReferral(metadataURI, title, creator, address(0));
    }

    function mintEvermarkWithReferral(
        string calldata metadataURI,
        string calldata title, 
        string calldata creator,
        address referrer
    ) public payable whenNotPaused notInEmergency nonReentrant returns (uint256) {
        require(msg.value >= MINTING_FEE);
        require(referrer != msg.sender);
        require(bytes(title).length > 0 && bytes(title).length <= 200);
        require(bytes(metadataURI).length > 0 && bytes(metadataURI).length <= 500);

        uint256 tokenId = _nextTokenId++;
        
        evermarkData[tokenId] = EvermarkMetadata({
            title: title,
            creator: creator,
            metadataURI: metadataURI,
            creationTime: block.timestamp,
            minter: msg.sender,
            referrer: referrer
        });

        _safeMint(msg.sender, tokenId);

        uint256 referralFee = 0;
        if (referrer != address(0)) {
            referralFee = (msg.value * REFERRAL_PERCENTAGE) / 100;
            
            (bool success, ) = payable(referrer).call{value: referralFee}("");
            if (success) {
                referralCounts[referrer]++;
                referralEarnings[referrer] += referralFee;
                emit ReferralEarned(referrer, msg.sender, referralFee);
            } else {
                pendingReferralPayments[referrer] += referralFee;
                referralCounts[referrer]++;
                emit ReferralPaymentFailed(referrer, msg.sender, referralFee);
            }
            
            evermarkReferrers[tokenId] = referrer;
        }

        uint256 remainingFee = msg.value - referralFee;
        if (remainingFee > 0 && feeCollector != address(0)) {
            try IFeeCollector(feeCollector).collectNftCreationFees{value: remainingFee}() {
                emit FeeCollectionSucceeded(remainingFee);
            } catch Error(string memory reason) {
                emit FeeCollectionFailed(remainingFee, reason);
            } catch {
                emit FeeCollectionFailed(remainingFee, "Error");
            }
        }

        emit EvermarkMinted(tokenId, msg.sender, referrer, title);
        return tokenId;
    }

    function claimPendingReferralPayment() external nonReentrant whenNotPaused {
        uint256 amount = pendingReferralPayments[msg.sender];
        require(amount > 0);
        
        pendingReferralPayments[msg.sender] = 0;
        referralEarnings[msg.sender] += amount;
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success);
        
        emit ReferralPaymentClaimed(msg.sender, amount);
    }

    function mintEvermarkFor(
        address to,
        string calldata metadataURI,
        string calldata title,
        string calldata creator
    ) external onlyRole(MINTER_ROLE) whenNotPaused notInEmergency returns (uint256) {
        require(to != address(0));
        require(bytes(title).length > 0 && bytes(title).length <= 200);
        require(bytes(metadataURI).length > 0 && bytes(metadataURI).length <= 500);

        uint256 tokenId = _nextTokenId++;
        
        evermarkData[tokenId] = EvermarkMetadata({
            title: title,
            creator: creator,
            metadataURI: metadataURI,
            creationTime: block.timestamp,
            minter: to,
            referrer: address(0)
        });

        _safeMint(to, tokenId);
        emit EvermarkMinted(tokenId, to, address(0), title);
        return tokenId;
    }

    function processStuckFees() external onlyRole(ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0 && feeCollector != address(0));
        
        IFeeCollector(feeCollector).collectNftCreationFees{value: balance}();
        emit FeeCollectionSucceeded(balance);
    }

    function getEvermarkMetadata(uint256 tokenId) external view returns (string memory, string memory, string memory) {
        require(_ownerOf(tokenId) != address(0));
        EvermarkMetadata memory data = evermarkData[tokenId];
        return (data.title, data.creator, data.metadataURI);
    }

    function exists(uint256 tokenId) external view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0));
        return evermarkData[tokenId].metadataURI;
    }

    function setEmergencyPause(uint256 pauseUntilTimestamp) external onlyRole(ADMIN_ROLE) {
        emergencyPauseTimestamp = pauseUntilTimestamp;
    }

    function setFeeCollector(address _feeCollector) external onlyRole(ADMIN_ROLE) {
        address oldCollector = feeCollector;
        feeCollector = _feeCollector;
        emit FeeCollectorUpdated(oldCollector, _feeCollector);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // SECURE EMERGENCY WITHDRAW SYSTEM
    function proposeEmergencyWithdraw(uint256 amount) external onlyRole(ADMIN_ROLE) {
        require(amount > 0 && amount <= address(this).balance, "Invalid amount");
        bytes32 proposalHash = keccak256(abi.encodePacked(amount, block.timestamp));
        emergencyProposals[proposalHash] = block.timestamp + EMERGENCY_DELAY;
        emit EmergencyWithdrawProposed(amount, block.timestamp + EMERGENCY_DELAY);
    }
    
    function executeEmergencyWithdraw(uint256 amount, address recipient) external onlyEmergencyMultisig {
        require(recipient != address(0), "Invalid recipient");
        bytes32 proposalHash = keccak256(abi.encodePacked(amount, block.timestamp - EMERGENCY_DELAY));
        require(emergencyProposals[proposalHash] != 0, "No valid proposal");
        require(block.timestamp >= emergencyProposals[proposalHash], "Delay not met");
        require(amount <= address(this).balance, "Insufficient balance");
        
        delete emergencyProposals[proposalHash];
        
        (bool success, ) = payable(recipient).call{value: amount}("");
        require(success, "Transfer failed");
        
        emit EmergencyWithdrawExecuted(amount, recipient);
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

    function supportsInterface(bytes4 interfaceId) public view override(ERC721Upgradeable, AccessControlUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}