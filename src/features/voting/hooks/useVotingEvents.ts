import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getContractEvents, getRpcClient, eth_blockNumber, prepareEvent } from 'thirdweb';
import { useActiveAccount } from 'thirdweb/react';
import { client, CHAIN } from '@/lib/thirdweb';

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
    let pollInterval: NodeJS.Timeout;

    const setupEventListening = async () => {
      try {
        // Get RPC client for block number queries
        const rpcRequest = getRpcClient({ client, chain: CHAIN });
        let lastProcessedBlock = await eth_blockNumber(rpcRequest);

        const pollForEvents = async () => {
          if (!isSubscribed) return;

          try {
            const currentBlock = await eth_blockNumber(rpcRequest);
            
            if (currentBlock > lastProcessedBlock) {
              // Prepare events using the correct v5 syntax
              const voteDelegatedEvent = prepareEvent({
                signature: "event VoteDelegated(address indexed user, uint256 indexed evermarkId, uint256 amount, uint256 indexed cycle)"
              });

              const voteUndelegatedEvent = prepareEvent({
                signature: "event VoteUndelegated(address indexed user, uint256 indexed evermarkId, uint256 amount, uint256 indexed cycle)"
              });

              // Check for new voting events since last processed block
              const [delegateEvents, undelegateEvents] = await Promise.all([
                getContractEvents({
                  contract: votingContract,
                  fromBlock: lastProcessedBlock + 1n,
                  toBlock: currentBlock,
                  events: [voteDelegatedEvent]
                }),
                getContractEvents({
                  contract: votingContract,
                  fromBlock: lastProcessedBlock + 1n,
                  toBlock: currentBlock,
                  events: [voteUndelegatedEvent]
                })
              ]);

              // Check if any events are relevant to the current user or general updates
              const userRelevantEvents = [
                ...delegateEvents.filter(e => e.args.user.toLowerCase() === userAddress.toLowerCase()),
                ...undelegateEvents.filter(e => e.args.user.toLowerCase() === userAddress.toLowerCase())
              ];

              const anyVotingEvents = delegateEvents.length > 0 || undelegateEvents.length > 0;

              if (userRelevantEvents.length > 0) {
                console.log('👤 User voting events detected, invalidating user-specific queries');
                // Invalidate user-specific voting data
                queryClient.invalidateQueries({ 
                  queryKey: ['voting', 'power', userAddress] 
                });
                queryClient.invalidateQueries({ 
                  queryKey: ['voting', 'history', userAddress] 
                });
                queryClient.invalidateQueries({ 
                  queryKey: ['voting', 'userVotes', userAddress] 
                });
              }

              if (anyVotingEvents) {
                console.log('🗳️ General voting events detected, invalidating global queries');
                // Invalidate general voting data
                queryClient.invalidateQueries({ 
                  queryKey: ['voting', 'currentCycle'] 
                });
                queryClient.invalidateQueries({ 
                  queryKey: ['voting', 'evermarkVotes'] 
                });
              }

              lastProcessedBlock = currentBlock;
            }
          } catch (error) {
            console.error('Error polling for voting events:', error);
            // Don't throw - just log and continue polling
          }
        };

        // Initial poll
        await pollForEvents();

        // Set up polling interval (every 15 seconds)
        pollInterval = setInterval(pollForEvents, 15000);

      } catch (error) {
        console.error('Failed to setup voting event listening:', error);
      }
    };

    setupEventListening();

    return () => {
      isSubscribed = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [enabled, votingContract, userAddress, invalidateQueries, queryClient]);

  return {
    isListening: enabled && !!votingContract && !!userAddress
  };
}