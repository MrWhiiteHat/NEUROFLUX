# ComfyUI Node Flow Specification

This is an exact modular flow for per-stage generation and continuity.

## A. Stage Keyframe Generator (SDXL Image)

Node order:

1. Load Checkpoint
   - model: juggernautXL_v9.safetensors
   - clip: from checkpoint
   - vae: from checkpoint or sdxl_vae_fp16_fix

2. CLIP Text Encode Positive
   - prompt: stage image prompt from scene_stages.yaml

3. CLIP Text Encode Negative
   - prompt: global negative prompt from scene_stages.yaml

4. Empty Latent Image
   - width: 832
   - height: 1472
   - batch: 1

5. KSampler
   - sampler: dpmpp_2m
   - scheduler: karras
   - steps: 32
   - cfg: 6.8
   - denoise: 1.0
   - seed: base seed plus stage offset

6. VAE Decode

7. Save Image
   - filename prefix: stage_0X_keyframe

## B. Stage Animation Generator (AnimateDiff with continuity)

Node order:

1. Load Checkpoint
   - model: realisticVisionV60B1_v51HyperVAE.safetensors

2. Load AnimateDiff Motion Module
   - motion_module: mm_sd_v15_v2.ckpt

3. Load IP-Adapter Face or InstantID
   - reference image: stage_01 final frame
   - weight: 0.9

4. Load ControlNet OpenPose or SoftEdge (optional)
   - source: previous stage final frame or pose map
   - weight: 0.45 to 0.65

5. CLIP Text Encode Positive
   - prompt: stage video prompt from scene_stages.yaml

6. CLIP Text Encode Negative
   - prompt: global negative prompt

7. Load Init Image for Continuity
   - source: previous stage final frame

8. VAE Encode

9. KSampler (img2img temporal)
   - sampler: dpmpp_sde
   - scheduler: karras
   - steps: 22
   - cfg: 6.0
   - denoise: 0.42
   - seed: fixed per stage

10. AnimateDiff Sampler Settings
    - context length: 16
    - context stride: 4
    - overlap: 4
    - frame_count: stage_duration_seconds * 24
    - fps: 24

11. VAE Decode

12. Save Video
    - filename prefix: stage_0X_clip

## C. Low VRAM 8GB variant

- use SD 1.5 checkpoint only
- resolution: 576 x 1024
- steps: 16
- cfg: 5.5
- denoise: 0.38
- context length: 12
- disable ControlNet if memory pressure occurs
- enable tiled VAE decode

## D. Validation checklist

- no face drift compared to stage 01
- fire remains in right hand, ice remains in left hand until collision
- collision stage includes steam and shockwave
- final stage clearly resolves to heart-shaped fusion
