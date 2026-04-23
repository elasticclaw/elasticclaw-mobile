# ElasticClaw Mobile

React Native (Expo) app for connecting to an [ElasticClaw](https://github.com/elasticclaw/elasticclaw) hub from iOS or Android.

## Features

- Login with your hub URL + UI password
- Claws list with real-time status, last-message preview, pin/unpin
- Chat with streaming markdown responses
- Spawn new claws from templates pushed to your hub
- Claw detail sheet — rename, recolor, edit tags, new session, kill
- Long-press any message to copy (native haptics + toast)
- Settings — LLM keys, Replicated/Daytona providers, SSH public keys, UI password, sign out

## Requirements

- **Node.js 20+** and **npm**
- **Expo SDK 54** (installed automatically via `npm install`)
- A running ElasticClaw hub you can reach over the network (local or prod)
- For on-device testing:
  - **iOS**: macOS with Xcode 15+, an iPhone with Developer Mode enabled, and an Apple ID signed in to Xcode
  - **Android**: Android Studio or a device with USB debugging enabled
  - **OR** [Expo Go](https://expo.dev/client) installed on the phone (fastest path, no native build required)

## Quick start (Expo Go)

The fastest way to try the app. No native build needed.

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with **Expo Go** (iOS Camera or the Expo Go app on Android). The app will download the JS bundle and launch.

On the login screen, enter:
- **Hub URL** — e.g. `http://192.168.x.x:8080` (your Mac's LAN IP, not `localhost`, when running a local hub) or `https://hub.yourdomain.com` (a prod hub)
- **Password** — the hub's `ui_password` (set in `~/.elasticclaw/hub.yaml` or via `--ui-token` when starting the hub)

### Network issues

If the phone can't reach Metro:

```bash
npx expo start --tunnel   # routes through ngrok, bypasses LAN/firewall issues
```

If hot reload gets stuck:

```bash
npx expo start --clear    # wipes Metro cache
```

## Native dev build (run on-device without Expo Go)

Needed if you want a standalone build on your phone, or if you've added native modules that aren't in Expo Go.

### iOS

```bash
cd mobile
npx expo run:ios --device
```

Expo will:
1. Run prebuild (generates `ios/` from `app.json`)
2. Install CocoaPods (~5 min first time)
3. Build and install the app on your selected iPhone

**Prerequisites:**
- iPhone plugged in via USB, unlocked, trusted
- **Developer Mode enabled**: Settings → Privacy & Security → Developer Mode → ON (requires restart)
- Apple ID signed in: Xcode → Settings → Accounts (a free personal team is fine)

After the first build, you can keep the installed app and just run `npx expo start` on your Mac — the app will connect to Metro for JS hot reload. A full rebuild is only required when native modules change.

### Android

```bash
cd mobile
npx expo run:android --device
```

Prerequisites: Android Studio installed, device with USB debugging enabled.

## Project layout

```
mobile/
├── app/                     # expo-router file-based routes
│   ├── _layout.tsx          # root layout, loads token/hub URL from SecureStore
│   ├── (auth)/login.tsx     # login screen
│   └── (app)/
│       ├── _layout.tsx      # HubProvider wrapper
│       ├── index.tsx        # claws list
│       ├── settings.tsx     # settings screen
│       └── chat/[clawId].tsx
├── components/              # ClawListItem, MessageBubble, ChatInput, etc.
├── hooks/
│   ├── use-hub.ts           # central REST + WebSocket state
│   └── use-typewriter.ts    # streaming chunk animation
├── context/
│   └── HubContext.tsx       # shares useHub across screens
├── lib/
│   ├── api.ts               # REST client
│   ├── storage.ts           # expo-secure-store (token, hub URL) + AsyncStorage (cache)
│   ├── theme.ts             # design tokens
│   ├── types.ts             # shared Claw/Message types (mirrors the hub API)
│   └── mappers.ts           # API → UI type mappers
├── app.json                 # Expo config
├── babel.config.js          # nativewind preset
└── metro.config.js          # withNativeWind wrapper
```

## Authentication

The mobile app uses the same password-based flow as the web UI:

1. App opens → `app/_layout.tsx` reads token + hub URL from `expo-secure-store`
2. If no token → navigates to `/(auth)/login`
3. Login POSTs `{ password }` to `<hubUrl>/api/auth/login`, receives `{ hubToken }`
4. Token is stored in `expo-secure-store` (encrypted) — message cache and pinned state go to `AsyncStorage` (unencrypted)
5. All subsequent API calls use `Authorization: Bearer <token>`
6. WebSocket connection uses `ws://<hub>/api/ws?token=<token>` for live updates

## Running against a local hub

In one terminal, start the hub (from inside a clone of the main [elasticclaw](https://github.com/elasticclaw/elasticclaw) repo):

```bash
make build
./bin/elasticclaw hub --token dev-token --claw-token dev-claw --ui-token admin
```

In another terminal, start Metro:

```bash
cd mobile
npx expo start
```

On the login screen, enter `http://<your-mac-LAN-IP>:8080` and password `admin`. **Do not use `localhost`** from the phone — the phone needs your Mac's LAN IP (e.g. `http://192.168.1.5:8080`).

To find your LAN IP: `ipconfig getifaddr en0` on macOS.

## Running against a prod hub

Just enter your prod URL on the login screen:

```
https://elasticclaw.yourdomain.com
```

And the UI password you set during `elasticclaw install`.

## Common commands

```bash
npx expo start              # start Metro (default — LAN mode)
npx expo start --tunnel     # start Metro through ngrok (fixes firewall issues)
npx expo start --clear      # clear Metro cache
npx expo run:ios --device   # native iOS build on connected device
npx expo run:android        # native Android build
npx expo export --platform ios  # verify the JS bundle compiles (no device needed)
```

## Troubleshooting

**"Timed out waiting for all destinations…"** when building iOS — Developer Mode is off on the phone. Settings → Privacy & Security → Developer Mode → ON → restart.

**"Cannot find module 'react-native-worklets/plugin'"** — pure JS dependency issue. Run `npm install --legacy-peer-deps`.

**Phone can't reach Metro** — use `npx expo start --tunnel` or make sure phone and Mac are on the same WiFi network with no VPN.

**WebSocket keeps disconnecting** — check the hub is reachable (try the URL in a browser) and that your hub's `hub.yaml` has both `token` and `ui_password` set. See the main [elasticclaw](https://github.com/elasticclaw/elasticclaw) repo for hub-side issues.

**Tailwind classes not applying** — NativeWind is configured via `metro.config.js` with `withNativeWind`. Styling is done with `StyleSheet.create` in this project for reliability; NativeWind is available but used sparingly.
