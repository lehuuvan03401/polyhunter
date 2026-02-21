# Design: Team Network Structure UI

## Current State
```
┌─────────────────────────────────────────────────────────────────┐
│ Team Network Structure                                          │
├─────────────────────────────────────────────────────────────────┤
│ MEMBER         │ RANK     │ GEN │ VOLUME  │ TEAM SIZE           │
│ 0x7e03...65cb  │ ORDINARY │ 1   │ $0      │ -                   │
│ 0xee0f...d994  │ ORDINARY │ 1   │ $0      │ -                   │
│ ...flat list continues...                                       │
└─────────────────────────────────────────────────────────────────┘
```

**Problems:**
- Flat list doesn't show hierarchy
- No generation breakdown summary
- Team size column is empty
- Can't see who referred whom

---

## Proposed Design

### Option A: Generation Summary + Collapsible Tree (Recommended)

```
┌─────────────────────────────────────────────────────────────────┐
│ 👥 Team Network Structure                      [Summary] [Tree] │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ 📊 Generation Breakdown                                      ││
│ │ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐                     ││
│ │ │ Gen 1 │ │ Gen 2 │ │ Gen 3 │ │ Gen 4+│                     ││
│ │ │   5   │ │  15   │ │  30   │ │   0   │                     ││
│ │ │ 10%   │ │ 30%   │ │ 60%   │ │  0%   │                     ││
│ │ └───────┘ └───────┘ └───────┘ └───────┘                     ││
│ └──────────────────────────────────────────────────────────────┘│
│                                                                 │
│ 📋 Direct Referrals (5)                                         │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ ▼ DIRECT1 (VIP)         Vol: $8,234    Team: 9 members       ││
│ │   ├─ 0xabc1...1234 (ORD)  Vol: $1,234   Team: 2              ││
│ │   │   ├─ 0xdef1...5678                                       ││
│ │   │   └─ 0xghi1...9012                                       ││
│ │   ├─ 0xabc2...2345 (ORD)  Vol: $2,345   Team: 2              ││
│ │   └─ 0xabc3...3456 (ORD)  Vol: $3,456   Team: 2              ││
│ │                                                               ││
│ │ ▶ DIRECT2 (VIP)         Vol: $6,543    Team: 9 members       ││
│ │ ▶ DIRECT3 (VIP)         Vol: $7,890    Team: 9 members       ││
│ │ ▶ DIRECT4 (VIP)         Vol: $5,432    Team: 9 members       ││
│ │ ▶ DIRECT5 (VIP)         Vol: $4,321    Team: 9 members       ││
│ └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. GenerationSummaryBar
```tsx
interface GenerationSummary {
  generation: number;
  count: number;
  percentage: number;
}

<GenerationSummaryBar data={[
  { generation: 1, count: 5, percentage: 10 },
  { generation: 2, count: 15, percentage: 30 },
  { generation: 3, count: 30, percentage: 60 },
]} total={50} />
```

#### 2. TeamTreeNode (Recursive)
```tsx
interface TeamMember {
  address: string;
  referralCode?: string;
  tier: string;
  volume: number;
  teamSize: number;
  children: TeamMember[];
}

<TeamTreeNode 
  member={member} 
  depth={0} 
  isExpanded={true}
  onToggle={() => {}}
/>
```

---

## API Changes

### New Endpoint: `GET /api/affiliate/team/summary`
```json
{
  "total": 50,
  "byGeneration": [
    { "generation": 1, "count": 5 },
    { "generation": 2, "count": 15 },
    { "generation": 3, "count": 30 }
  ]
}
```

### Modified Endpoint: `GET /api/affiliate/team?format=tree`
```json
{
  "directReferrals": [
    {
      "address": "0x...",
      "referralCode": "DIRECT1",
      "tier": "VIP",
      "volume": 8234,
      "teamSize": 9,
      "children": [
        {
          "address": "0xabc1...",
          "tier": "ORDINARY",
          "volume": 1234,
          "teamSize": 2,
          "children": [...]
        }
      ]
    }
  ]
}
```

---

## Alternatives Considered

### Option B: Stacked Cards by Generation
Show separate cards for each generation level. Simpler but less interactive.

### Option C: Network Graph
D3.js force-directed graph. Visually appealing but complex and may not work well on mobile.

**Decision**: Option A provides the best balance of clarity, interactivity, and implementation complexity.

---

## Mobile Considerations
- Generation summary bar scrolls horizontally if needed
- Tree nodes collapse to single line on small screens
- Touch targets ≥ 44px for expand/collapse buttons
