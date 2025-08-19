// SPDX-License-Identifier: MIT
// Evermark-Beta
pragma solidity ^0.8.19;

/*
 ███████╗███████╗███████╗     ██████╗ ██████╗ ██╗     ██╗     ███████╗ ██████╗████████╗ ██████╗ ██████╗ 
 ██╔════╝██╔════╝██╔════╝    ██╔════╝██╔═══██╗██║     ██║     ██╔════╝██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗
 █████╗  █████╗  █████╗      ██║     ██║   ██║██║     ██║     █████╗  ██║        ██║   ██║   ██║██████╔╝
 ██╔══╝  ██╔══╝  ██╔══╝      ██║     ██║   ██║██║     ██║     ██╔══╝  ██║        ██║   ██║   ██║██╔══██╗
 ██║     ███████╗███████╗    ╚██████╗╚██████╔╝███████╗███████╗███████╗╚██████╗   ██║   ╚██████╔╝██║  ██║
 ╚═╝     ╚══════╝╚══════╝     ╚═════╝ ╚═════╝ ╚══════╝╚══════╝╚══════╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝
*/

/**
 * @title FeeCollector
 * @notice Simple Fee Collector for Evermark NFT
 * Takes fees and sends them to specified wallet - nothing more, nothing less
 */
contract FeeCollector {
    address public feeRecipient;
    address public owner;
    
    event FeesCollected(uint256 amount, address from);
    event FeeRecipientChanged(address indexed oldRecipient, address indexed newRecipient);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    constructor(address _feeRecipient) {
        require(_feeRecipient != address(0), "Invalid recipient");
        feeRecipient = _feeRecipient;
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }
    
    /**
     * @notice Collect NFT creation fees and forward to recipient
     */
    function collectNftCreationFees() external payable {
        require(msg.value > 0, "No fees sent");
        
        // Forward all fees to recipient
        (bool success,) = feeRecipient.call{value: msg.value}("");
        require(success, "Fee transfer failed");
        
        emit FeesCollected(msg.value, msg.sender);
    }
    
    /**
     * @notice Get fee recipient address
     */
    function getFeeRecipient() external view returns (address) {
        return feeRecipient;
    }
    
    /**
     * @notice Change the fee recipient address
     */
    function setFeeRecipient(address _newRecipient) external onlyOwner {
        require(_newRecipient != address(0), "Invalid recipient");
        address oldRecipient = feeRecipient;
        feeRecipient = _newRecipient;
        emit FeeRecipientChanged(oldRecipient, _newRecipient);
    }
    
    /**
     * @notice Transfer ownership to a new address
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid owner");
        address oldOwner = owner;
        owner = _newOwner;
        emit OwnershipTransferred(oldOwner, _newOwner);
    }
    
    /**
     * @notice Emergency recovery (just in case)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success,) = feeRecipient.call{value: balance}("");
            require(success, "Emergency withdrawal failed");
        }
    }
    
    // Receive function for direct ETH sends
    receive() external payable {
        if (msg.value > 0) {
            (bool success,) = feeRecipient.call{value: msg.value}("");
            require(success, "Direct fee transfer failed");
            emit FeesCollected(msg.value, msg.sender);
        }
    }
}