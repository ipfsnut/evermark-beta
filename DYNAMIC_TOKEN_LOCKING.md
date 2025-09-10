# Dynamic Token Locking: The EvermarkRewards Economic Flywheel

## Executive Summary

The EvermarkRewards contract implements a sophisticated **adaptive pool-based distribution system** that can create a powerful economic flywheel effect. When trading activity generates more fee revenue than the contract distributes in rewards, it creates a **dynamic supply sink** that effectively locks $EMARK tokens out of circulation without requiring explicit locking mechanisms.

## The Core Mechanism

### 1. Adaptive Rate Calculation

The contract recalculates distribution rates at the start of each period (typically 7 days) based on the **actual pool balance**:

```solidity
// Distribution rate calculation (simplified)
newRate = (poolBalance * annualRate * periodDuration) / (365 days)
```

**Key Insight**: The distribution amount is a **percentage of the current pool**, not a fixed amount.

### 2. The Rebalancing Process

Every 7 days, the contract:
1. Takes a snapshot of current pool balances (WETH and $EMARK)
2. Calculates new distribution rates based on these balances
3. Sets these rates for the next 7-day period
4. Distributes rewards at the fixed rate until next rebalancing

## The Economic Flywheel Effect

### Scenario Analysis

Let's analyze different trading volume scenarios with these assumptions:
- **Distribution Rate**: 20% APR (2000 basis points)
- **Trading Fee**: 0.8% total (0.4% to FeeCollector → EvermarkRewards)
- **Rebalancing Period**: 7 days
- **Initial Pool**: 100,000 $EMARK

#### Scenario 1: Low Trading Volume ($250,000/week)
```
Weekly Fee Revenue: $250,000 × 0.4% = $1,000 worth of $EMARK
Weekly Distribution: 100,000 × (20% ÷ 52) = 385 $EMARK (~$385)

Net Effect: +$615 worth locked per week
Pool Growth: +160% annually
```

#### Scenario 2: Moderate Trading Volume ($1,000,000/week)
```
Weekly Fee Revenue: $1,000,000 × 0.4% = $4,000 worth of $EMARK
Weekly Distribution: 100,000 × (20% ÷ 52) = 385 $EMARK (~$385)

Net Effect: +$3,615 worth locked per week
Pool Growth: +940% annually
```

#### Scenario 3: High Trading Volume ($5,000,000/week)
```
Weekly Fee Revenue: $5,000,000 × 0.4% = $20,000 worth of $EMARK
Weekly Distribution: 100,000 × (20% ÷ 52) = 385 $EMARK (~$385)

Net Effect: +$19,615 worth locked per week
Pool Growth: +5,100% annually
```

## The Compounding Effect

The truly fascinating aspect is the **compounding nature** of this mechanism:

### Week-by-Week Progression (Moderate Volume Example)
```
Week 1: Pool = 100,000 $EMARK
        Distribution = 385 $EMARK
        Inflow = 4,000 $EMARK
        New Pool = 103,615 $EMARK

Week 2: Pool = 103,615 $EMARK
        Distribution = 399 $EMARK (increased!)
        Inflow = 4,000 $EMARK
        New Pool = 107,216 $EMARK

Week 3: Pool = 107,216 $EMARK
        Distribution = 413 $EMARK (increased!)
        Inflow = 4,000 $EMARK
        New Pool = 110,803 $EMARK
```

**Key Observation**: While distributions increase each week (making it more attractive to stake), the inflow from trading fees can consistently outpace distributions, creating a sustainable lockup mechanism.

## Mathematical Model

### The Equilibrium Point

The system reaches equilibrium when:
```
Weekly Trading Volume × Fee Rate = Pool Size × (APR ÷ 52)
```

Solving for equilibrium pool size:
```
Equilibrium Pool = (Weekly Volume × Fee Rate × 52) ÷ APR
```

**Example**: With $1M weekly volume and 20% APR:
```
Equilibrium Pool = ($1,000,000 × 0.004 × 52) ÷ 0.20
Equilibrium Pool = $208,000 ÷ 0.20
Equilibrium Pool = $1,040,000 worth of $EMARK
```

