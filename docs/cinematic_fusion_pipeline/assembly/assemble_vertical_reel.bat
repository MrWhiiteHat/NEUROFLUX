@echo off
setlocal

REM Requires ffmpeg in PATH
REM Input files expected in current folder:
REM stage_01_clip.mp4 ... stage_05_clip.mp4

ffmpeg ^
-i stage_01_clip.mp4 ^
-i stage_02_clip.mp4 ^
-i stage_03_clip.mp4 ^
-i stage_04_clip.mp4 ^
-i stage_05_clip.mp4 ^
-filter_complex "[0:v]fps=24,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[v0];^n[1:v]fps=24,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[v1];^n[2:v]fps=24,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[v2];^n[3:v]fps=24,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[v3];^n[4:v]fps=24,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[v4];^n[v0][v1]xfade=transition=fade:duration=0.22:offset=0.92[x1];^n[x1][v2]xfade=transition=fade:duration=0.24:offset=1.92[x2];^n[x2][v3]xfade=transition=fadeblack:duration=0.16:offset=3.12[x3];^n[x3][v4]xfade=transition=fade:duration=0.3:offset=4.45[x4];^n[x4]eq=contrast=1.08:saturation=1.08:brightness=-0.01,curves=all='0/0 0.30/0.24 0.75/0.83 1/1',colorbalance=rs=0.06:gs=-0.01:bs=-0.04:rm=0.04:gm=0.01:bm=-0.03:rh=0.03:gh=0.02:bh=-0.02,unsharp=5:5:0.5:5:5:0.0[vout]" ^
-map "[vout]" ^
-c:v libx264 -profile:v high -pix_fmt yuv420p -r 24 -b:v 12M -maxrate 16M -bufsize 24M ^
-movflags +faststart ^
out_fire_ice_fusion_reel.mp4

if %errorlevel% neq 0 (
  echo Assembly failed.
  exit /b 1
)

echo Assembly completed: out_fire_ice_fusion_reel.mp4
endlocal
