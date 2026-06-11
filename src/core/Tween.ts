/**
 * Tiny tween engine — no external deps.
 * Drives normalized 0..1 progress over a duration and calls onUpdate each frame.
 */

export type Easing = (t: number) => number;

export const Easings = {
  linear: (t: number) => t,
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

interface Tween {
  elapsed: number;
  duration: number;
  easing: Easing;
  onUpdate: (v: number) => void;
  onComplete?: () => void;
}

export class TweenManager {
  private tweens: Tween[] = [];

  to(
    duration: number,
    onUpdate: (v: number) => void,
    opts: { easing?: Easing; onComplete?: () => void } = {}
  ): void {
    this.tweens.push({
      elapsed: 0,
      duration,
      easing: opts.easing ?? Easings.easeInOutCubic,
      onUpdate,
      onComplete: opts.onComplete,
    });
  }

  update(dt: number): void {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.elapsed += dt;
      const t = Math.min(tw.elapsed / tw.duration, 1);
      tw.onUpdate(tw.easing(t));
      if (t >= 1) {
        this.tweens.splice(i, 1);
        tw.onComplete?.();
      }
    }
  }
}
