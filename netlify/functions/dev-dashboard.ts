// netlify/functions/dev-dashboard.ts - Development utilities
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Beta table name - using beta_evermarks instead of alpha evermarks table
const EVERMARKS_TABLE = 'beta_evermarks';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Real protocol balance and data fetching - copied from AdminPage.tsx pattern
async function getProtocolBalances() {
  try {
    const { createThirdwebClient } = await import('thirdweb');
    const { base } = await import('thirdweb/chains');
    const { getContract, readContract } = await import('thirdweb');
    
    const client = createThirdwebClient({
      clientId: process.env.VITE_THIRDWEB_CLIENT_ID!
    });

    // Contract instances - same as AdminPage.tsx
    const feeCollectorContract = getContract({
      client,
      chain: base,
      address: process.env.VITE_FEE_COLLECTOR_ADDRESS as `0x${string}`
    });
    
    const rewardsContract = getContract({
      client,
      chain: base,
      address: process.env.VITE_EVERMARK_REWARDS_ADDRESS as `0x${string}`
    });
    
    const wemarkContract = getContract({
      client,
      chain: base,
      address: process.env.VITE_WEMARK_ADDRESS as `0x${string}`
    });
    
    const votingContract = getContract({
      client,
      chain: base,
      address: process.env.VITE_EVERMARK_VOTING_ADDRESS as `0x${string}`
    });
    
    const nftContract = getContract({
      client,
      chain: base,
      address: process.env.VITE_EVERMARK_NFT_ADDRESS as `0x${string}`
    });
    
    const emarkTokenContract = getContract({
      client,
      chain: base,
      address: process.env.VITE_EMARK_ADDRESS as `0x${string}`
    });

    // Read fee collector balances - exact same call as AdminPage.tsx
    const feeCollectorBalances = await readContract({
      contract: feeCollectorContract,
      method: "function getTokenBalances() view returns (uint256 wethBalance, uint256 emarkBalance)",
      params: []
    });

    // Read rewards contract balances - exact same call as AdminPage.tsx  
    const rewardsBalances = await readContract({
      contract: rewardsContract,
      method: "function getBalances() view returns (uint256 wethBalance, uint256 emarkBalance)",
      params: []
    });

    // Read staking data for APR calculation - exact same call as AdminPage.tsx
    const wemarkTotalStaked = await readContract({
      contract: wemarkContract,
      method: "function getTotalStaked() view returns (uint256)",
      params: []
    });

    // Read current season info - exact same call as AdminPage.tsx
    const currentSeason = await readContract({
      contract: votingContract,
      method: "function getCurrentSeason() view returns (uint256)",
      params: []
    });

    // CHECK ACTUAL $EMARK BALANCES FOR EACH CONTRACT
    const contractAddresses = {
      VOTING: process.env.VITE_EVERMARK_VOTING_ADDRESS,
      NFT: process.env.VITE_EVERMARK_NFT_ADDRESS,
      STAKING: process.env.VITE_WEMARK_ADDRESS,
      REWARDS: process.env.VITE_EVERMARK_REWARDS_ADDRESS,
      FEE_COLLECTOR: process.env.VITE_FEE_COLLECTOR_ADDRESS,
      MARKETPLACE: process.env.VITE_MARKETPLACE_ADDRESS
    };

    const contractEmarkBalances = {};
    for (const [name, address] of Object.entries(contractAddresses)) {
      if (address) {
        try {
          const balance = await readContract({
            contract: emarkTokenContract,
            method: "function balanceOf(address owner) view returns (uint256)",
            params: [address as `0x${string}`]
          });
          contractEmarkBalances[name] = (Number(balance) / 1e18).toFixed(2);
        } catch (error) {
          console.error(`Failed to get EMARK balance for ${name}:`, error);
          contractEmarkBalances[name] = '0.00';
        }
      } else {
        contractEmarkBalances[name] = '0.00';
      }
    }

    const [feeWeth, feeEmark] = feeCollectorBalances as [bigint, bigint];
    const [rewardsWeth, rewardsEmark] = rewardsBalances as [bigint, bigint];

    // Calculate total EMARK across all contracts
    const totalEmarkInContracts = Object.values(contractEmarkBalances).reduce((sum, balance) => {
      return sum + parseFloat(balance as string);
    }, 0);

    return {
      feeCollector: {
        weth: (Number(feeWeth) / 1e18).toFixed(4),
        emark: (Number(feeEmark) / 1e18).toFixed(2)
      },
      rewards: {
        weth: (Number(rewardsWeth) / 1e18).toFixed(4),
        emark: (Number(rewardsEmark) / 1e18).toFixed(2)
      },
      staking: {
        totalStaked: (Number(wemarkTotalStaked) / 1e18).toFixed(2)
      },
      voting: {
        currentSeason: Number(currentSeason)
      },
      // ACTUAL $EMARK BALANCES BY CONTRACT
      contracts: {
        voting: contractEmarkBalances.VOTING,
        nft: contractEmarkBalances.NFT,
        staking: contractEmarkBalances.STAKING,
        rewards: contractEmarkBalances.REWARDS,
        feeCollector: contractEmarkBalances.FEE_COLLECTOR,
        marketplace: contractEmarkBalances.MARKETPLACE
      },
      total: {
        emark: totalEmarkInContracts.toFixed(2),
        eth: ((Number(feeWeth) + Number(rewardsWeth)) / 1e18).toFixed(4)
      }
    };
  } catch (error) {
    console.error('Failed to get protocol balances:', error);
    throw error; // Don't hide errors in dev dashboard
  }
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Only allow in development/staging
  if (process.env.NODE_ENV === 'production') {
    return {
      statusCode: 403,
      body: 'Not available in production',
    };
  }

  try {
    // Get evermarks statistics
    const { data: evermarksCount } = await supabase
      .from(EVERMARKS_TABLE)
      .select('*', { count: 'exact', head: true });

    const { data: verifiedCount } = await supabase
      .from(EVERMARKS_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('verified', true);

    const { data: needsMetadata } = await supabase
      .from(EVERMARKS_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('metadata_fetched', false);

    const { data: recentEvermarks } = await supabase
      .from(EVERMARKS_TABLE)
      .select('token_id, title, author, created_at, verified')
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: recentWebhooks } = await supabase
      .from('webhook_events')
      .select('*')
      .order('processed_at', { ascending: false })
      .limit(10);

    const { data: syncLogs } = await supabase
      .from('sync_logs')
      .select('*')
      .order('completed_at', { ascending: false })
      .limit(5);

    // Get beta points stats
    const { data: pointsStats } = await supabase
      .from('beta_points')
      .select('*', { count: 'exact', head: true });

    const { data: topPointsUsers } = await supabase
      .from('beta_points')
      .select('wallet_address, total_points')
      .order('total_points', { ascending: false })
      .limit(10);

    const { data: recentPointTransactions } = await supabase
      .from('beta_point_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch season and voting data
    const { data: finalizedSeasons } = await supabase
      .from('finalized_seasons')
      .select('*')
      .order('season_number', { ascending: false });

    const { data: currentLeaderboard } = await supabase
      .from('leaderboard_data')
      .select('*')
      .order('votes', { ascending: false })
      .limit(10);

    const { data: voteRecords } = await supabase
      .from('vote_records')
      .select('*', { count: 'exact', head: true });

    // Get real protocol data - replacing admin page functionality
    const protocolBalances = await getProtocolBalances();

    const dashboardHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Evermark Dev Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: 'SF Mono', 'Monaco', 'Menlo', monospace; 
      margin: 0; padding: 1.5rem;
      background: #0a0a0a; 
      color: #00ff41; 
      line-height: 1.5;
    }
    .header {
      text-align: center; margin-bottom: 2rem; padding: 1.5rem;
      border: 2px solid #00ff41; background: linear-gradient(45deg, #001a00, #003300);
      border-radius: 12px;
    }
    .dashboard-grid {
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 1.5rem; 
      max-width: 1400px; 
      margin: 0 auto;
    }
    .card { 
      border: 2px solid #00ff41; 
      background: #001100;
      border-radius: 12px;
      padding: 1.5rem;
      position: relative;
    }
    .card h3 {
      margin: 0 0 1rem 0;
      color: #00ff41;
      font-size: 1.2em;
      border-bottom: 1px solid #00ff41;
      padding-bottom: 0.5rem;
    }
    .status-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .stat-item {
      background: #000500;
      padding: 0.75rem;
      border-radius: 6px;
      border: 1px solid #003300;
    }
    .stat-label { 
      font-size: 0.8em; 
      color: #00cc33; 
      margin-bottom: 0.25rem; 
    }
    .stat-value { 
      font-size: 1.1em; 
      font-weight: bold; 
      color: #00ff41; 
    }
    .stat-value.warning { color: #ffaa00; }
    .stat-value.error { color: #ff4444; }
    .stat-value.success { color: #00ff88; }
    .buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .btn {
      background: #00ff41; color: #000; 
      border: none; padding: 0.5rem 1rem;
      border-radius: 6px; font-weight: bold;
      cursor: pointer; font-family: inherit;
      transition: all 0.2s;
    }
    .btn:hover { background: #00cc33; transform: translateY(-1px); }
    .btn:active { transform: translateY(0); }
    .btn:disabled { background: #333; color: #666; cursor: not-allowed; }
    .btn.loading { background: #ffaa00; }
    .btn.success { background: #00ff88; }
    .btn.error { background: #ff4444; color: white; }
    .btn.secondary { background: #333; color: #00ff41; }
    .result {
      margin-top: 1rem;
      padding: 0.75rem;
      border-radius: 6px;
      font-size: 0.9em;
      display: none;
    }
    .result.success { background: #001a00; border: 1px solid #00ff41; }
    .result.error { background: #1a0000; border: 1px solid #ff4444; color: #ff8888; }
    .result.info { background: #001a1a; border: 1px solid #00aaaa; color: #00cccc; }
    pre { background: #000; padding: 0.5rem; border-radius: 4px; overflow-x: auto; font-size: 0.8em; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚀 EVERMARK DEV DASHBOARD</h1>
    <p>System Control Center • Environment: ${process.env.NODE_ENV || 'development'}</p>
    <p><strong>Total Evermarks:</strong> ${evermarksCount?.count || 0} • <strong>Verified:</strong> ${verifiedCount?.count || 0} • <strong>Beta Points Users:</strong> ${pointsStats?.count || 0}</p>
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-top: 1rem; font-size: 0.9em;">
      <div style="text-align: center; padding: 0.5rem; background: rgba(0,255,65,0.1); border-radius: 6px;">
        <div style="color: #00ff41; font-weight: bold;">${protocolBalances.total.emark} $EMARK</div>
        <div style="color: #00cc33; font-size: 0.8em;">Protocol Treasury</div>
      </div>
      <div style="text-align: center; padding: 0.5rem; background: rgba(0,255,65,0.1); border-radius: 6px;">
        <div style="color: #00ff41; font-weight: bold;">${protocolBalances.total.eth} ETH</div>
        <div style="color: #00cc33; font-size: 0.8em;">Total ETH Holdings</div>
      </div>
      <div style="text-align: center; padding: 0.5rem; background: rgba(0,255,65,0.1); border-radius: 6px;">
        <div style="color: #00ff41; font-weight: bold;">Season ${protocolBalances.voting.currentSeason}</div>
        <div style="color: #00cc33; font-size: 0.8em;">Current Voting Season</div>
      </div>
    </div>
  </div>

  <div class="dashboard-grid">
    <!-- Season Management Card -->
    <div class="card">
      <h3>🏆 Season Management</h3>
      <div class="status-grid">
        <div class="stat-item">
          <div class="stat-label">Current Season</div>
          <div class="stat-value" id="current-season">Loading...</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Finalized Seasons</div>
          <div class="stat-value ${finalizedSeasons?.length ? 'success' : 'warning'}">${finalizedSeasons?.length || 0}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Current Leaderboard</div>
          <div class="stat-value">${currentLeaderboard?.length || 0} entries</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Total Votes Cast</div>
          <div class="stat-value" id="total-votes">${voteRecords?.count || 0}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Season End Time</div>
          <div class="stat-value" id="season-end">Checking...</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Time Remaining</div>
          <div class="stat-value" id="time-remaining">Calculating...</div>
        </div>
      </div>
      <div class="buttons">
        <button class="btn" onclick="checkSeasonStatus()">📊 Check Status</button>
        <button class="btn" onclick="autoDetectSeasons()">🔍 Auto-Detect</button>
        <button class="btn secondary" onclick="finalizeSeason(1)">Finalize S1</button>
        <button class="btn secondary" onclick="finalizeSeason(2)">Finalize S2</button>
        <button class="btn secondary" onclick="finalizeSeason(3)">Finalize S3</button>
        <button class="btn secondary" onclick="viewFinalizedSeasons()">📜 View History</button>
      </div>
      <div class="result" id="season-result"></div>
    </div>

    <!-- Data Sync Card -->
    <div class="card">
      <h3>🔄 Data Synchronization</h3>
      <div class="status-grid">
        <div class="stat-item">
          <div class="stat-label">Last Full Sync</div>
          <div class="stat-value">${syncLogs?.[0]?.completed_at ? new Date(syncLogs[0].completed_at).toLocaleString() : 'Never'}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Sync Status</div>
          <div class="stat-value ${syncLogs?.[0]?.status === 'completed' ? 'success' : 'warning'}">${syncLogs?.[0]?.status || 'Unknown'}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Items Synced</div>
          <div class="stat-value">${syncLogs?.[0]?.synced_count || 0}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Sync Errors</div>
          <div class="stat-value ${syncLogs?.[0]?.error_count ? 'error' : 'success'}">${syncLogs?.[0]?.error_count || 0}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Metadata Missing</div>
          <div class="stat-value ${needsMetadata?.count ? 'warning' : 'success'}">${needsMetadata?.count || 0}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Blockchain Health</div>
          <div class="stat-value" id="blockchain-health">Checking...</div>
        </div>
      </div>
      <div class="buttons">
        <button class="btn" onclick="syncOwners()">👥 Sync Owners</button>
        <button class="btn" onclick="syncVotes()">🗳️ Sync Votes</button>
        <button class="btn" onclick="updateStats()">📊 Update Stats</button>
        <button class="btn secondary" onclick="repairMetadata()">🔧 Repair Metadata</button>
        <button class="btn secondary" onclick="fullSync()">⚡ Full Sync</button>
      </div>
      <div class="result" id="sync-result"></div>
    </div>

    <!-- Leaderboard Card -->
    <div class="card">
      <h3>📊 Leaderboard Management</h3>
      <div class="status-grid">
        <div class="stat-item">
          <div class="stat-label">Current Leaders</div>
          <div class="stat-value">${currentLeaderboard?.length || 0}/50 slots</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Top Votes</div>
          <div class="stat-value">${currentLeaderboard?.[0]?.votes || 0}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Last Updated</div>
          <div class="stat-value" id="leaderboard-updated">Checking...</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Points Users</div>
          <div class="stat-value">${pointsStats?.count || 0}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Top Points</div>
          <div class="stat-value">${topPointsUsers?.[0]?.total_points || 0}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Recent Transactions</div>
          <div class="stat-value">${recentPointTransactions?.length || 0} today</div>
        </div>
      </div>
      <div class="buttons">
        <button class="btn" onclick="refreshLeaderboard()">🔄 Refresh Current</button>
        <button class="btn" onclick="recalculatePoints()">🧮 Recalculate Points</button>
        <button class="btn secondary" onclick="viewCurrentLeaderboard()">📋 View Current</button>
        <button class="btn secondary" onclick="viewPointsLeaderboard()">⭐ View Points</button>
      </div>
      <div class="result" id="leaderboard-result"></div>
    </div>

    <!-- Rewards Management Card -->
    <div class="card">
      <h3>💰 Rewards Management</h3>
      <div class="status-grid">
        <div class="stat-item">
          <div class="stat-label">Pending Rewards</div>
          <div class="stat-value" id="pending-rewards">Checking...</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Last Distribution</div>
          <div class="stat-value" id="last-distribution">Checking...</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Contract Balance</div>
          <div class="stat-value" id="rewards-balance">Loading...</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Total Distributed</div>
          <div class="stat-value" id="total-distributed">Loading...</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Eligible Users</div>
          <div class="stat-value" id="eligible-users">Calculating...</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Distribution Status</div>
          <div class="stat-value" id="distribution-status">Ready</div>
        </div>
      </div>
      <div class="buttons">
        <button class="btn secondary" onclick="computeRewards(1)">💎 Compute S1</button>
        <button class="btn secondary" onclick="computeRewards(2)">💎 Compute S2</button>
        <button class="btn secondary" onclick="computeRewards(3)">💎 Compute S3</button>
        <button class="btn" onclick="executeDistribution()">🚀 Execute Distribution</button>
        <button class="btn secondary" onclick="checkBalances()">💰 Check Balances</button>
      </div>
      <div class="result" id="rewards-result"></div>
    </div>

    <!-- Maintenance & Health Card -->
    <div class="card">
      <h3>🛠️ System Maintenance</h3>
      <div class="status-grid">
        <div class="stat-item">
          <div class="stat-label">Cast Images</div>
          <div class="stat-value" id="cast-images">Checking...</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Broken Images</div>
          <div class="stat-value" id="broken-images">Scanning...</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Contract Status</div>
          <div class="stat-value" id="contract-status">Checking...</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">API Health</div>
          <div class="stat-value success">Operational</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Database Size</div>
          <div class="stat-value" id="db-size">Calculating...</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Recent Errors</div>
          <div class="stat-value" id="recent-errors">0 in 24h</div>
        </div>
      </div>
      <div class="buttons">
        <button class="btn" onclick="generateCastImages()">🎨 Generate Cast Images</button>
        <button class="btn" onclick="fixImageUrls()">🔗 Fix Image URLs</button>
        <button class="btn secondary" onclick="debugVoting()">🔍 Debug Voting</button>
        <button class="btn secondary" onclick="contractHealth()">⛓️ Contract Health</button>
        <button class="btn secondary" onclick="clearCaches()">🗑️ Clear Caches</button>
      </div>
      <div class="result" id="maintenance-result"></div>
    </div>

    <!-- Protocol Balances Card -->
    <div class="card">
      <h3>💰 Protocol Balances & APR</h3>
      <div class="status-grid">
        <div class="stat-item">
          <div class="stat-label">Voting Contract</div>
          <div class="stat-value success">${protocolBalances.contracts.voting} $EMARK</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">NFT Contract</div>
          <div class="stat-value success">${protocolBalances.contracts.nft} $EMARK</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Staking Contract</div>
          <div class="stat-value success">${protocolBalances.contracts.staking} $EMARK</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Rewards Contract</div>
          <div class="stat-value success">${protocolBalances.contracts.rewards} $EMARK</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Fee Collector</div>
          <div class="stat-value success">${protocolBalances.contracts.feeCollector} $EMARK</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Marketplace Contract</div>
          <div class="stat-value success">${protocolBalances.contracts.marketplace} $EMARK</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Fee Collector WETH</div>
          <div class="stat-value success">${protocolBalances.feeCollector.weth}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Rewards Pool WETH</div>
          <div class="stat-value success">${protocolBalances.rewards.weth}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Total Staked (WEMARK)</div>
          <div class="stat-value success">${protocolBalances.staking.totalStaked}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Current Season</div>
          <div class="stat-value success">${protocolBalances.voting.currentSeason}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">TOTAL $EMARK</div>
          <div class="stat-value success">${protocolBalances.total.emark}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">TOTAL WETH</div>
          <div class="stat-value success">${protocolBalances.total.eth}</div>
        </div>
      </div>
      <div class="buttons">
        <button class="btn" onclick="refreshBalances()">💰 Refresh Balances</button>
        <button class="btn" onclick="forwardWethToRewards()">💧 Forward WETH (${protocolBalances.feeCollector.weth})</button>
        <button class="btn" onclick="forwardEmarkToRewards()">⚡ Forward EMARK (${protocolBalances.feeCollector.emark})</button>
        <button class="btn secondary" onclick="exportBalanceReport()">📄 Export Report</button>
      </div>
      <div class="result" id="balances-result"></div>
    </div>
  </div>

  <script>
    // Management button functions
    
    // Season Management
    async function checkSeasonStatus() {
      showResult('season-result', 'Checking season status...', 'info');
      try {
        const response = await fetch('/.netlify/functions/admin-season-finalize?action=validate-season');
        const data = await response.json();
        if (response.ok) {
          showResult('season-result', 'Season ' + data.seasonNumber + ': ' + (data.canProceed ? 'Ready to finalize' : 'Not ready - ' + data.discrepancies.join(', ')), data.canProceed ? 'success' : 'error');
        } else {
          showResult('season-result', 'Error: ' + data.error, 'error');
        }
      } catch (error) {
        showResult('season-result', 'Failed to check season status: ' + error.message, 'error');
      }
    }
    
    async function autoDetectSeasons() {
      showResult('season-result', 'Auto-detecting finalized seasons...', 'info');
      try {
        const response = await fetch('/.netlify/functions/season-finalization?action=detect-finalizations');
        const data = await response.json();
        if (response.ok) {
          showResult('season-result', 'Found ' + data.newFinalizations.length + ' newly finalized seasons: ' + (data.newFinalizations.join(', ') || 'none'), 'success');
          if (data.newFinalizations.length > 0) {
            setTimeout(() => window.location.reload(), 2000); // Refresh to show updated data
          }
        } else {
          showResult('season-result', 'Error: ' + data.error, 'error');
        }
      } catch (error) {
        showResult('season-result', 'Failed to auto-detect seasons: ' + error.message, 'error');
      }
    }
    
    async function finalizeSeason(season) {
      showResult('season-result', 'Finalizing season ' + season + '...', 'info');
      try {
        const response = await fetch('/.netlify/functions/season-finalization?action=finalize-season&season_number=' + season);
        const data = await response.json();
        if (response.ok) {
          showResult('season-result', 'Season ' + season + ' successfully finalized!', 'success');
          setTimeout(() => window.location.reload(), 2000); // Refresh to show updated data
        } else {
          showResult('season-result', 'Error: ' + data.error, 'error');
        }
      } catch (error) {
        showResult('season-result', 'Failed to finalize season ' + season + ': ' + error.message, 'error');
      }
    }
    
    // Data Sync
    async function syncOwners() {
      showResult('sync-result', 'Syncing NFT owners from blockchain...', 'info');
      try {
        const response = await fetch('/.netlify/functions/evermarks?action=sync-owners', { method: 'POST' });
        const data = await response.json();
        if (response.ok) {
          showResult('sync-result', 'Owners synced! Updated ' + (data.updated || 0) + ' records.', 'success');
        } else {
          showResult('sync-result', 'Error: ' + data.error, 'error');
        }
      } catch (error) {
        showResult('sync-result', 'Failed to sync owners: ' + error.message, 'error');
      }
    }
    
    async function syncVotes() {
      showResult('sync-result', 'Syncing voting data from blockchain...', 'info');
      try {
        // Use the webhook endpoint to trigger blockchain sync
        const response = await fetch('/.netlify/functions/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            type: 'manual_sync',
            action: 'sync_votes',
            timestamp: Date.now()
          })
        });
        const data = await response.json();
        if (response.ok) {
          showResult('sync-result', 'Votes synced! Processed ' + (data.processed || 0) + ' records.', 'success');
        } else {
          showResult('sync-result', 'Error: ' + data.error, 'error');
        }
      } catch (error) {
        showResult('sync-result', 'Failed to sync votes: ' + error.message, 'error');
      }
    }
    
    async function updateStats() {
      showResult('sync-result', 'Updating protocol statistics...', 'info');
      try {
        const response = await fetch('/.netlify/functions/evermarks?action=update-stats', { method: 'POST' });
        const data = await response.json();
        if (response.ok) {
          showResult('sync-result', 'Statistics updated! Refreshing page...', 'success');
          setTimeout(() => window.location.reload(), 1500);
        } else {
          showResult('sync-result', 'Error: ' + data.error, 'error');
        }
      } catch (error) {
        showResult('sync-result', 'Failed to update stats: ' + error.message, 'error');
      }
    }
    
    // Protocol Balances
    async function refreshBalances() {
      showResult('balances-result', 'Fetching latest balances from blockchain...', 'info');
      try {
        // Reload the page to refresh balance data
        window.location.reload();
      } catch (error) {
        showResult('balances-result', 'Failed to refresh balances: ' + error.message, 'error');
      }
    }
    
    async function recalculateAPR() {
      showResult('balances-result', 'Recalculating APR from live contract data...', 'info');
      try {
        // Reload the page to recalculate APR data  
        window.location.reload();
      } catch (error) {
        showResult('balances-result', 'Failed to recalculate APR: ' + error.message, 'error');
      }
    }
    
    // Treasury Management Functions
    async function forwardWethToRewards() {
      showResult('balances-result', 'Forwarding WETH to rewards contract...', 'info');
      try {
        const response = await fetch('/.netlify/functions/admin-actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'forward-weth-to-rewards'
          })
        });
        
        const data = await response.json();
        if (response.ok) {
          showResult('balances-result', 'WETH forwarded successfully! TX: ' + data.txHash, 'success');
          setTimeout(() => window.location.reload(), 3000);
        } else {
          showResult('balances-result', 'Error: ' + data.error, 'error');
        }
      } catch (error) {
        showResult('balances-result', 'Failed to forward WETH: ' + error.message, 'error');
      }
    }
    
    async function forwardEmarkToRewards() {
      showResult('balances-result', 'Forwarding EMARK to rewards contract...', 'info');
      try {
        const response = await fetch('/.netlify/functions/admin-actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'forward-emark-to-rewards'
          })
        });
        
        const data = await response.json();
        if (response.ok) {
          showResult('balances-result', 'EMARK forwarded successfully! TX: ' + data.txHash, 'success');
          setTimeout(() => window.location.reload(), 3000);
        } else {
          showResult('balances-result', 'Error: ' + data.error, 'error');
        }
      } catch (error) {
        showResult('balances-result', 'Failed to forward EMARK: ' + error.message, 'error');
      }
    }

    async function exportBalanceReport() {
      showResult('balances-result', 'Generating balance report...', 'info');
      try {
        // Create CSV data from real contract balances
        const csvData = [
          ['Contract', 'EMARK Balance', 'WETH Balance', 'Notes'],
          ['Voting Contract', '${protocolBalances.contracts.voting}', '0', 'Voting mechanism'],
          ['NFT Contract', '${protocolBalances.contracts.nft}', '0', 'Evermark NFTs'],
          ['Staking Contract', '${protocolBalances.contracts.staking}', '0', 'EMARK staking'],
          ['Rewards Contract', '${protocolBalances.contracts.rewards}', '${protocolBalances.rewards.weth}', 'Reward distribution'],
          ['Fee Collector', '${protocolBalances.contracts.feeCollector}', '${protocolBalances.feeCollector.weth}', 'Trading fees'],
          ['Marketplace', '${protocolBalances.contracts.marketplace}', '0', 'NFT marketplace'],
          ['TOTAL PROTOCOL', '${protocolBalances.total.emark}', '${protocolBalances.total.eth}', 'All contracts combined']
        ].map(row => row.join(',')).join('\\n');
        
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'protocol-balances-' + new Date().toISOString().split('T')[0] + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showResult('balances-result', 'Balance report exported successfully!', 'success');
      } catch (error) {
        showResult('balances-result', 'Failed to export report: ' + error.message, 'error');
      }
    }
    
    // Utility function to show results
    function showResult(elementId, message, type) {
      const element = document.getElementById(elementId);
      if (element) {
        element.textContent = message;
        element.className = 'result ' + type;
        element.style.display = 'block';
      }
    }
    
    // Hide results after 5 seconds
    setInterval(() => {
      document.querySelectorAll('.result').forEach(el => {
        if (el.style.display === 'block') {
          setTimeout(() => el.style.display = 'none', 5000);
        }
      });
    }, 1000);
    
    console.log('🚀 Evermark Management Dashboard loaded');
    console.log('Environment:', '${process.env.NODE_ENV || 'development'}');
  </script>
</body>
</html>`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: dashboardHTML,
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
    };
  }
};
