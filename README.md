# BLUFF BALLOON

A real-time multiplayer party game built with React, Vite, Tailwind CSS, Express, and Socket.IO. No Firebase, API keys, or environment configuration required.

## Run locally

Requires Node.js 20 or newer.

```sh
npm install
npm run dev
```

Open the Vite URL on your computer. For a phone on the same Wi-Fi, use the Network URL printed by Vite. Both the Vite dev server and Socket.IO server start together; Vite proxies Socket.IO connections to port 3000.

## Instant testing tunnel

```sh
npm start
npm run tunnel
```

The tunnel forwards public HTTPS traffic to port 3000 and supports Socket.IO WebSockets. The requested `bluff-balloon-game.loca.lt` subdomain may already be in use; localtunnel will report the URL it actually assigns.

## Deploy to Render

Deploy to render.com: Connect the GitHub repo, Render will auto-detect Node, deploy gives public https link with WebSocket support.

The supplied `render.yaml` defines a free Node web service with build command `npm install && npm run build`, start command `npm start`, and `PORT=10000`. The Node server listens on the host-provided `PORT`. The `Dockerfile` is also available for Docker based hosts.

## Production hosting details

The Node server serves the built `dist/` frontend and Socket.IO from one origin. Room state is held in memory, so use one server instance; rooms disappear when the process restarts and do not synchronize across multiple instances.

## Game play

Create a room and share the four-character code. Rooms support 3–8 human players; a solo host gets three bots. Each pump adds one shared balloon size and 10 points. Popping on your pump costs 50 points and starts the 15-second vote. The secret Impostor can pop anonymously. Votes resolve the round, and a player reaching 300 points wins the match.
