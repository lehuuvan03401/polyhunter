# Design: Internationalization of Copy Trader Modal

## Strategy
We will utilize the existing `next-intl` setup. The `CopyTraderModal` is a client component (`'use client'`), so we can use the `useTranslations` hook directly.

## Namespace Structure
We will introduce a new top-level namespace `CopyTrader` to avoid collisions and keep `messages/*.json` organized.

```json
{
  "CopyTrader": {
    "title": "Copy {address}",
    "mode": {
      "simple": "Simple",
      "pro": "Pro"
    },
    "form": {
      "copyMode": "Copy Mode",
      "sharePercent": "% of Trader's Shares",
      "maxPerTrade": "Max per Trade",
      "fixedAmount": "Fixed Amount",
      "infiniteMode": "Infinite Mode"
    },
    "preview": {
      "text": "If trader buys {traderBuyAmount} → you copy {userCopyAmount}..."
    },
    "warnings": {
      "proxyRequired": "Proxy Required",
      "depositRequired": "Deposit Required"
    }
  }
}
```

## Implementation Details
1.  **Hooks**: `const t = useTranslations('CopyTrader');`
2.  **Interpolation**: Use `{variable}` syntax for dynamic values (e.g., address, amounts).
3.  **Rich Text**: Use rich text formatting if necessary (e.g. bolding inside a sentence), though most strings appear to be simple labels or basic sentences.
