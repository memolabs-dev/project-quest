#!/usr/bin/env bash
# Regenerates every 3D asset from the Blender scripts, then compresses them for the browser.
set -euo pipefail
cd "$(dirname "$0")/.."
BLENDER="${BLENDER:-blender}"
"$BLENDER" --background --factory-startup --python scripts/blender/site_kit.py -- public/models/site-kit.raw.glb
npx gltf-transform optimize public/models/site-kit.raw.glb public/models/site-kit.glb --compress meshopt --texture-compress false --join false --flatten false --palette false --simplify false
rm public/models/site-kit.raw.glb
