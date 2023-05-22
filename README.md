---
name: Monorepo with Turborepo
slug: monorepo-turborepo
description: Learn to implement a monorepo with a single Next.js site that has installed two local packages.
framework: Next.js
useCase: Documentation
css: Tailwind
deployUrl: https://vercel.com/new/clone?repository-url=https://github.com/vercel/examples/tree/main/solutions/monorepo&project-name=monorepo&repository-name=monorepo&root-directory=apps/app&install-command=pnpm%20install&build-command=cd%20..%2F..%20%26%26%20pnpm%20build%20--filter%3Dapp...&ignore-command=npx%20turbo-ignore
demoUrl: https://solutions-monorepo.vercel.sh
relatedTemplates:
  - monorepo-nx
  - microfrontends
---

# Monorepo

The monorepo is using [Turborepo](https://turborepo.org/) and [pnpm workspaces](https://pnpm.io/workspaces) to link packages together.

Packages:

- [./apps/ipdm](./apps/ipdm): Frontend written with Preact, Vite, Tailwind, Typescript
- [./packages/client](./packages/client): Exports UI components that use TypeScript and Tailwind CSS and is compiled by SWC.

## Dev

Next, run `app` in development mode:

```bash
pnpm dev
```

The app should be up and running at http://localhost:3000.
