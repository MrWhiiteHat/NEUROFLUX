# Final Video Assembly Guide

Goal: build one final Instagram-ready 9:16 reel with cinematic transitions and color grade.

## Inputs

- stage_01_clip.mp4
- stage_02_clip.mp4
- stage_03_clip.mp4
- stage_04_clip.mp4
- stage_05_clip.mp4

## Output target

- Resolution: 1080 x 1920
- Frame rate: 24 fps
- Duration: 5 to 8 seconds
- Codec: H.264 high profile
- Color style: teal-orange cinematic with controlled highlights

## Edit order

1. place clips in stage order
2. trim each clip to timing in temporal_pipeline.md
3. apply transitions:
   - cross dissolve 6 to 10 frames for calm transitions
   - flash transition around collision to fusion handoff
4. enforce visual continuity:
   - same white balance and exposure baseline
   - no sudden gamma jumps

## Color grading recipe

- global contrast: medium high
- shadows: slight teal push
- highlights: warm orange push
- saturation: moderate, protect skin tones
- bloom/glow: increase around energy only

## Final polish

- subtle film grain, strength low
- bloom safety clamp to avoid clipped whites
- optional vignette for dramatic center focus
- optional sharpen pass after resizing to 1080x1920

## Export settings

- container: mp4
- video bitrate: 10 to 16 Mbps
- audio: optional cinematic low-frequency pulse
- keyframe interval: 48

## QC checklist before publish

- no face identity drift in stage cuts
- hand anatomy stable and realistic
- fire and ice colors stay distinguishable
- heart shape clearly visible in final stage
- no text artifacts or watermarks
