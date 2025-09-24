import { useState, useCallback } from 'react';
import { SimpleCastBackupService, type BackupCostEstimate } from '../services/SimpleCastBackupService';

interface DynamicPricingState {
  isLoading: boolean;
  showModal: boolean;
  costEstimate: BackupCostEstimate | null;
  error: string | null;
  userAgreedFee: number | null;
  castInput: string | null;
}

interface DynamicPricingResult {
  // State
  state: DynamicPricingState;
  
  // Actions
  checkCostAndProceed: (castInput: string, options?: any) => Promise<{
    shouldProceed: boolean;
    agreedFeeUSD?: number;
    costEstimate?: BackupCostEstimate;
  }>;
  
  // Modal controls
  acceptFee: (agreedFeeUSD: number) => void;
  rejectFee: () => void;
  closeModal: () => void;
  
  // Reset
  reset: () => void;
}

const STANDARD_FEE_USD = 0.30; // Current user fee
const DYNAMIC_PRICING_THRESHOLD = 0.20; // Show modal if ArDrive cost > $0.20

export function useDynamicPricing(): DynamicPricingResult {
  const [state, setState] = useState<DynamicPricingState>({
    isLoading: false,
    showModal: false,
    costEstimate: null,
    error: null,
    userAgreedFee: null,
    castInput: null,
  });

  const updateState = useCallback((updates: Partial<DynamicPricingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const checkCostAndProceed = useCallback(async (
    castInput: string, 
    options: any = {}
  ): Promise<{
    shouldProceed: boolean;
    agreedFeeUSD?: number;
    costEstimate?: BackupCostEstimate;
  }> => {
    try {
      updateState({ 
        isLoading: true, 
        error: null, 
        castInput,
        userAgreedFee: null 
      });

      console.log('🔍 Checking dynamic pricing for cast:', castInput);

      // Get accurate cost estimate
      const costEstimate = await SimpleCastBackupService.getCostEstimate(castInput, {
        includeMedia: options.includeMedia ?? true,
        includeThread: options.includeThread ?? false,
        userWallet: options.userWallet,
      });

      console.log('💰 Cost estimate received:', costEstimate);

      updateState({ 
        isLoading: false, 
        costEstimate 
      });

      // Check if we need dynamic pricing - simplified with 25MB limit
      const shouldChargeExtra = costEstimate.totalCostUSD > DYNAMIC_PRICING_THRESHOLD;

      if (!shouldChargeExtra) {
        // Standard pricing, proceed normally
        console.log('✅ Using standard pricing, no modal needed');
        return {
          shouldProceed: true,
          agreedFeeUSD: STANDARD_FEE_USD,
          costEstimate,
        };
      }

      // Need to show dynamic pricing modal
      console.log('⚡ Dynamic pricing required, showing modal');
      updateState({ showModal: true });

      // Wait for user decision
      return new Promise((resolve) => {
        const checkUserDecision = () => {
          setState(currentState => {
            if (currentState.userAgreedFee !== null) {
              // User made a decision
              const agreedFeeUSD = currentState.userAgreedFee;
              console.log('👤 User decision received:', agreedFeeUSD > 0 ? `Pay $${agreedFeeUSD}` : 'Rejected');
              
              resolve({
                shouldProceed: agreedFeeUSD > 0,
                agreedFeeUSD: agreedFeeUSD > 0 ? agreedFeeUSD : undefined,
                costEstimate,
              });
              
              return {
                ...currentState,
                showModal: false,
              };
            }
            return currentState;
          });
        };

        // Check immediately and then poll for user decision
        checkUserDecision();
        const interval = setInterval(checkUserDecision, 100);
        
        // Cleanup after 5 minutes
        setTimeout(() => {
          clearInterval(interval);
          resolve({ 
            shouldProceed: false,
            costEstimate,
          });
        }, 300000);
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to estimate costs';
      console.error('❌ Dynamic pricing check failed:', error);
      
      updateState({ 
        isLoading: false, 
        error: errorMessage 
      });

      return {
        shouldProceed: false,
        costEstimate: undefined,
      };
    }
  }, [updateState]);

  const acceptFee = useCallback((agreedFeeUSD: number) => {
    console.log('✅ User accepted dynamic fee:', agreedFeeUSD);
    updateState({ 
      userAgreedFee: agreedFeeUSD,
      showModal: false,
    });
  }, [updateState]);

  const rejectFee = useCallback(() => {
    console.log('❌ User rejected dynamic fee');
    updateState({ 
      userAgreedFee: -1, // Negative indicates rejection
      showModal: false,
    });
  }, [updateState]);

  const closeModal = useCallback(() => {
    updateState({ 
      showModal: false,
      userAgreedFee: -1, // Treat close as rejection
    });
  }, [updateState]);

  const reset = useCallback(() => {
    console.log('🔄 Resetting dynamic pricing state');
    setState({
      isLoading: false,
      showModal: false,
      costEstimate: null,
      error: null,
      userAgreedFee: null,
      castInput: null,
    });
  }, []);

  return {
    state,
    checkCostAndProceed,
    acceptFee,
    rejectFee,
    closeModal,
    reset,
  };
}

/**
 * Helper function to format cost estimates for display
 */
export function formatCostEstimate(estimate: BackupCostEstimate | null) {
  if (!estimate) return null;

  const {
    totalCostUSD,
    breakdown = {},
  } = estimate;

  const {
    shouldChargeExtra = false,
    recommendedFeeUSD = STANDARD_FEE_USD,
    ourProfitUSD = STANDARD_FEE_USD - totalCostUSD,
    mediaFiles = [],
  } = breakdown;

  return {
    totalCostUSD: Math.round(totalCostUSD * 10000) / 10000,
    currentFeeUSD: STANDARD_FEE_USD,
    recommendedFeeUSD: Math.round(recommendedFeeUSD * 10000) / 10000,
    profitUSD: Math.round(ourProfitUSD * 10000) / 10000,
    shouldChargeExtra,
    mediaFiles,
    breakdown,
    
    // Formatting helpers
    extraFeeUSD: Math.round((recommendedFeeUSD - STANDARD_FEE_USD) * 10000) / 10000,
    extraFeeETH: Math.round(((recommendedFeeUSD - STANDARD_FEE_USD) / 2500) * 1000000) / 1000000,
    isLosing: ourProfitUSD < 0,
  };
}

/**
 * Helper to convert USD to ETH (should use real price feed in production)
 */
export function convertUSDToETH(usdAmount: number, ethPriceUSD: number = 2500): number {
  return Math.round((usdAmount / ethPriceUSD) * 1000000) / 1000000; // 6 decimal places
}