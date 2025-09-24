import React from 'react';
import { DynamicFeeModal } from './DynamicFeeModal';
import { useDynamicPricing, formatCostEstimate } from '../hooks/useDynamicPricing';

interface DynamicPricingIntegrationProps {
  children: (props: {
    // State
    isDynamicPricingActive: boolean;
    isCheckingCosts: boolean;
    dynamicPricingError: string | null;
    
    // Functions
    checkCostsAndProceed: (castInput: string, options?: any) => Promise<{
      shouldProceed: boolean;
      agreedFeeUSD?: number;
      costEstimate?: any;
    }>;
    
    resetDynamicPricing: () => void;
    
    // Modal component (render this in your UI)
    DynamicPricingModal: React.ReactNode;
  }) => React.ReactNode;
}

/**
 * Integration wrapper for dynamic pricing functionality
 * 
 * Usage:
 * <DynamicPricingIntegration>
 *   {({ checkCostsAndProceed, DynamicPricingModal, ...rest }) => (
 *     <div>
 *       <YourForm onSubmit={async (data) => {
 *         const result = await checkCostsAndProceed(data.castUrl);
 *         if (result.shouldProceed) {
 *           // Proceed with creation using result.agreedFeeUSD
 *           await createEvermark(data, result.agreedFeeUSD);
 *         }
 *       }} />
 *       {DynamicPricingModal}
 *     </div>
 *   )}
 * </DynamicPricingIntegration>
 */
export function DynamicPricingIntegration({ children }: DynamicPricingIntegrationProps) {
  const {
    state,
    checkCostAndProceed,
    acceptFee,
    rejectFee,
    closeModal,
    reset,
  } = useDynamicPricing();

  // Format the cost estimate for the modal
  const formattedCostEstimate = formatCostEstimate(state.costEstimate);

  // Create the modal component
  const DynamicPricingModal = state.showModal && formattedCostEstimate ? (
    <DynamicFeeModal
      isOpen={state.showModal}
      onClose={closeModal}
      onAccept={acceptFee}
      onReject={rejectFee}
      totalCostUSD={formattedCostEstimate.totalCostUSD}
      currentFeeUSD={formattedCostEstimate.currentFeeUSD}
      recommendedFeeUSD={formattedCostEstimate.recommendedFeeUSD}
      profitUSD={formattedCostEstimate.profitUSD}
      breakdown={formattedCostEstimate.breakdown}
      castUrl={state.castInput || undefined}
      isProcessing={false}
    />
  ) : null;

  return (
    <>
      {children({
        // State
        isDynamicPricingActive: state.showModal,
        isCheckingCosts: state.isLoading,
        dynamicPricingError: state.error,
        
        // Functions
        checkCostsAndProceed: checkCostAndProceed,
        resetDynamicPricing: reset,
        
        // Modal component
        DynamicPricingModal,
      })}
    </>
  );
}

/**
 * Hook version for more direct integration
 * 
 * Usage:
 * const { checkCostsAndProceed, DynamicPricingModal } = useDynamicPricingIntegration();
 * 
 * // In your form submit:
 * const result = await checkCostsAndProceed(castUrl);
 * if (result.shouldProceed) {
 *   await createEvermark(data, result.agreedFeeUSD);
 * }
 * 
 * // In your render:
 * return <div>{...yourForm} {DynamicPricingModal}</div>
 */
export function useDynamicPricingIntegration() {
  const {
    state,
    checkCostAndProceed,
    acceptFee,
    rejectFee,
    closeModal,
    reset,
  } = useDynamicPricing();

  const formattedCostEstimate = formatCostEstimate(state.costEstimate);

  const DynamicPricingModal = state.showModal && formattedCostEstimate ? (
    <DynamicFeeModal
      isOpen={state.showModal}
      onClose={closeModal}
      onAccept={acceptFee}
      onReject={rejectFee}
      totalCostUSD={formattedCostEstimate.totalCostUSD}
      currentFeeUSD={formattedCostEstimate.currentFeeUSD}
      recommendedFeeUSD={formattedCostEstimate.recommendedFeeUSD}
      profitUSD={formattedCostEstimate.profitUSD}
      breakdown={formattedCostEstimate.breakdown}
      castUrl={state.castInput || undefined}
      isProcessing={false}
    />
  ) : null;

  return {
    // State
    isDynamicPricingActive: state.showModal,
    isCheckingCosts: state.isLoading,
    dynamicPricingError: state.error,
    costEstimate: formattedCostEstimate,
    
    // Functions
    checkCostsAndProceed: checkCostAndProceed,
    resetDynamicPricing: reset,
    
    // Components
    DynamicPricingModal,
  };
}