# IPDM

Decentralized secret chat

# Monorepo

The monorepo is using [Turborepo](https://turborepo.org/) and [pnpm workspaces](https://pnpm.io/workspaces) to link packages together.

Packages:

- [./apps/ipdm](./apps/ipdm): Frontend written with Preact, Vite, Tailwind, Typescript
- [./packages/client](./packages/client): Exports UI components that use TypeScript and Tailwind CSS and is compiled by SWC.
- [./packages/relay](./packages/relay): Libp2p relay server

## Dev

Next, run `app` in development mode:

```bash
pnpm dev
```

The app should be up and running at http://localhost:5174.
