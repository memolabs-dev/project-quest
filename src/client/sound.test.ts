import { describe, expect, it } from "vitest";
import { createSound, type HowlLike } from "./sound.ts";

/** A stand-in for Howler: records what plays, at which volume and rate. */
const fake = () => {
  const played: { src: string; volume: number; rate: number }[] = [];
  let now = 0;
  const make = (src: string): HowlLike => {
    let volume = 1;
    let rate = 1;
    return {
      play: () => { played.push({ src, volume, rate }); return 1; },
      volume: (v: number) => { volume = v; },
      rate: (r: number) => { rate = r; },
    };
  };
  return { played, make, clock: { now: () => now, advance: (ms: number) => { now += ms; } } };
};

describe("the site's sounds", () => {
  it("nothing plays before the first gesture", () => {
    const f = fake();
    const sound = createSound(f.make, f.clock.now);
    sound.play("thud");
    expect(f.played).toEqual([]);
    sound.unlock();
    sound.play("thud");
    expect(f.played.map((p) => p.src)).toEqual(["/audio/thud.ogg"]);
  });
  it("muted plays nothing and stays muted after unlock", () => {
    const f = fake();
    const sound = createSound(f.make, f.clock.now);
    sound.setMuted(true);
    sound.unlock();
    sound.play("chime");
    expect(f.played).toEqual([]);
    sound.setMuted(false);
    f.clock.advance(100);
    sound.play("chime");
    expect(f.played).toHaveLength(1);
  });
  it("the volume reaches every sound", () => {
    const f = fake();
    const sound = createSound(f.make, f.clock.now);
    sound.unlock();
    sound.setVolume(0.3);
    sound.play("land");
    expect(f.played[0].volume).toBeCloseTo(0.3);
  });
  it("a sound asked twice within 60 ms plays once", () => {
    const f = fake();
    const sound = createSound(f.make, f.clock.now);
    sound.unlock();
    sound.play("land");
    f.clock.advance(30);
    sound.play("land");
    f.clock.advance(40);
    sound.play("land");
    expect(f.played).toHaveLength(2);
  });
  it("the first gesture readies every sound, so the first ones are not late", () => {
    const made: string[] = [];
    const sound = createSound((src) => { made.push(src); return { play: () => 1, volume: () => {}, rate: () => {} }; }, () => 0);
    expect(made).toEqual([]);
    sound.unlock();
    expect(made).toHaveLength(12);
  });
  it("footsteps take one of four steps, at the walker's rate", () => {
    const f = fake();
    const sound = createSound(f.make, f.clock.now);
    sound.unlock();
    for (let i = 0; i < 4; i++) { sound.play("step", { rate: 1.2 }); f.clock.advance(100); }
    expect(new Set(f.played.map((p) => p.src))).toEqual(new Set(["/audio/step1.ogg", "/audio/step2.ogg", "/audio/step3.ogg", "/audio/step4.ogg"]));
    expect(f.played.every((p) => p.rate === 1.2)).toBe(true);
  });
});
