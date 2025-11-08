LI.FI Bridge dApp — Next.js 14 (App Router)

This dApp demonstrates cross-chain bridging and swapping using LI.FI routes and intents. It includes:

- Chain and token selection populated from LI.FI APIs
- Quote fetching with fee, time estimate, and minimum received
- Wallet connect via RainbowKit (WalletConnect project ID)
- Server-side API proxies to LI.FI REST endpoints

Docs:
- LI.FI API reference: https://docs.li.fi/api-reference/introduction
- Supported chains: https://docs.li.fi/api-reference/get-information-about-all-currently-supported-chains
- Tokens: https://docs.li.fi/api-reference/fetch-all-known-tokens
- Bridges & exchanges: https://docs.li.fi/api-reference/get-available-bridges-and-exchanges
- Quote: https://docs.li.fi/api-reference/get-a-quote-for-a-token-transfer
- Advanced routes: https://docs.li.fi/api-reference/advanced/get-a-set-of-routes-for-a-request-that-describes-a-transfer-of-tokens
- Intents overview: https://docs.li.fi/lifi-intents/for-developers/intro

## Getting Started

1) Install deps

```zsh
pnpm install
```

2) Configure env

Copy `.env.local.example` to `.env.local` and fill values:

```
LI_FI_API_BASE=https://li.quest/v1
LI_FI_INTENTS_BASE=https://intents.li.fi/v1
# Optional LI.FI API key
# LI_FI_API_KEY=
# Required for WalletConnect via RainbowKit
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

3) Run dev server

```zsh
pnpm dev
```

## Testing

```zsh
pnpm test
```

## Notes

- The server routes under `app/api/lifi/*` forward your requests to LI.FI and inject `x-lifi-api-key` if provided.
- The UI uses React Query for data fetching and Zustand for local state.
- WalletConnect requires a project ID from https://cloud.walletconnect.com/.
