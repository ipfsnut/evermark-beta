// netlify/functions/dev-dashboard.ts - Development utilities
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Beta table name - using beta_evermarks instead of alpha evermarks table
const EVERMARKS_TABLE = 'beta_evermarks';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

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

    const dashboardHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Evermark Dev Dashboard</title>
  <style>
    body { 
      font-family: 'Monaco', 'Menlo', monospace; 
      margin: 2rem; 
      background: #000; 
      color: #00ff41; 
      line-height: 1.6;
    }
    .header {
      text-align: center;
      margin-bottom: 3rem;
      padding: 2rem;
      border: 2px solid #00ff41;
      background: linear-gradient(45deg, #001100, #002200);
    }
    .section { 
      margin: 2rem 0; 
      padding: 1.5rem; 
      border: 1px solid #00ff41; 
      background: #001100;
      border-radius: 8px;
    }
    .stats { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
      gap: 1rem; 
      margin: 1rem 0;
    }
    .stat { 
      padding: 1rem; 
      background: #002200; 
      border: 1px solid #00ff41;
      border-radius: 4px;
      text-align: center;
    }
    .stat-number {
      font-size: 2rem;
      font-weight: bold;
      color: #00ff41;
    }
    .stat-label {
      font-size: 0.9rem;
      color: #888;
    }
    pre { 
      background: #002200; 
      padding: 1rem; 
      overflow-x: auto; 
      border: 1px solid #00ff41;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    h1, h2 { color: #00ff41; }
    h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    button { 
      background: #00ff41; 
      color: #000; 
      border: none; 
      padding: 0.75rem 1.5rem; 
      cursor: pointer; 
      font-family: inherit;
      font-weight: bold;
      border-radius: 4px;
      transition: all 0.3s ease;
    }
    button:hover {
      background: #00cc33;
      transform: translateY(-2px);
    }
    .status-verified { color: #00ff41; }
    .status-pending { color: #ffaa00; }
    .actions {
      display: flex;
      gap: 1rem;
      margin-top: 1rem;
    }
    .timestamp { color: #666; font-size: 0.8rem; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚀 EVERMARK PROTOCOL</h1>
    <p>Development Dashboard & System Monitor</p>
    <div class="timestamp">Last Updated: ${new Date().toISOString()}</div>
  </div>
  
  <div class="section">
    <h2>📊 Protocol Statistics</h2>
    <div class="stats">
      <div class="stat">
        <div class="stat-number">${(evermarksCount as any)?.count || 0}</div>
        <div class="stat-label">Total Evermarks</div>
      </div>
      <div class="stat">
        <div class="stat-number">${(verifiedCount as any)?.count || 0}</div>
        <div class="stat-label">Verified</div>
      </div>
      <div class="stat">
        <div class="stat-number">${(needsMetadata as any)?.count || 0}</div>
        <div class="stat-label">Needs Metadata</div>
      </div>
      <div class="stat">
        <div class="stat-number">${Math.round(((verifiedCount as any)?.count || 0) / ((evermarksCount as any)?.count || 1) * 100)}%</div>
        <div class="stat-label">Verification Rate</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>📝 Recent Evermarks</h2>
    <pre>${JSON.stringify(recentEvermarks?.map(e => ({
      token_id: e.token_id,
      title: e.title?.substring(0, 30) + (e.title?.length > 30 ? '...' : ''),
      author: e.author,
      verified: e.verified ? '✅' : '⏳',
      created: new Date(e.created_at).toLocaleDateString()
    })), null, 2)}</pre>
  </div>

  <div class="section">
    <h2>🔔 Recent Webhooks</h2>
    <pre>${JSON.stringify(recentWebhooks?.map(w => ({
      type: w.event_type,
      tx: w.transaction_hash?.substring(0, 10) + '...',
      block: w.block_number,
      time: new Date(w.processed_at).toLocaleString()
    })), null, 2)}</pre>
  </div>

  <div class="section">
    <h2>🔄 Sync Status</h2>
    <pre>${JSON.stringify(syncLogs?.map(s => ({
      type: s.sync_type,
      status: s.status,
      synced: s.synced_count,
      errors: s.error_count || 0,
      completed: new Date(s.completed_at).toLocaleString()
    })), null, 2)}</pre>
  </div>

  <div class="section">
    <h2>🛠️ System Actions</h2>
    <div class="actions">
      <button onclick="triggerSync()">🔄 Trigger Manual Sync</button>
      <button onclick="refreshData()">🔄 Refresh Dashboard</button>
    </div>
  </div>

  <script>
    async function triggerSync() {
      try {
        const response = await fetch('/api/sync-blockchain', { method: 'POST' });
        const result = await response.json();
        alert('Sync triggered: ' + JSON.stringify(result, null, 2));
      } catch (error) {
        alert('Sync failed: ' + error.message);
      }
    }
    
    function refreshData() {
      window.location.reload();
    }
    
    console.log('🚀 Evermark Dev Dashboard loaded');
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
