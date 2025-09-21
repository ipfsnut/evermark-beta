// netlify/functions/season-oracle.ts
// Season Oracle API endpoint for season state management

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { ContractSeasonOracle } from '../lib/ContractSeasonOracle';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const oracle = new ContractSeasonOracle();
    
    switch (event.httpMethod) {
      case 'GET':
        return await handleGetRequest(oracle, event);
      
      case 'POST':
        return await handlePostRequest(oracle, event);
      
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Season Oracle API error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};

/**
 * Handle GET requests - return season state
 */
async function handleGetRequest(oracle: ContractSeasonOracle, event: HandlerEvent) {
  const queryParams = event.queryStringParameters || {};
  
  try {
    // Check for specific season request
    if (queryParams.season) {
      const seasonNumber = parseInt(queryParams.season);
      if (isNaN(seasonNumber)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid season number' }),
        };
      }
      
      const seasonInfo = await oracle.getSeasonInfoAsync(seasonNumber);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          season: seasonInfo
        }),
      };
    }
    
    // Check for date-specific request
    if (queryParams.date) {
      const date = new Date(queryParams.date);
      if (isNaN(date.getTime())) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid date format' }),
        };
      }
      
      const seasonInfo = await oracle.getSeasonInfoAsync(oracle.calculateSeasonNumber(date));
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          season: seasonInfo,
          requestedDate: date.toISOString()
        }),
      };
    }
    
    // Check for transition status
    if (queryParams.transition) {
      const shouldTransition = oracle.shouldTransition();
      const isTransitionWindow = oracle.isTransitionWindow();
      const nextTransition = oracle.getNextTransitionTime();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          transition: {
            shouldTransition,
            isTransitionWindow,
            nextTransition: nextTransition.toISOString(),
            timeRemaining: oracle.getTimeRemaining()
          }
        }),
      };
    }
    
    // Check for season comparison request
    if (queryParams.compare) {
      const comparison = await oracle.getSeasonComparison();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          comparison,
          timestamp: new Date().toISOString()
        }),
      };
    }
    
    // Default: return current state
    const state = await oracle.getCurrentState();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        state,
        timestamp: new Date().toISOString()
      }),
    };
    
  } catch (error) {
    console.error('Get request error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to get season state',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
}

/**
 * Handle POST requests - admin actions
 */
async function handlePostRequest(oracle: ContractSeasonOracle, event: HandlerEvent) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { action, ...params } = body;
    
    switch (action) {
      case 'clear_cache':
        oracle.clearCache();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Cache cleared successfully'
          }),
        };
      
      case 'validate_season':
        if (!params.season) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Season data required' }),
          };
        }
        
        const isValid = oracle.validateSeasonData(params.season);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            valid: isValid,
            season: params.season
          }),
        };
      
      case 'calculate_season':
        const date = params.date ? new Date(params.date) : new Date();
        if (isNaN(date.getTime())) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid date' }),
          };
        }
        
        const seasonNumber = oracle.calculateSeasonNumber(date);
        const seasonInfo = await oracle.getSeasonInfoAsync(seasonNumber);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            seasonNumber,
            seasonInfo,
            calculatedFor: date.toISOString()
          }),
        };
      
      case 'get_boundaries':
        if (!params.seasonNumber) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Season number required' }),
          };
        }
        
        const boundaries = oracle.getSeasonBoundaries(params.seasonNumber);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            seasonNumber: params.seasonNumber,
            boundaries: {
              start: boundaries.start.toISOString(),
              end: boundaries.end.toISOString()
            }
          }),
        };
      
      case 'force_transition':
        // This would require admin authentication in production
        console.log('⚠️  Force transition requested:', params);
        
        // In production, this would trigger actual season transition
        // For now, just return what would happen
        const currentState = await oracle.getCurrentState();
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Force transition logged',
            currentSeason: currentState.current.number,
            targetSeason: params.targetSeason || (currentState.current.number + 1),
            warning: 'This is a simulated response - actual transition not implemented'
          }),
        };
      
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Unknown action',
            availableActions: [
              'clear_cache',
              'validate_season', 
              'calculate_season',
              'get_boundaries',
              'force_transition'
            ]
          }),
        };
    }
    
  } catch (error) {
    console.error('Post request error:', error);
    
    if (error instanceof SyntaxError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
      };
    }
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
}

/**
 * Utility function to check admin authentication
 * In production, this would verify admin credentials
 */
function isAdminRequest(event: HandlerEvent): boolean {
  // TODO: Implement actual admin authentication
  // For now, accept all requests
  return true;
}

/**
 * Log admin action for audit trail
 */
function logAdminAction(action: string, params: any, userInfo?: any): void {
  console.log('🔧 Admin action:', {
    action,
    params,
    userInfo,
    timestamp: new Date().toISOString()
  });
}