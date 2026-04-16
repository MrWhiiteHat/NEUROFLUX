# Optimization and Render Efficiency Guide

This section is mandatory for reliable output on different hardware tiers.

## 8GB VRAM strategy

1. Use SD 1.5 realistic base model for stage clip generation.
2. Keep resolution between 576x1024 and 640x1136.
3. Use batch size 1 and short stage segments.
4. Enable VAE tiling and attention slicing.
5. Disable non-critical controls:
   - disable extra ControlNet passes first
   - lower particle-heavy stage duration by 10 to 15 percent if needed
6. Render stage 04 collision in two passes:
   - base motion pass
   - VFX enhancement pass

## Faster rendering strategy

1. Reuse the same prompt skeleton for all stages.
2. Only replace stage action tokens.
3. Cache stage 01 identity reference and never regenerate unless drift appears.
4. Use lower step count for early drafts:
   - image steps: 14 to 18
   - video steps: 12 to 16
5. Approve motion first, then increase steps only for final pass.
6. Run interpolation only on approved clip versions.

## Prompt reuse strategy

Use a three-layer prompt architecture:

- Layer A: immutable identity and environment tokens
- Layer B: stage action tokens
- Layer C: VFX intensity tokens

This avoids full prompt rewrites and improves continuity.

## Render pass strategy

- Pass 1: identity and blocking
- Pass 2: motion and stage continuity
- Pass 3: energy VFX enhancement
- Pass 4: final grade and delivery

## Quality guardrails

- Keep CFG under 7.0 for most stages to reduce artifact risk.
- Keep denoise between 0.35 and 0.55 during stage continuity.
- Avoid changing checkpoint mid-sequence.

## Retry minimization

- Retry only failed stage, not entire sequence.
- Keep same seed for first retry and only adjust denoise by plus or minus 0.03.
- If face drift persists, re-run with stronger FaceID weight and lower motion strength.
