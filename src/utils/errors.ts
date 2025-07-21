export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class APIError extends AppError {
  constructor(
    message: string,
    public status?: number,
    code?: string,
    context?: Record<string, any>
  ) {
    super(message, code, context);
    this.name = 'APIError';
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public field?: string,
    context?: Record<string, any>
  ) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export class BlockchainError extends AppError {
  constructor(
    message: string,
    public txHash?: string,
    context?: Record<string, any>
  ) {
    super(message, 'BLOCKCHAIN_ERROR', context);
    this.name = 'BlockchainError';
    this.txHash = txHash;
  }
}

// Validation types - moved from evermarks feature to utils
export interface ValidationFieldError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationFieldError[];
  warnings?: ValidationFieldError[];
}

// Error handling utilities
export function handleError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new AppError(error.message);
  }
  
  return new AppError('An unknown error occurred');
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('network') || 
           error.message.includes('fetch') ||
           error.message.includes('timeout');
  }
  return false;
}
