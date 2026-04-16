# Temporal Pipeline for 5 to 8 Second Vertical Cinematic Sequence

## Target timeline

Total target length: 6.6 seconds
Allowed range: 5.0 to 8.0 seconds
Frame rate target: 24 fps
Total target frames: 158

## Stage timing map

1. Stage 01 Idle Stance: 0.0 to 1.1 sec
2. Stage 02 Energy Ignition: 1.1 to 2.2 sec
3. Stage 03 Energy Growth: 2.2 to 3.6 sec
4. Stage 04 Energy Collision: 3.6 to 4.8 sec
5. Stage 05 Final Fusion Heart: 4.8 to 6.6 sec

## Continuity transitions

- Stage 01 to 02: 6-frame luminance rise and hand glow pre-roll
- Stage 02 to 03: 8-frame additive particle bridge
- Stage 03 to 04: 4-frame acceleration with camera push
- Stage 04 to 05: 10-frame collision flash decay into heart silhouette

## Intensity curve

- Stage 01 baseline intensity: 0.08
- Stage 02 ignition intensity: 0.35
- Stage 03 growth intensity: 0.80
- Stage 04 collision peak intensity: 1.00
- Stage 05 fusion settle intensity: 0.72 with heartbeat pulses

## Camera choreography

- Stage 01: slow dolly in
- Stage 02: subtle handheld micro-jitter
- Stage 03: slow push with mild upward tilt
- Stage 04: brief impact zoom and shake impulse
- Stage 05: gentle settle and minimal orbit around fusion heart

## Frame evolution rule

Each stage is independently generatable, but continuity should be preserved using this handoff method:

1. Export final frame of current stage as next-stage init image.
2. Keep same seed family and reference conditioning.
3. Keep denoise in continuity-safe range for stage-to-stage img2img:
   - 0.35 to 0.55
4. Keep subject and environment anchors unchanged.

## Smoothness controls

- Enable frame interpolation x2 only after base clips are approved.
- Use optical flow smoothing only where limb artifacts do not appear.
- Avoid over-smoothing collision flash to preserve dramatic impact.

## Editing checkpoints

- 24 fps review pass for timing
- color continuity pass at stage boundaries
- face identity pass at first and last frame of each stage
- VFX pass for steam and bloom clipping
