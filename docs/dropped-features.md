# Dropped Features - Future Consideration

This document tracks features that were described in the original documentation but are not implemented in the current Evermark-Beta contracts. These may be considered for future versions if there's user demand or strategic need.

## Governance & Voting Features

### Vote Delegation System
**Original Concept**: Users could delegate their wEMARK to specific Evermarks, with flexible redelegation during voting cycles.

**Current Implementation**: Direct voting where users cast votes directly for Evermarks using their available voting power.

**Pros of Delegation**:
- More flexible voting strategies
- Ability to "set and forget" delegation
- Could enable more nuanced governance mechanisms

**Cons of Delegation**:
- Added contract complexity
- More gas costs for delegation changes
- Harder to understand for new users

**Future Consideration**: Could be added as an optional layer on top of current direct voting.

---

### Weekly Voting Cycles
**Original Concept**: Automatic 7-day voting cycles that restart weekly.

**Current Implementation**: Admin-controlled seasonal voting periods of flexible duration.

**Pros of Weekly Cycles**:
- Predictable, regular cadence
- Consistent user engagement
- Automated cycle management

**Cons of Weekly Cycles**:
- Less flexibility for protocol adjustments
- May not align with content creation patterns
- Fixed timing may not suit all use cases

**Future Consideration**: Could implement automatic cycle management as an upgrade.

---

## Reward System Features

### Participation Multipliers
**Original Concept**: Reward bonuses based on delegation percentage:
- 50-74% delegated: +25% rewards
- 75-99% delegated: +50% rewards  
- 100% delegated: +100% rewards

**Current Implementation**: Simple proportional rewards based on wEMARK stake only.

**Pros of Multipliers**:
- Incentivizes active participation
- Rewards engaged community members
- Could increase overall voting activity

**Cons of Multipliers**:
- Adds complexity to reward calculations
- Harder to audit and understand
- May favor sophisticated users over casual participants

**Future Consideration**: Could be implemented as an optional bonus layer if community governance activity is low.

---

### ETH vs WETH Rewards
**Original Concept**: Direct ETH rewards from platform fees.

**Current Implementation**: WETH rewards for easier contract handling.

**Pros of Direct ETH**:
- More intuitive for users
- No wrapping/unwrapping needed
- Direct value representation

**Cons of Direct ETH**:
- More complex contract interactions
- Potential issues with contract calls
- Less composable with DeFi ecosystem

**Future Consideration**: Could offer ETH unwrapping option at claim time.

---

## User Experience Features

### Personal Bookshelf System
**Original Concept**: 
- Favorites: Up to 3 favorite Evermarks
- Reading List: Up to 10 current reading items
- Personal Notes: Private notes on bookmarked content

**Current Implementation**: Not implemented in contracts (could be off-chain).

**Pros of On-Chain Bookshelf**:
- Permanent, verifiable collections
- Could enable reputation systems
- Decentralized personal data

**Cons of On-Chain Bookshelf**:
- High gas costs for personal data
- Privacy concerns with public notes
- Storage costs for users

**Future Consideration**: Better implemented off-chain with optional on-chain verification.

---

### Advanced Content Types
**Original Concept**: Built-in support for DOI, ISBN, and complex metadata structures.

**Current Implementation**: Generic content hash and metadata URI system.

**Pros of Specific Types**:
- Better UX for academic/book content
- Automatic metadata extraction
- Specialized features per content type

**Cons of Specific Types**:
- Contract bloat and complexity
- Maintenance overhead for each type
- Less flexible for new content types

**Future Consideration**: Could implement as optional metadata standards without contract changes.

---

## Technical Implementation Features

### Batch Operations
**Original Concept**: Batch voting, batch claiming, and other multi-transaction operations.

**Current Implementation**: Individual operations only.

**Pros of Batch Operations**:
- Gas efficiency for power users
- Better UX for large operations
- Reduced transaction count

**Cons of Batch Operations**:
- Contract complexity
- Potential for MEV exploitation
- Higher gas costs per transaction

**Future Consideration**: Could be added as separate batch contract or upgraded functions.

---

### Emergency Governance Features
**Original Concept**: Complex emergency pause/recovery mechanisms with community governance.

**Current Implementation**: Simple admin-controlled pause functions.

**Pros of Complex Emergency Features**:
- More decentralized emergency response
- Community involvement in critical decisions
- Protection against admin key compromise

**Cons of Complex Emergency Features**:
- Much higher contract complexity
- Potential for governance attacks
- Slower response in real emergencies

**Future Consideration**: Could implement progressive decentralization with community governance.

---

## Analysis & Recommendations

### High Priority for Future Implementation
1. **Batch Operations**: High user value, manageable complexity
2. **Automatic Voting Cycles**: Improves user experience, predictable engagement

### Medium Priority for Future Implementation
1. **Participation Multipliers**: If governance engagement is low
2. **Vote Delegation**: If users request more flexible voting

### Low Priority for Future Implementation
1. **Personal Bookshelf**: Better as off-chain feature
2. **Complex Emergency Governance**: Can be added with progressive decentralization

### Not Recommended for Implementation
1. **Advanced Content Types**: Better handled by standardized metadata
2. **ETH vs WETH**: Current WETH approach is more robust

---

## Decision Framework for Future Features

When considering these dropped features for future implementation:

1. **User Demand**: Is there clear user demand for this feature?
2. **Complexity Cost**: Does the added complexity justify the benefit?
3. **Gas Impact**: How much does this increase transaction costs?
4. **Security Risk**: Does this introduce new attack vectors?
5. **Maintenance Burden**: How much ongoing development does this require?
6. **Alternative Solutions**: Could this be solved off-chain or with external tools?

The current Evermark-Beta implementation prioritizes simplicity, security, and core functionality over feature completeness. This provides a solid foundation that can be extended based on real user needs and usage patterns.