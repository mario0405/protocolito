# Protocolito Architecture

Protocolito is an Electron desktop app with a Vite, React, TypeScript, and Tailwind renderer.

## Main Process

- `electron/main.js` owns the Electron window lifecycle and IPC bridge registration.
- `electron/preload.js` exposes the minimal renderer bridge.
- `electron/backend/commands.js` is the command registry. Keep it as routing glue only.
- `electron/backend/config.js` owns defaults and normalization for persisted settings.
- `electron/backend/infomaniak.js` owns Infomaniak owner config, endpoints, and transcription calls.
- `electron/backend/summary.js` owns summary generation and fallback summary formatting.
- `electron/backend/database.js` and `electron/backend/json-store.js` own local persistence.

## Renderer

- `src/app` contains route-level screens.
- `src/components/ui` contains primitive UI controls.
- `src/components/settings` contains reusable settings controls.
- `src/components` contains feature components.
- `src/contexts` contains cross-screen app state.
- `src/hooks` contains workflow-level state machines and effects.
- `src/services` contains renderer-to-backend API wrappers.
- `src/types` contains shared TypeScript contracts.
- `src/constants` contains static options and fallback lists.

## Infomaniak Cloud Models

Users select only model names in the UI. Credentials are owner-managed through:

- `PROTOCOLITO_INFOMANIAK_PRODUCT_ID`
- `PROTOCOLITO_INFOMANIAK_API_KEY`
- `PROTOCOLITO_INFOMANIAK_TRANSCRIPTION_MODELS`
- `PROTOCOLITO_INFOMANIAK_SUMMARY_MODELS`
- `PROTOCOLITO_INFOMANIAK_CONFIG`
- `infomaniak.config.json` beside `Protocolito.exe`

Do not save Infomaniak credentials in user settings. User settings should store selected models only.

## Verification

Use these commands after behavior changes:

```powershell
npm run lint
npm run build
npx electron-builder --dir --publish never
npm run qa:packaged:infomaniak
npm run qa:packaged:settings
```

The packaged QA scripts launch `dist\win-unpacked\Protocolito.exe` with remote debugging and run browser-level workflows against the real desktop app.
