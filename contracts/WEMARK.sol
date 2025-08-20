// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract WEMARK is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    IERC20 public immutable emarkToken;
    uint256 public constant UNBONDING_PERIOD = 7 days;
    
    mapping(address => uint256) public stakeTimestamp;
    
    mapping(address => uint256) public unbondingAmount;
    mapping(address => uint256) public unbondingTimestamp;
    
    event Staked(address indexed user, uint256 amount, uint256 timestamp);
    event UnbondingStarted(address indexed user, uint256 amount, uint256 readyTime);
    event Withdrawn(address indexed user, uint256 amount);
    
    constructor(address _emarkToken) ERC20("Wrapped EMARK", "wEMARK") {
        require(_emarkToken != address(0), "Invalid token address");
        emarkToken = IERC20(_emarkToken);
    }
    
    function transfer(address, uint256) public pure override returns (bool) {
        revert("wEMARK is non-transferrable");
    }
    
    function transferFrom(address, address, uint256) public pure override returns (bool) {
        revert("wEMARK is non-transferrable");
    }
    
    function approve(address, uint256) public pure override returns (bool) {
        revert("wEMARK is non-transferrable");
    }
    
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        emarkToken.safeTransferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, amount);
        stakeTimestamp[msg.sender] = block.timestamp;
        
        emit Staked(msg.sender, amount, block.timestamp);
    }
    
    function startUnbonding(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient wEMARK balance");
        require(unbondingAmount[msg.sender] == 0, "Already unbonding");
        
        
        _burn(msg.sender, amount);
        
        
        unbondingAmount[msg.sender] = amount;
        unbondingTimestamp[msg.sender] = block.timestamp;
        
        emit UnbondingStarted(msg.sender, amount, block.timestamp + UNBONDING_PERIOD);
    }
    
    function withdraw() external nonReentrant {
        require(unbondingAmount[msg.sender] > 0, "No unbonding amount");
        require(
            block.timestamp >= unbondingTimestamp[msg.sender] + UNBONDING_PERIOD,
            "Unbonding period not complete"
        );
        
        uint256 amount = unbondingAmount[msg.sender];
        unbondingAmount[msg.sender] = 0;
        unbondingTimestamp[msg.sender] = 0;
        
        emarkToken.safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount);
    }
    
    function cancelUnbonding() external nonReentrant {
        require(unbondingAmount[msg.sender] > 0, "No unbonding amount");
        
        uint256 amount = unbondingAmount[msg.sender];
        unbondingAmount[msg.sender] = 0;
        unbondingTimestamp[msg.sender] = 0;
        
        
        _mint(msg.sender, amount);
        stakeTimestamp[msg.sender] = block.timestamp;
        
        emit Staked(msg.sender, amount, block.timestamp);
    }
    
    function getVotingPower(address user) external view returns (uint256) {
        return balanceOf(user);
    }
    
    function canWithdraw(address user) external view returns (bool) {
        return unbondingAmount[user] > 0 && 
               block.timestamp >= unbondingTimestamp[user] + UNBONDING_PERIOD;
    }
    
    function getWithdrawTimeRemaining(address user) external view returns (uint256) {
        if (unbondingAmount[user] == 0) return 0;
        
        uint256 withdrawTime = unbondingTimestamp[user] + UNBONDING_PERIOD;
        if (block.timestamp >= withdrawTime) return 0;
        
        return withdrawTime - block.timestamp;
    }
    
    function getUserInfo(address user) external view returns (
        uint256 stakedBalance,
        uint256 unbonding,
        uint256 withdrawTime,
        bool canWithdrawNow
    ) {
        stakedBalance = balanceOf(user);
        unbonding = unbondingAmount[user];
        withdrawTime = unbondingTimestamp[user] + UNBONDING_PERIOD;
        canWithdrawNow = unbonding > 0 && block.timestamp >= withdrawTime;
    }
    
    function getTotalStaked() external view returns (uint256) {
        return emarkToken.balanceOf(address(this));
    }
    
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(to).transfer(amount);
        } else {
            IERC20(token).transfer(to, amount);
        }
    }
}