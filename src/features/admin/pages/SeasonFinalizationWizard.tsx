import React, { useState, useEffect } from 'react';
import { ArrowLeft, Settings } from 'lucide-react';
import { StepIndicator } from '../components/wizard/StepIndicator';
import { SeasonOverview } from '../components/wizard/SeasonOverview';
import { DataSync } from '../components/wizard/DataSync';
import { WinnerSelection } from '../components/wizard/WinnerSelection';
import { DistributionReview } from '../components/wizard/DistributionReview';
import { ExecutionMonitor } from '../components/wizard/ExecutionMonitor';

interface WizardStep {
  step: number;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  data?: any;
  errors?: string[];
}

interface SeasonFinalizationWizardProps {
  seasonNumber: number;
  onExit: () => void;
  className?: string;
}

export function SeasonFinalizationWizard({ 
  seasonNumber, 
  onExit, 
  className = '' 
}: SeasonFinalizationWizardProps) {
  const [steps, setSteps] = useState<WizardStep[]>([
    { step: 1, name: 'Season Status & Validation', status: 'in_progress' },
    { step: 2, name: 'Data Sync & Final Ranking', status: 'pending' },
    { step: 3, name: 'Winner Selection & Rewards', status: 'pending' },
    { step: 4, name: 'Review & Approval', status: 'pending' },
    { step: 5, name: 'Execution & Monitoring', status: 'pending' }
  ]);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [seasonData, setSeasonData] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [rewardCalculation, setRewardCalculation] = useState<any>(null);
  const [distributions, setDistributions] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const defaultPoolSize = BigInt("2100000000000000000000"); // 2100 EMARK

  // Load initial wizard state
  useEffect(() => {
    loadWizardState();
  }, [seasonNumber]);

  const loadWizardState = async () => {
    setIsLoading(true);
    
    try {
      // Check if wizard already exists for this season
      const statusResponse = await fetch(`/.netlify/functions/admin/season-finalize?action=get-wizard-status&season=${seasonNumber}`);
      if (statusResponse.ok) {
        const status = await statusResponse.json();
        if (status.steps && status.steps.length > 0) {
          setSteps(status.steps);
          setCurrentStep(status.currentStep);
        }
      }

      // Load season data for validation
      const validationResponse = await fetch(`/.netlify/functions/admin/season-finalize?action=validate-season&season=${seasonNumber}`);
      if (validationResponse.ok) {
        const validation = await validationResponse.json();
        setSeasonData(validation);
      }

    } catch (error) {
      console.error('Failed to load wizard state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStepStatus = (stepNumber: number, status: WizardStep['status'], data?: any) => {
    setSteps(prev => prev.map(step => 
      step.step === stepNumber 
        ? { ...step, status, data }
        : step
    ));
  };

  const proceedToStep = (stepNumber: number) => {
    // Mark previous step as completed
    if (stepNumber > 1) {
      updateStepStatus(stepNumber - 1, 'completed');
    }
    
    // Set new step as in progress
    updateStepStatus(stepNumber, 'in_progress');
    setCurrentStep(stepNumber);
  };

  const handleValidation = async () => {
    try {
      const response = await fetch(`/.netlify/functions/admin/season-finalize?action=validate-season&season=${seasonNumber}`);
      if (!response.ok) {
        throw new Error('Validation failed');
      }
      
      const validation = await response.json();
      setSeasonData(validation);
      
      if (validation.canProceed) {
        updateStepStatus(1, 'completed', validation);
      } else {
        updateStepStatus(1, 'error', { errors: validation.discrepancies });
      }
    } catch (error) {
      console.error('Validation failed:', error);
      updateStepStatus(1, 'error', { errors: ['Validation failed'] });
    }
  };

  const handleSyncComplete = (finalLeaderboard: any[]) => {
    setLeaderboard(finalLeaderboard);
    updateStepStatus(2, 'completed', { leaderboard: finalLeaderboard });
  };

  const handleRewardsCalculated = (calculation: any) => {
    setRewardCalculation(calculation);
    updateStepStatus(3, 'completed', calculation);
  };

  const handleDistributionApproved = (approvedDistributions: any[]) => {
    setDistributions(approvedDistributions);
    updateStepStatus(4, 'completed', { distributions: approvedDistributions });
  };

  const handleExecutionComplete = () => {
    updateStepStatus(5, 'completed');
    // Show completion message for a moment, then exit
    setTimeout(() => {
      onExit();
    }, 3000);
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <SeasonOverview
            seasonNumber={seasonNumber}
            endTime={seasonData?.endTime ? new Date(seasonData.endTime) : new Date()}
            totalVotes={seasonData?.totalVotes || BigInt(0)}
            isValidated={steps[0].status === 'completed'}
            onProceed={() => proceedToStep(2)}
            onValidate={handleValidation}
            isValidating={false}
          />
        );
      
      case 2:
        return (
          <DataSync
            seasonNumber={seasonNumber}
            onSyncComplete={handleSyncComplete}
            onProceed={() => proceedToStep(3)}
            isSyncing={isSyncing}
            setSyncing={setIsSyncing}
          />
        );
      
      case 3:
        return (
          <WinnerSelection
            seasonNumber={seasonNumber}
            onRewardsCalculated={handleRewardsCalculated}
            onProceed={() => proceedToStep(4)}
            poolSize={defaultPoolSize}
          />
        );
      
      case 4:
        return (
          <DistributionReview
            seasonNumber={seasonNumber}
            rewardCalculation={rewardCalculation}
            onApprove={handleDistributionApproved}
            onProceed={() => proceedToStep(5)}
          />
        );
      
      case 5:
        return (
          <ExecutionMonitor
            seasonNumber={seasonNumber}
            distributions={distributions}
            onComplete={handleExecutionComplete}
          />
        );
      
      default:
        return <div className="text-center py-12 text-gray-400">Invalid step</div>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading wizard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-6xl mx-auto ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onExit}
          className="flex items-center px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Admin Dashboard
        </button>
        
        <div className="flex items-center">
          <Settings className="w-6 h-6 mr-2 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Season {seasonNumber} Finalization</h1>
        </div>
        
        <div className="w-32" /> {/* Spacer for center alignment */}
      </div>

      {/* Step Indicator */}
      <StepIndicator
        steps={steps}
        currentStep={currentStep}
        className="mb-12"
      />

      {/* Step Content */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-8">
        {renderCurrentStep()}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-gray-400">
        <p>Season Finalization Wizard • Step {currentStep} of {steps.length}</p>
      </div>
    </div>
  );
}