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

    modifier notInEmergency() {
        require(block.timestamp > emergencyPauseTimestamp);
        _;
    }

    constructor() {
        _disableInitializers();
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

    function emergencyWithdraw() external onlyRole(ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0);
        
        (bool success, ) = payable(msg.sender).call{value: balance}("");
        require(success);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    function supportsInterface(bytes4 interfaceId) public view override(ERC721Upgradeable, AccessControlUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}