import React from 'react';
import { CheckCircle, Circle, AlertCircle } from 'lucide-react';

interface WizardStep {
  step: number;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
}

interface StepIndicatorProps {
  steps: WizardStep[];
  currentStep: number;
  className?: string;
}

export function StepIndicator({ steps, currentStep, className = '' }: StepIndicatorProps) {
  const getStepIcon = (step: WizardStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-400" />;
      case 'in_progress':
        return <Circle className="w-6 h-6 text-blue-400 animate-pulse" />;
      default:
        return <Circle className="w-6 h-6 text-gray-500" />;
    }
  };

  const getStepLineClass = (stepNumber: number) => {
    if (stepNumber >= steps.length) return '';
    
    const nextStep = steps[stepNumber];
    if (!nextStep) return '';
    
    if (nextStep.status === 'completed') return 'bg-green-400';
    if (nextStep.status === 'in_progress') return 'bg-blue-400';
    if (nextStep.status === 'error') return 'bg-red-400';
    return 'bg-gray-600';
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={step.step}>
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <div 
                className={`relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300 ${
                  step.status === 'completed' 
                    ? 'border-green-400 bg-green-400/20' 
                    : step.status === 'in_progress'
                    ? 'border-blue-400 bg-blue-400/20'
                    : step.status === 'error'
                    ? 'border-red-400 bg-red-400/20'
                    : 'border-gray-500 bg-gray-500/10'
                }`}
              >
                {getStepIcon(step)}
                
                {/* Step Number Badge */}
                <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step.status === 'completed'
                    ? 'bg-green-400 text-black'
                    : step.status === 'in_progress'
                    ? 'bg-blue-400 text-white'
                    : step.status === 'error'
                    ? 'bg-red-400 text-white'
                    : 'bg-gray-600 text-gray-300'
                }`}>
                  {step.step}
                </div>
              </div>
              
              {/* Step Label */}
              <div className="mt-3 text-center max-w-32">
                <p className={`text-sm font-medium ${
                  step.status === 'completed'
                    ? 'text-green-400'
                    : step.status === 'in_progress'
                    ? 'text-blue-400'
                    : step.status === 'error'
                    ? 'text-red-400'
                    : 'text-gray-400'
                }`}>
                  {step.name}
                </p>
                
                {/* Status Badge */}
                <div className="mt-1">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                    step.status === 'completed'
                      ? 'bg-green-900 text-green-400'
                      : step.status === 'in_progress'
                      ? 'bg-blue-900 text-blue-400'
                      : step.status === 'error'
                      ? 'bg-red-900 text-red-400'
                      : 'bg-gray-800 text-gray-500'
                  }`}>
                    {step.status === 'in_progress' ? 'Active' : 
                     step.status === 'completed' ? 'Done' :
                     step.status === 'error' ? 'Error' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>

            {/* Connection Line */}
            {index < steps.length - 1 && (
              <div className="flex-1 mx-4">
                <div 
                  className={`h-1 transition-all duration-500 ${getStepLineClass(index + 1)}`}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
      
      {/* Progress Bar */}
      <div className="mt-8">
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>Overall Progress</span>
          <span>{steps.filter(s => s.status === 'completed').length}/{steps.length} completed</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
            style={{ 
              width: `${(steps.filter(s => s.status === 'completed').length / steps.length) * 100}%` 
            }}
          />
        </div>
      </div>
    </div>
  );
}