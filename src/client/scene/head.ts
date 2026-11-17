// A head turned toward the foreman on top of the animation. A clip whose head track never changes is not rewritten
// by the mixer each frame (three only writes changed values), so adding to the bone would add up frame after frame:
// the head goes back to this frame's pose before the mixer runs, and the turn is applied once after it.
import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);

export function headTurn(head: THREE.Object3D) {
  const pose = head.quaternion.clone();
  const turn = new THREE.Quaternion();
  return {
    /** Before the mixer: the head as the animation left it, without last frame's turn. */
    restore() { head.quaternion.copy(pose); },
    /** After the mixer: keep its pose, then turn the head by `yaw` around the vertical. */
    apply(yaw: number) {
      pose.copy(head.quaternion);
      head.quaternion.premultiply(turn.setFromAxisAngle(UP, yaw));
    },
  };
}
