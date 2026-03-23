# Assembly-TimeSharp (ATS)

Assembly-TimeSharp is a browser retiming extension made for frame-accurate speedrun timing on video runs.

## What It Works On

- YouTube
- Twitch
- Embedded video pages (including sites like speedrun.com when the run is embedded)
- Most pages with a normal HTML5 video player

## Install (Load Unpacked)

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `ATS Retime Tool`.
5. Click the ATS extension icon and press **Enable** on the current tab.

## How To Use

1. Open your run video.
2. Enable ATS from the extension popup on that tab.
3. Use frame step or play/pause to reach exact frames.
4. Press **Confirm Start** at the start frame.
5. Press **Confirm End** at the end frame.
6. If needed, use **Pause Time** / **Unpause Time** around load screens.
7. Read final values from **RTA** and **IGT/LRT**.

## Main Controls

- `←` and `→`: step one frame backward/forward
- `Play/Pause`: toggle playback
- `Speed`: playback speed selector
- `FPS`: auto or manual FPS mode
- `Confirm Start` / `Undo Start`
- `Confirm End` / `Undo End`
- `Pause Time` / `Unpause Time`
- `Open Editor`: manage load removals

## Timing Outputs

- **Start**: confirmed start time and frame
- **End**: confirmed end time and frame
- **RTA**: real time between start and end
- **IGT/LRT**: RTA minus enabled load removals

## Pause Time Editor

Each removal entry shows:

- Start frame
- End frame
- Removed duration

Actions per entry:

- **Redo**: jump back and redo that removal
- **Remove/Add Back**: temporarily disable/enable that removal in final time
- **Delete**: permanently remove that entry
- **Reset All**: clear all current timing data and restart

## Mod Note

After confirming end, ATS generates a mod note box with:

- `Mod Note: Retimed to ... RTA`
- If load removal is used, it also includes `IGT` or `LRT`

You can copy, hide, or re-open the mod note panel.

## Saving / Backup

- **Save Current Site Retime** saves the current video/site retime into ATS saved data.
- **Export Saved Retimes File** exports all saved retimes into one JSON backup file.
- **Import Saved Retimes File** imports and merges saved retimes from a JSON file.
