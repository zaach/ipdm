# IPDM

The goal is to create a decentralized whatsapp.

Distinguished properties we'd want to support:

- Private: authenticated and end-to-end encrypted
- Asynchronous: conversations can be created and progress without both parties being online
- Deniable: a leaked transcript doesn't provide proof of who authored the messages
- Forward and future secure: leaked credentials can't reveal an entire conversation
- --All of the above for group chats-- (stretch goal)

The initial version is a port of an [existing chat application](https://github.com/zaach/5edm) that is synchronous, end-to-end encrypted, and ephemeral (no static keys). This initial experience, while admittedly limitted, offers a working end-to-end prototype with interfaces and affordances that can be iterated upon.

## Roadmap

- [Finish port of 5EDM](https://github.com/zaach/ipdm/milestone/5)
- [Attachments](https://github.com/zaach/ipdm/milestone/1)
- [Asynchronicity](https://github.com/zaach/ipdm/milestone/2)
- [Authentication](https://github.com/zaach/ipdm/milestone/3)
- [Production Deploy](https://github.com/zaach/ipdm/milestone/6)
- [Full p2p](https://github.com/zaach/ipdm/milestone/4)
- Groups?

## Monorepo

The monorepo is using [Turborepo](https://turborepo.org/) and [pnpm workspaces](https://pnpm.io/workspaces) to link packages together.

Packages:

- [./apps/ipdm](./apps/ipdm): UI, app frontend built with Vite, Preact, Tailwind CSS
- [./packages/client](./packages/client): Chat client package
- [./packages/relay](./packages/relay): Libp2p dev relay server

## Setup

```bash
pnpm install
turbo build
```

## Dev

Next, run `app` in development mode:

```bash
pnpm dev
```

The app should be up and running at http://localhost:5173.
