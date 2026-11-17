import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { headTurn } from "./head.ts";

const yawOf = (o: THREE.Object3D) => new THREE.Euler().setFromQuaternion(o.quaternion, "YXZ").y;

describe("headTurn", () => {
  it("does not add up when the clip leaves the head alone", () => {
    const head = new THREE.Object3D();
    const turn = headTurn(head);
    // 60 frames: the mixer writes nothing (a constant track), the turn is applied after it each frame.
    for (let i = 0; i < 60; i++) {
      turn.restore();
      turn.apply(0.5);
    }
    expect(yawOf(head)).toBeCloseTo(0.5);
  });

  it("turns on top of the pose the clip wrote this frame", () => {
    const head = new THREE.Object3D();
    const turn = headTurn(head);
    turn.restore();
    head.rotation.set(0, 0.2, 0); // the mixer poses the head
    turn.apply(0.3);
    expect(yawOf(head)).toBeCloseTo(0.5);
    turn.restore();
    expect(yawOf(head)).toBeCloseTo(0.2);
  });
});
