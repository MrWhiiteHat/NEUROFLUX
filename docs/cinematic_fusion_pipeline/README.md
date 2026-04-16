# NeuroFlux Cinematic Vertical Video Pipeline

This document package defines a complete reusable AI pipeline to generate a 9:16 cinematic short video for the concept:

Fire and Ice Energy Fusion in Human Hands

The system is modular. Each stage can be generated independently, then assembled into a single final reel.

## Deliverables in this package

1. Scene breakdown with 5 cinematic stages and prompts
2. Character locking strategy (face, seed, reference, LoRA)
3. VFX design spec for fire, ice, and interaction
4. Temporal plan for 5 to 8 seconds
5. Toolchain execution details:
   - ComfyUI node flow
   - Stable Diffusion with AnimateDiff settings
   - Runway, Pika, and Sora shot prompts
6. Final assembly workflow for 9:16 output
7. Optional Instagram overlay strategy
8. Low VRAM and fast render optimization profile

## Package structure

- docs/cinematic_fusion_pipeline/scene_stages.yaml
- docs/cinematic_fusion_pipeline/character_locking.yaml
- docs/cinematic_fusion_pipeline/vfx_design.yaml
- docs/cinematic_fusion_pipeline/temporal_pipeline.md
- docs/cinematic_fusion_pipeline/toolchain/comfyui_node_flow.md
- docs/cinematic_fusion_pipeline/toolchain/sd_animatediff_settings.yaml
- docs/cinematic_fusion_pipeline/toolchain/runway_pika_sora_prompts.yaml
- docs/cinematic_fusion_pipeline/assembly/final_video_assembly.md
- docs/cinematic_fusion_pipeline/assembly/assemble_vertical_reel.bat
- docs/cinematic_fusion_pipeline/overlay/instagram_overlay.md
- docs/cinematic_fusion_pipeline/optimization.md
- docs/cinematic_fusion_pipeline/prompt_reuse_template.yaml

## Quick execution order

1. Generate stage keyframes from scene_stages.yaml image prompts.
2. Lock face and identity using character_locking.yaml.
3. Generate stage clips with AnimateDiff or Runway or Pika based on stage prompts.
4. Apply VFX profile from vfx_design.yaml.
5. Follow temporal timing from temporal_pipeline.md.
6. Assemble clips into one vertical reel with final_video_assembly.md.
7. Optionally overlay UI elements from instagram_overlay.md.

## Quality profiles

### Quality profile (best visual quality)

- Resolution: 832x1472 or 1024x1792
- Steps: 28 to 40
- Sampler: DPM++ 2M Karras
- CFG: 6.0 to 7.5
- Motion interpolation: on
- Temporal consistency: high

### Fast profile

- Resolution: 768x1344
- Steps: 18 to 24
- Sampler: Euler a or DPM++ SDE Karras
- CFG: 5.5 to 6.5
- Motion interpolation: medium

### 8GB VRAM profile

- Base model: SD 1.5 realistic checkpoint or SDXL in tiled mode
- Resolution: 576x1024 or 640x1136
- Steps: 14 to 20
- CFG: 5.0 to 6.0
- VAE tiling and attention slicing enabled
- Batch size: 1
- Generate per-stage clips in short segments, then stitch

## Success criteria checklist

- Same person across all 5 stages
- Same location and camera lens behavior
- Fire stays warm orange and ice stays cool cyan
- Collision creates steam and light blending
- Final stage forms a heart-shaped fusion
- Total timeline remains between 5 and 8 seconds
- Final output is vertical 9:16
