// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts@4.9.3/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts@4.9.3/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts@4.9.3/access/Ownable.sol";
import "@openzeppelin/contracts@4.9.3/security/ReentrancyGuard.sol";

/**
 * @title WEMARK
 * @dev Non-transferrable ERC20 wrapper for EMARK tokens with unbonding period
 * Users stake EMARK to receive wEMARK (non-transferrable voting power)
 */
contract WEMARK is ERC20, Ownable, ReentrancyGuard {
    
    IERC20 public immutable emarkToken;
    uint256 public constant UNBONDING_PERIOD = 7 days;
    
    // Staking data
    mapping(address => uint256) public stakeTimestamp;
    
    // Unbonding data  
    mapping(address => uint256) public unbondingAmount;
    mapping(address => uint256) public unbondingTimestamp;
    
    // Events
    event Staked(address indexed user, uint256 amount, uint256 timestamp);
    event UnbondingStarted(address indexed user, uint256 amount, uint256 readyTime);
    event Withdrawn(address indexed user, uint256 amount);
    
    constructor(address _emarkToken) ERC20("Wrapped EMARK", "wEMARK") {
        require(_emarkToken != address(0), "Invalid token address");
        emarkToken = IERC20(_emarkToken);
    }
    
    // Override transfer functions to make wEMARK non-transferrable
    function transfer(address, uint256) public pure override returns (bool) {
        revert("wEMARK is non-transferrable");
    }
    
    function transferFrom(address, address, uint256) public pure override returns (bool) {
        revert("wEMARK is non-transferrable");
    }
    
    function approve(address, uint256) public pure override returns (bool) {
        revert("wEMARK is non-transferrable");
    }
    
    /**
     * @dev Stake EMARK tokens to receive wEMARK voting power
     */
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        emarkToken.transferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, amount);
        stakeTimestamp[msg.sender] = block.timestamp;
        
        emit Staked(msg.sender, amount, block.timestamp);
    }
    
    /**
     * @dev Start unbonding process - removes voting power immediately
     */
    function startUnbonding(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient wEMARK balance");
        require(unbondingAmount[msg.sender] == 0, "Already unbonding");
        
        // Remove voting power immediately by burning wEMARK
        _burn(msg.sender, amount);
        
        // Start unbonding period
        unbondingAmount[msg.sender] = amount;
        unbondingTimestamp[msg.sender] = block.timestamp;
        
        emit UnbondingStarted(msg.sender, amount, block.timestamp + UNBONDING_PERIOD);
    }
    
    /**
     * @dev Withdraw unbonded tokens after cooldown period
     */
    function withdraw() external nonReentrant {
        require(unbondingAmount[msg.sender] > 0, "No unbonding amount");
        require(
            block.timestamp >= unbondingTimestamp[msg.sender] + UNBONDING_PERIOD,
            "Unbonding period not complete"
        );
        
        uint256 amount = unbondingAmount[msg.sender];
        unbondingAmount[msg.sender] = 0;
        unbondingTimestamp[msg.sender] = 0;
        
        emarkToken.transfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount);
    }
    
    /**
     * @dev Cancel unbonding and restore voting power
     */
    function cancelUnbonding() external nonReentrant {
        require(unbondingAmount[msg.sender] > 0, "No unbonding amount");
        
        uint256 amount = unbondingAmount[msg.sender];
        unbondingAmount[msg.sender] = 0;
        unbondingTimestamp[msg.sender] = 0;
        
        // Restore voting power by minting wEMARK back
        _mint(msg.sender, amount);
        stakeTimestamp[msg.sender] = block.timestamp;
        
        emit Staked(msg.sender, amount, block.timestamp);
    }
    
    /**
     * @dev Get user's voting power (wEMARK balance)
     */
    function getVotingPower(address user) external view returns (uint256) {
        return balanceOf(user);
    }
    
    /**
     * @dev Check if user can withdraw unbonded tokens
     */
    function canWithdraw(address user) external view returns (bool) {
        return unbondingAmount[user] > 0 && 
               block.timestamp >= unbondingTimestamp[user] + UNBONDING_PERIOD;
    }
    
    /**
     * @dev Get time remaining until user can withdraw (in seconds)
     */
    function getWithdrawTimeRemaining(address user) external view returns (uint256) {
        if (unbondingAmount[user] == 0) return 0;
        
        uint256 withdrawTime = unbondingTimestamp[user] + UNBONDING_PERIOD;
        if (block.timestamp >= withdrawTime) return 0;
        
        return withdrawTime - block.timestamp;
    }
    
    /**
     * @dev Get user's complete staking info
     */
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
    
    /**
     * @dev Get total EMARK locked in contract
     */
    function getTotalStaked() external view returns (uint256) {
        return emarkToken.balanceOf(address(this));
    }
    
    /**
     * @dev Emergency withdrawal (owner only)
     */
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(to).transfer(amount);
        } else {
            IERC20(token).transfer(to, amount);
        }
    }
}