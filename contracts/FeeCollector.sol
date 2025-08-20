// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IEvermarkRewards {
    function fundWethRewards(uint256 amount) external;
    function fundEmarkRewards(uint256 amount) external;
}

contract FeeCollector {
    using SafeERC20 for IERC20;
    address public feeRecipient;
    address public owner;
    address public rewardsContract;
    IERC20 public wethToken;
    IERC20 public emarkToken;
    
    event FeesCollected(uint256 amount, address from);
    event TokenFeesCollected(address indexed token, uint256 amount, address from);
    event TokensForwardedToRewards(address indexed token, uint256 amount);
    event FeeRecipientChanged(address indexed oldRecipient, address indexed newRecipient);
    event RewardsContractChanged(address indexed oldRewards, address indexed newRewards);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    constructor(
        address _feeRecipient,
        address _wethToken,
        address _emarkToken
    ) {
        require(_feeRecipient != address(0), "Invalid recipient");
        require(_wethToken != address(0), "Invalid WETH address");
        require(_emarkToken != address(0), "Invalid EMARK address");
        
        feeRecipient = _feeRecipient;
        wethToken = IERC20(_wethToken);
        emarkToken = IERC20(_emarkToken);
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }
    
    function collectNftCreationFees() external payable {
        require(msg.value > 0, "No fees sent");
        
        
        (bool success,) = feeRecipient.call{value: msg.value}("");
        require(success, "Fee transfer failed");
        
        emit FeesCollected(msg.value, msg.sender);
    }
    
    function getFeeRecipient() external view returns (address) {
        return feeRecipient;
    }
    
    function setFeeRecipient(address _newRecipient) external onlyOwner {
        require(_newRecipient != address(0), "Invalid recipient");
        address oldRecipient = feeRecipient;
        feeRecipient = _newRecipient;
        emit FeeRecipientChanged(oldRecipient, _newRecipient);
    }
    
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid owner");
        address oldOwner = owner;
        owner = _newOwner;
        emit OwnershipTransferred(oldOwner, _newOwner);
    }
    
    function collectTradingFees(address token, uint256 amount) external {
        require(token == address(wethToken) || token == address(emarkToken), "Invalid token");
        require(amount > 0, "Amount must be > 0");
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit TokenFeesCollected(token, amount, msg.sender);
    }
    
    function forwardWethToRewards(uint256 amount) external onlyOwner {
        require(rewardsContract != address(0), "Rewards contract not set");
        require(amount > 0, "Amount must be > 0");
        
        uint256 balance = wethToken.balanceOf(address(this));
        require(balance >= amount, "Insufficient WETH balance");
        
        wethToken.safeTransfer(rewardsContract, amount);
        IEvermarkRewards(rewardsContract).fundWethRewards(amount);
        
        emit TokensForwardedToRewards(address(wethToken), amount);
    }
    
    function forwardEmarkToRewards(uint256 amount) external onlyOwner {
        require(rewardsContract != address(0), "Rewards contract not set");
        require(amount > 0, "Amount must be > 0");
        
        uint256 balance = emarkToken.balanceOf(address(this));
        require(balance >= amount, "Insufficient EMARK balance");
        
        emarkToken.safeTransfer(rewardsContract, amount);
        IEvermarkRewards(rewardsContract).fundEmarkRewards(amount);
        
        emit TokensForwardedToRewards(address(emarkToken), amount);
    }
    
    function forwardAllWethToRewards() external onlyOwner {
        uint256 balance = wethToken.balanceOf(address(this));
        require(balance > 0, "No WETH to forward");
        forwardWethToRewards(balance);
    }
    
    function forwardAllEmarkToRewards() external onlyOwner {
        uint256 balance = emarkToken.balanceOf(address(this));
        require(balance > 0, "No EMARK to forward");
        forwardEmarkToRewards(balance);
    }
    
    function setRewardsContract(address _rewardsContract) external onlyOwner {
        require(_rewardsContract != address(0), "Invalid rewards contract");
        address oldRewards = rewardsContract;
        rewardsContract = _rewardsContract;
        emit RewardsContractChanged(oldRewards, _rewardsContract);
    }
    
    function getTokenBalances() external view returns (uint256 wethBalance, uint256 emarkBalance) {
        wethBalance = wethToken.balanceOf(address(this));
        emarkBalance = emarkToken.balanceOf(address(this));
    }
    
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success,) = feeRecipient.call{value: balance}("");
            require(success, "Emergency withdrawal failed");
        }
    }
    
    function emergencyWithdrawToken(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(token != address(wethToken) && token != address(emarkToken), "Use proper forwarding for rewards tokens");
        IERC20(token).safeTransfer(feeRecipient, amount);
    }
    
    function withdrawSpamToken(address spamToken) external onlyOwner {
        require(spamToken != address(0), "Invalid token");
        require(spamToken != address(wethToken) && spamToken != address(emarkToken), "Cannot withdraw rewards tokens");
        
        uint256 balance = IERC20(spamToken).balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");
        
        IERC20(spamToken).safeTransfer(feeRecipient, balance);
    }
    
    
    receive() external payable {
        if (msg.value > 0) {
            (bool success,) = feeRecipient.call{value: msg.value}("");
            require(success, "Direct fee transfer failed");
            emit FeesCollected(msg.value, msg.sender);
        }
    }
}