// shared/services/EventService.ts
// Proper Thirdweb v5 event handling for backend functions

import { prepareEvent, getContractEvents } from 'thirdweb';
import type { ContractEvent, VoteRecord } from './DatabaseTypes';

export class EventService {
  
  /**
   * Get voting events using proper Thirdweb v5 syntax
   * Copied from working VotingService.ts frontend code
   */
  static async getVotingEvents(
    contract: any, 
    fromBlock: bigint, 
    toBlock: bigint | "latest"
  ): Promise<ContractEvent[]> {
    
    const events = await getContractEvents({
      contract,
      events: [
        prepareEvent({
          signature: "event VoteCast(address indexed voter, uint256 indexed evermarkId, uint256 amount)"
        }),
        prepareEvent({
          signature: "event VotesDelegated(address indexed delegator, uint256 indexed evermarkId, uint256 amount)"
        }),
        prepareEvent({
          signature: "event VotesRecalled(address indexed delegator, uint256 indexed evermarkId, uint256 amount)"
        }),
        prepareEvent({
          signature: "event VoteForEvermark(address indexed voter, uint256 indexed evermarkId, uint256 amount)"
        }),
        prepareEvent({
          signature: "event Delegated(address indexed delegator, uint256 indexed evermarkId, uint256 amount)"
        })
      ],
      fromBlock,
      toBlock
    });
    
    // Properly type and validate events
    return events.map(event => {
      const eventData = event as any;
      return {
        args: {
          voter: eventData.args?.voter as string,
          delegator: eventData.args?.delegator as string,
          evermarkId: eventData.args?.evermarkId as bigint,
          amount: eventData.args?.amount as bigint
        },
        transactionHash: eventData.transactionHash as string,
        blockNumber: eventData.blockNumber as bigint,
        logIndex: eventData.logIndex as number
      };
    });
  }
  
  /**
   * Convert contract event to database vote record
   */
  static eventToVoteRecord(event: ContractEvent, cycle: number): VoteRecord {
    const voter = event.args.voter || event.args.delegator;
    if (!voter || !event.args.evermarkId || !event.args.amount) {
      throw new Error('Invalid event data: missing required fields');
    }
    
    return {
      user_id: voter.toLowerCase(),
      evermark_id: event.args.evermarkId.toString(),
      cycle,
      amount: event.args.amount.toString(),
      action: 'vote',
      metadata: {
        transaction_hash: event.transactionHash,
        block_number: event.blockNumber.toString(),
        log_index: event.logIndex
      }
    };
  }

  /**
   * Validate event data before processing
   */
  static validateEvent(event: any): event is ContractEvent {
    return event && 
           event.args && 
           (event.args.voter || event.args.delegator) &&
           event.args.evermarkId &&
           event.args.amount &&
           event.transactionHash &&
           event.blockNumber !== undefined &&
           event.logIndex !== undefined;
  }
}