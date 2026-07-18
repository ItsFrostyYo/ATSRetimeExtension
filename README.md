# SNRetimeExtension

SNRetimeExtension is a frame-accurate speedrun retiming extension for YouTube,
Twitch, Speedrun.com embeds, and most standard HTML5 video players.

The project has one shared source tree and produces separate Chrome and Firefox
packages. Browser-specific settings live in `manifests/`; extension code and
assets are shared.

## Build

Requirements: Node.js (for syntax checks) and Windows PowerShell 5.1 or newer.

```powershell
npm run check
npm run build
```

The build creates:

- `dist/chrome/` and `release/SNRetimeExtension-chrome-v<version>.zip`
- `dist/firefox/` and `release/SNRetimeExtension-firefox-v<version>.zip`

Build only one browser with `npm run build:chrome` or
`npm run build:firefox`. Update the version in both `manifest.base.json` and
`package.json` before publishing a new release.

## Install for development

Build first, then load the browser-specific output:

### Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose `dist/chrome`.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Select **Load Temporary Add-on**.
3. Choose `dist/firefox/manifest.json`.

The Firefox ZIP contains a stable Gecko extension ID for signing and declares
that the extension does not collect or transmit user data.

## Use

1. Open a run video and enable SNR for the current tab from the extension popup.
2. Step to the exact first frame and select **Confirm Start**.
3. Step to the exact final frame and select **Confirm End**.
4. Use **Pause Time** / **Unpause Time** around load screens when required.
5. Read the final **RTA** and **IGT/LRT** values.

The editor can redo, disable, or delete load removals. Saved retimes can be
exported to or imported from a JSON backup.

## Repository layout

- `src/`: shared background, content, and popup code
- `assets/`: shared font and extension icons
- `manifest.base.json`: shared extension manifest fields
- `manifests/`: Chrome and Firefox manifest overlays
- `scripts/build.ps1`: repeatable browser packaging
- `dist/`: generated unpacked extensions
- `release/`: generated browser-specific ZIP releases

`Jerrins-Retiming-Tool-main` is retained beside this project as a reference
implementation; it is not copied into either browser release.
