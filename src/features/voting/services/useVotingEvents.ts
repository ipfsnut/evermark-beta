import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getContractEvents, prepareEvent } from 'thirdweb';
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
    let pollTimer: ReturnType<typeof setTimeout>;

    const setupEventListening = async () => {
      try {
        // Prepare event definitions for Thirdweb v5
        const voteCastEvent = prepareEvent({
          signature: "event VoteCast(address indexed voter, uint256 indexed season, uint256 indexed evermarkId, uint256 votes)"
        });

        const voteWithdrawnEvent = prepareEvent({
          signature: "event VoteWithdrawn(address indexed voter, uint256 indexed season, uint256 indexed evermarkId, uint256 votes)"
        });

        const cycleStartedEvent = prepareEvent({
          signature: "event NewVotingCycle(uint256 indexed cycleNumber, uint256 timestamp)"
        });

        const cycleFinalizedEvent = prepareEvent({
          signature: "event CycleFinalized(uint256 indexed cycleNumber, uint256 totalVotes, uint256 totalEvermarks)"
        });

        // Get initial block number
        let lastProcessedBlock = BigInt(0);
        
        try {
          // Try to get current block number, fallback to 0 if not available
          const currentBlock = await votingContract.client.eth.getBlockNumber?.() || BigInt(0);
          lastProcessedBlock = currentBlock > BigInt(100) ? currentBlock - BigInt(100) : BigInt(0);
        } catch (error) {
          console.warn('Could not get current block number, starting from 0:', error);
          lastProcessedBlock = BigInt(0);
        }

        const pollForEvents = async () => {
          if (!isSubscribed) return;

          try {
            const currentBlock = await votingContract.client.eth.getBlockNumber?.() || lastProcessedBlock + BigInt(10);
            
            if (currentBlock > lastProcessedBlock) {
              const fromBlock = lastProcessedBlock + BigInt(1);
              const toBlock = currentBlock;

              // Check for voting events
              const [voteEvents, withdrawEvents, cycleEvents, finalizeEvents] = await Promise.all([
                getContractEvents({
                  contract: votingContract,
                  events: [voteCastEvent],
                  fromBlock,
                  toBlock,
                }).catch(() => []),
                
                getContractEvents({
                  contract: votingContract,
                  events: [voteWithdrawnEvent],
                  fromBlock,
                  toBlock,
                }).catch(() => []),
                
                getContractEvents({
                  contract: votingContract,
                  events: [cycleStartedEvent],
                  fromBlock,
                  toBlock,
                }).catch(() => []),
                
                getContractEvents({
                  contract: votingContract,
                  events: [cycleFinalizedEvent],
                  fromBlock,
                  toBlock,
                }).catch(() => [])
              ]);

              const totalEvents = voteEvents.length + withdrawEvents.length + cycleEvents.length + finalizeEvents.length;

              if (totalEvents > 0) {
                console.log(`Detected ${totalEvents} voting events, invalidating queries`);
                invalidateQueries();
              }

              lastProcessedBlock = currentBlock;
            }
          } catch (error) {
            console.error('Error polling for voting events:', error);
          }

          // Schedule next poll
          if (isSubscribed) {
            pollTimer = setTimeout(pollForEvents, 15000);
          }
        };

        // Start polling after a short delay
        pollTimer = setTimeout(pollForEvents, 1000);

      } catch (error) {
        console.error('Failed to setup voting event listening:', error);
      }
    };

    setupEventListening();

    return () => {
      isSubscribed = false;
      if (pollTimer) {
        clearTimeout(pollTimer);
      }
    };
  }, [enabled, votingContract, userAddress, invalidateQueries]);

  return {
    isListening: enabled && !!votingContract && !!userAddress
  };
}