# Demo recording

Use a fresh temporary browser profile, one tab, and a clean 1920×1080 full browser window. Hide the bookmarks bar and verify the top 140 pixels of the first full capture. If required to use the no-sandbox flag, pair it with test-type and verify that the toolbar has no banner or tint.

| Time | On screen |
| --- | --- |
| 0:00–0:15 | Open on both Testnet channels showing CHANNEL_READY. |
| 0:15–0:40 | Show the four seller products, generate invoices, and copy the offer JSON with its clear preview fields. |
| 0:40–1:05 | Paste and validate the catalogue. Scroll slowly across the four previews. |
| 1:05–1:20 | Try the wrong key on the first card and show the rejection. |
| 1:20–1:45 | Pay for Harbor. Pause on the receipt and show the rendered palette, type, spacing, and components. |
| 1:45–2:10 | Pay for the PRD template. Show its receipt and unlocked spec. |
| 2:10–2:30 | Show the two unlocked and two locked cards. Scroll through the end of Harbor's components and stop. |

Record one continuous Testnet take with the cursor visible at 1920×1080, 30 fps. Restart if a beat fails. Keep only browser and app UI in frame. Export below 50 MB without audio, overlays, or transitions.

```sh
ffmpeg -i raw.webm -an -c:v libx264 -crf 24 -preset medium -pix_fmt yuv420p -movflags +faststart docs/design-spec-shop-demo.mp4
```