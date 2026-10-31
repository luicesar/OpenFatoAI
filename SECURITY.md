# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Use GitHub's private reporting: go to the repository's **Security** tab → **Report a vulnerability**. Include what you found, how to reproduce it, and the version affected.

You can expect an acknowledgement within a few days. Fixes are released as soon as practical and credited to the reporter unless you prefer otherwise.

## Supported versions

Only the latest release receives security fixes.

## What to keep in mind

- API keys are stored with Electron `safeStorage` (encrypted at rest). Never paste real keys into issues or logs.
- The renderer runs with `contextIsolation: true` and `nodeIntegration: false`; all privileged work goes through the IPC handlers in `src/main/ipc/`. Reports about bypassing that boundary are especially welcome.
