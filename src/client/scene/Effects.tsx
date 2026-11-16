// Soft ambient occlusion and filmic tone mapping: the "model on a table" look under the comic-strip outlines.
import { EffectComposer, N8AO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

export function Effects() {
  return (
    <EffectComposer multisampling={4}>
      <N8AO aoRadius={0.8} intensity={1.2} distanceFalloff={0.5} quality="medium" />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette offset={0.3} darkness={0.35} />
    </EffectComposer>
  );
}
