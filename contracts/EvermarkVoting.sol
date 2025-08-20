// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
interface IWEMARK {
    function getVotingPower(address user) external view returns (uint256);
}
interface IEvermarkNFT {
    function exists(uint256 tokenId) external view returns (bool);
}
contract EvermarkVoting is Ownable, ReentrancyGuard {
    IWEMARK public wemark;
    IEvermarkNFT public evermarkNFT;
    uint256 public currentSeason;
    uint256 public constant SEASON_DURATION = 7 days;
    struct Season {
        uint256 startTime;
        uint256 endTime;
        bool active;
        uint256 totalVotes;
    }
    mapping(uint256 => Season) public seasons;
    mapping(uint256 => mapping(uint256 => uint256)) public evermarkVotes; 
    mapping(uint256 => mapping(address => uint256)) public userVotesInSeason; 
    event SeasonStarted(uint256 indexed season, uint256 startTime, uint256 endTime);
    event SeasonEnded(uint256 indexed season, uint256 endTime);
    event VoteCast(address indexed voter, uint256 indexed season, uint256 indexed evermarkId, uint256 votes);
    constructor(address _wemark, address _evermarkNFT) {
        require(_wemark != address(0), "Invalid WEMARK address");
        require(_evermarkNFT != address(0), "Invalid EvermarkNFT address");
        wemark = IWEMARK(_wemark);
        evermarkNFT = IEvermarkNFT(_evermarkNFT);
        currentSeason = 0;
    }
    /**
     * @dev Start a new voting season
     */
    function startNewSeason() external onlyOwner {
        if (currentSeason > 0 && seasons[currentSeason].active) {
            seasons[currentSeason].active = false;
            seasons[currentSeason].endTime = block.timestamp;
            emit SeasonEnded(currentSeason, block.timestamp);
        }
        currentSeason++;
        seasons[currentSeason] = Season({
            startTime: block.timestamp,
            endTime: block.timestamp + SEASON_DURATION,
            active: true,
            totalVotes: 0
        });
        emit SeasonStarted(currentSeason, block.timestamp, block.timestamp + SEASON_DURATION);
    }
    /**
     * @dev End current voting season manually
     */
    function endCurrentSeason() external onlyOwner {
        require(currentSeason > 0, "No season to end");
        require(seasons[currentSeason].active, "Season already ended");
        seasons[currentSeason].active = false;
        seasons[currentSeason].endTime = block.timestamp;
        emit SeasonEnded(currentSeason, block.timestamp);
    }
    /**
     * @dev Vote for an evermark in the current season
     */
    function voteForEvermark(uint256 evermarkId, uint256 votes) external nonReentrant {
        require(currentSeason > 0, "No active season");
        require(seasons[currentSeason].active, "Season not active");
        require(block.timestamp <= seasons[currentSeason].endTime, "Season ended");
        require(evermarkNFT.exists(evermarkId), "Evermark does not exist");
        require(votes > 0, "Must vote at least 1");
        uint256 votingPower = wemark.getVotingPower(msg.sender);
        uint256 usedVotes = userVotesInSeason[currentSeason][msg.sender];
        require(usedVotes + votes <= votingPower, "Insufficient voting power");
        evermarkVotes[currentSeason][evermarkId] += votes;
        userVotesInSeason[currentSeason][msg.sender] += votes;
        seasons[currentSeason].totalVotes += votes;
        emit VoteCast(msg.sender, currentSeason, evermarkId, votes);
    }
    /**
     * @dev Get current season number
     */
    function getCurrentSeason() external view returns (uint256) {
        return currentSeason;
    }
    /**
     * @dev Get season information
     */
    function getSeasonInfo(uint256 season) external view returns (
        uint256 startTime,
        uint256 endTime,
        bool active,
        uint256 totalVotes
    ) {
        Season memory info = seasons[season];
        return (info.startTime, info.endTime, info.active, info.totalVotes);
    }
    /**
     * @dev Get votes for an evermark in a specific season
     */
    function getEvermarkVotesInSeason(uint256 season, uint256 evermarkId) external view returns (uint256) {
        return evermarkVotes[season][evermarkId];
    }
    /**
     * @dev Get user's votes used in a season
     */
    function getUserVotesInSeason(uint256 season, address user) external view returns (uint256) {
        return userVotesInSeason[season][user];
    }
    /**
     * @dev Get user's remaining voting power in current season
     */
    function getRemainingVotingPower(address user) external view returns (uint256) {
        if (currentSeason == 0) return 0;
        uint256 totalPower = wemark.getVotingPower(user);
        uint256 usedPower = userVotesInSeason[currentSeason][user];
        return totalPower > usedPower ? totalPower - usedPower : 0;
    }
    /**
     * @dev Check if season is currently active
     */
    function isSeasonActive(uint256 season) external view returns (bool) {
        return seasons[season].active && block.timestamp <= seasons[season].endTime;
    }
    /**
     * @dev Update contract addresses (owner only)
     */
    function updateContracts(address _wemark, address _evermarkNFT) external onlyOwner {
        require(_wemark != address(0), "Invalid WEMARK address");
        require(_evermarkNFT != address(0), "Invalid EvermarkNFT address");
        wemark = IWEMARK(_wemark);
        evermarkNFT = IEvermarkNFT(_evermarkNFT);
    }
    /**
     * @dev Emergency withdrawal (owner only)
     */
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(to).transfer(amount);
        } else {
            (bool success, ) = token.call(
                abi.encodeWithSignature("transfer(address,uint256)", to, amount)
            );
            require(success, "Transfer failed");
        }
    }
}