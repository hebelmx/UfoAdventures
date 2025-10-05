
import { gsap } from 'gsap';

export interface ISceneTransition {
  init(element: HTMLElement): void;
  play(onMiddle: () => Promise<void>): Promise<void>;
}

class FadeTransition implements ISceneTransition {
  private _element: HTMLElement | null = null;

  init(element: HTMLElement): void {
    this._element = element;
    gsap.set(this._element, { autoAlpha: 0 });
  }

  async play(onMiddle: () => Promise<void>): Promise<void> {
    if (!this._element) {
      await onMiddle();
      return;
    }

    await gsap.to(this._element, { autoAlpha: 1, duration: 0.5 });
    await onMiddle();
    await gsap.to(this._element, { autoAlpha: 0, duration: 0.5 });
  }
}

class InstantTransition implements ISceneTransition {
  init(element: HTMLElement): void {
    // Nothing to initialize
  }

  async play(onMiddle: () => Promise<void>): Promise<void> {
    await onMiddle();
  }
}

export const transitions = new Map<string, ISceneTransition>();
transitions.set('fade', new FadeTransition());
transitions.set('instant', new InstantTransition());
