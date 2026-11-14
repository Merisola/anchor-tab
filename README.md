# The Anchor Tab

A calm, personal new-tab page for Chrome, Edge, Brave, and Opera. It keeps your
day anchored to a few priorities instead of a wall of distractions: a focus
timer, three moves, a backlog, an Ethiopian date, and an optional local MCP
bridge that lets AI clients read and update the page.

![Manifest](https://img.shields.io/badge/manifest-v3-blue)
![Version](https://img.shields.io/badge/version-2.0.0-green)

## Features

- **Focus timer** with a daily target and a leave guard while a session runs.
- **Three moves** for the day, plus a backlog you can promote from.
- **Bookmarks and launchpad** with labels, categories, and import support.
- **Ethiopian date** and a quiet, themeable layout.
- **Google Drive backup** using the narrow `drive.appdata` scope.
- **MCP bridge** for Claude, Gemini CLI, ChatGPT web, and generic MCP clients.
- **Collapsible settings** with deep links such as `settings.html#vault` and
  `settings.html#launchpad`.

## Tech stack

- React 19 + TypeScript
- Vite 7
- Tailwind CSS
- Chrome Manifest V3
- Zero-dependency Node.js helper for MCP (`app/public/helper/anchor-mcp-server.mjs`)

## Repository layout

```text
app/
  public/                  manifest, icons, MCP helper
  src/                     React + TypeScript source
    newtab/                new-tab page
    settings/              settings page and collapsible sections
    launchpad/             launchpad page
    field-manager/         custom field editor
    state/                 storage and runtime stores
    styles/                CSS
  *.html                   Vite entry points
  package.json
.gitignore
README.md
```

`app/` is the source of truth. Older v1 files at the repository root and in
`anchor-extension/` are local-only legacy builds and are ignored by Git.

## Requirements

- Node.js 20.19+ (or 22.12+) for the Vite build
- Node.js 18+ for the MCP helper
- npm
- Chrome, Edge, Brave, or another Chromium browser

## Build and load

```powershell
cd app
npm ci
npm run build
```

The build runs `tsc --noEmit` and writes the extension to `app/dist`.

1. Open `chrome://extensions` (Edge: `edge://extensions`, Brave:
   `brave://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select `app/dist`.
4. Open a new tab.

After changing source files, run `npm run build` again and press the reload
button on the extension card. For live UI work, `npm run dev` serves the pages
at `http://localhost:5173/newtab.html`, but extension APIs such as bookmarks and
storage behave differently outside the loaded extension.

## Configuration

Open the extension's Settings page. Each main card starts collapsed and can be
opened independently:

- **Make the page fit you**
- **Your direction, kept close**
- **Bookmarks, labels, and categories**
- **Make the day workable**
- **Look and feel**
- **Tools and backups**

Settings are stored in `chrome.storage.local`. Deep links expand the target
section before scrolling, for example `settings.html#vault`.

### MCP bridge

The helper is `app/public/helper/anchor-mcp-server.mjs` (also copied to
`app/dist/helper/` by the build). It connects an MCP client to the open Anchor
Tab page, so keep the page open while a client is connected.

| Session | Transport | Default port |
| --- | --- | --- |
| Claude | stdio | 7777 |
| Gemini CLI | stdio | 7778 |
| ChatGPT web | HTTP | 7779 |
| Generic MCP | stdio | 7780 |

For stdio clients, the generated config runs:

```text
node C:\path\to\anchor-mcp-server.mjs
```

with these environment variables:

```text
ANCHOR_TOKEN=<token from the session card>
ANCHOR_PORT=<session port>
ANCHOR_CLIENT=claude | gemini | chatgpt | generic
```

For the HTTP session (ChatGPT web), start the helper with
`ANCHOR_TRANSPORT=http`, expose `127.0.0.1:7779` through an HTTPS tunnel, and
register the generated connector URL in ChatGPT. See
`app/public/helper/README.txt` for the full commands and the health check.

## Security

The helper never ships with a token, and no secret belongs in this repository.

- **Tokens live in the environment.** Set `ANCHOR_TOKEN` in the client's MCP
  config or shell. Never paste it into source, an issue, a screenshot, a commit,
  or this README.
- **`.gitignore` already excludes** `.env*`, `*.token`, `*.secret`,
  `secrets/`, `claude_desktop_config.json`, `.claude/`, private keys, and build
  output. Verify with `git status` before every commit.
- **The helper binds to `127.0.0.1` only.** A tunnel deliberately exposes one
  session to the internet. Treat the tunnel hostname and path token as secrets,
  use HTTPS, and stop the tunnel when you are finished.
- **Least privilege.** Enable only the sessions and scopes you need. Rotate a
  token with **New token** if it is ever exposed, then update that client's
  config.
- **If a token was committed,** rotate it immediately and purge it from history
  (for example with `git filter-repo`) before pushing.
- **Google Drive backup** requests only `https://www.googleapis.com/auth/drive.appdata`,
  which limits access to the app's hidden data folder.

## Troubleshooting

- **Blank page after a build:** confirm you loaded `app/dist`, not `app/`, and
  that `manifest.json` is at the root of the loaded folder.
- **Settings look stale:** press the reload button on the extension card.
- **MCP client cannot connect:** confirm the Anchor Tab page is open,
  **Allow AI to connect** is on, the port matches the session card, and the token
  in the client config is current.
- **Port already in use:** another helper may be running. Use the session's
  configured port or stop the old process.
- **A `beforeunload` warning in the console** is the browser's own leave-guard
  message and is expected.

## License

No license has been specified for this project. All rights reserved unless a
license is added.
