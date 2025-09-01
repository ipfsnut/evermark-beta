// Re-export the hook from the notification system for convenience
import { useNotifications } from '../components/notifications/NotificationSystem';
export { useNotifications };

// Additional convenience hooks for common use cases
export function useErrorHandler() {
  const { error } = useNotifications();
  
  return (err: unknown, fallbackMessage = 'An error occurred') => {
    const message = err instanceof Error ? err.message : fallbackMessage;
    error('Error', message);
  };
}

export function useSuccessHandler() {
  const { success } = useNotifications();
  
  return (message: string, details?: string) => {
    success(message, details);
  };
}

export function useTransactionNotifications() {
  const { info, success, error } = useNotifications();
  
  return {
    transactionPending: (type: string) => 
      info('Transaction Pending', `Your ${type} transaction is being processed...`, { persistent: true }),
    
    transactionSuccess: (type: string, txHash?: string) =>
      success('Transaction Confirmed', `Your ${type} transaction was successful!${txHash ? ` (${txHash.substring(0, 10)}...)` : ''}`),
    
    transactionFailed: (type: string, reason?: string) =>
      error('Transaction Failed', `Your ${type} transaction failed.${reason ? ` ${reason}` : ''}`)
  };
}