This means the pool would grow 10x before reaching equilibrium!

## Strategic Implications

### 1. Supply Dynamics
- **Circulating Supply Reduction**: Tokens flow into the rewards pool faster than they're distributed
- **No Explicit Locking Required**: The economic incentives create voluntary lockup
- **Market Impact**: Reduced circulating supply can support price appreciation

### 2. Staking Incentives
- **Growing Rewards**: As the pool grows, absolute reward amounts increase
- **Compounding Returns**: Early stakers benefit from pool growth
- **Sustainable Yield**: Funded by real trading activity, not inflation

### 3. Protocol Health Metrics
The ratio of inflow to outflow indicates protocol health:
```
Health Score = Weekly Fee Revenue ÷ Weekly Distribution

Score > 1.0: Pool growing (healthy)
Score = 1.0: Equilibrium
Score < 1.0: Pool shrinking (need more volume)
```

## Real-World Variables

### Factors That Enhance Locking
1. **Bull Markets**: Higher trading volumes = more fees
2. **New Listings**: Increased trading pairs using $EMARK
3. **Lower APR Settings**: Reduces distribution rate
4. **Speculation**: Traders buying anticipating supply squeeze

### Factors That Reduce Locking
1. **Bear Markets**: Lower trading volumes
2. **High APR Settings**: Increases distribution rate
3. **Mass Unstaking Events**: If many users claim simultaneously
4. **Competition**: Alternative yield opportunities

## Implementation Advantages

### 1. Self-Regulating System
- No manual intervention required
- Automatically adjusts to market conditions
- Cannot be gamed or exploited

### 2. Transparent and Predictable
- All parameters on-chain
- 7-day periods provide stability
- Users can calculate exact rewards

### 3. Aligned Incentives
- Stakers want more trading (more fees)
- Traders benefit from staker governance
- Protocol benefits from locked supply

## Advanced Scenarios

### The "Supercycle" Effect
If token price appreciates due to supply reduction:
1. Trading volume increases (higher notional values)
2. More fees flow to rewards pool
3. Pool grows faster than distribution
4. More supply locked
5. Price appreciates further
6. Return to step 1

### The "Whale Staking" Amplifier
When large holders stake for rewards:
1. Immediate supply shock (tokens locked in WEMARK)
2. Trading activity on reduced float
3. Higher fee generation per token in circulation
4. Accelerated pool growth
5. Increased rewards attract more stakers

## Risk Considerations

### 1. Liquidity Risk
- Too much supply locked could reduce trading liquidity
- Mitigation: 7-day unbonding period provides exit liquidity

### 2. Dependence on Volume
- System requires consistent trading to function
- Mitigation: Multiple fee sources (minting, marketplace, future products)

### 3. Parameter Risk
- APR set too high could drain pool
- Mitigation: Governance can adjust rates

## Conclusion

The EvermarkRewards contract creates a **revolutionary tokenomic mechanism** that:

1. **Dynamically adjusts supply** based on protocol usage
2. **Rewards long-term holders** with sustainable yield
3. **Creates positive feedback loops** between trading and staking
4. **Requires no complex locking mechanisms** - pure economic incentives

This system could become a model for DeFi protocols seeking to:
- Reduce token velocity
- Create sustainable yield
- Align stakeholder incentives
- Build long-term value accrual

The mathematical elegance lies in its simplicity: **when people use the protocol, tokens get locked**. The more usage, the more locking. It's a self-reinforcing cycle that could dramatically reduce effective circulating supply while maintaining liquidity for those who need it.

## Technical Parameters (Current)

```solidity
Distribution Rates (adjustable by governance):
- WETH: Up to 500% APR (50000 basis points max)
- EMARK: Up to 500% APR (50000 basis points max)

Rebalancing Period: 7 days (adjustable, minimum 1 hour)

Fee Sources:
- Clanker Pool: 0.4% of trading volume
- Future: Marketplace fees (1% planned)
- Future: Additional trading pairs
```

This dynamic locking mechanism represents a significant innovation in tokenomics, creating value accrual through usage rather than arbitrary inflation or deflation mechanisms.