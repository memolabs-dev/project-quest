// Soft ambient occlusion and filmic tone mapping: the "model on a table" look under the comic-strip outlines, and the
// light miniature effect (tilt-shift), which the settings can switch off and a weak machine gives up last.
import { EffectComposer, N8AO, TiltShift2, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

export function Effects({ aoHalf, tiltShift }: { aoHalf: boolean; tiltShift: boolean }) {
  return (
    <EffectComposer multisampling={4}>
      <N8AO aoRadius={0.8} intensity={1.2} distanceFalloff={0.5} quality="medium" halfRes={aoHalf} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      {/* A light blur above and below a band just under the middle, where the player and the yards stand. */}
      {tiltShift ? <TiltShift2 blur={0.1} taper={0.4} start={[0, 0.45]} end={[1, 0.45]} /> : <></>}
      <Vignette offset={0.3} darkness={0.35} />
    </EffectComposer>
  );
}
