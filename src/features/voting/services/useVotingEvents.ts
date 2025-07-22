import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getContractEvents } from 'thirdweb';
import { useActiveAccount } from 'thirdweb/react';

interface VotingEventsHookProps {
  votingContract: any;
  enabled?: boolean;
}

export function useVotingEvents({ votingContract, enabled = true }: VotingEventsHookProps) {
  const queryClient = useQueryClient();
  const account = useActiveAccount();
  const userAddress = account?.address;

  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['voting'] });
  }, [queryClient]);

  useEffect(() => {
    if (!enabled || !votingContract || !userAddress) return;

    let isSubscribed = true;
    let eventSubscription: any = null;

    const setupEventListening = async () => {
      try {
        // Listen for all voting events
        const latestBlock = await votingContract.provider.getBlockNumber();
        let lastProcessedBlock = latestBlock;

        const pollForEvents = async () => {
          if (!isSubscribed) return;

          try {
            const currentBlock = await votingContract.provider.getBlockNumber();
            
            if (currentBlock > lastProcessedBlock) {
              // Check for new events since last processed block
              const events = await getContractEvents({
                contract: votingContract,
                fromBlock: BigInt(lastProcessedBlock + 1),
                toBlock: BigInt(currentBlock),
                eventName: 'VoteDelegated'
              });

              const undelegateEvents = await getContractEvents({
                contract: votingContract,
                fromBlock: BigInt(lastProcessedBlock + 1),
                toBlock: BigInt(currentBlock),
                eventName: 'VoteUndelegated'
              });

              if (events.length > 0 || undelegateEvents.length > 0) {
                console.log('New voting events detected, invalidating queries');
                invalidateQueries();
              }

              lastProcessedBlock = currentBlock;
            }
          } catch (error) {
            console.error('Error polling for voting events:', error);
          }

          // Poll every 15 seconds
          if (isSubscribed) {
            setTimeout(pollForEvents, 15000);
          }
        };

        // Start polling
        pollForEvents();

      } catch (error) {
        console.error('Failed to setup voting event listening:', error);
      }
    };

    setupEventListening();

    return () => {
      isSubscribed = false;
      if (eventSubscription) {
        eventSubscription.unsubscribe?.();
      }
    };
  }, [enabled, votingContract, userAddress, invalidateQueries]);

  return {
    // Could expose subscription status, error states, etc.
    isListening: enabled && !!votingContract && !!userAddress
  };
}

