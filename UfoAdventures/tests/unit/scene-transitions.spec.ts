
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SceneManager } from '../../src/js/engine/scene-manager';
import { SceneTransitions } from '../../src/js/ui/scene-transitions';
import { transitions } from '../../src/js/engine/transition-types';
import { gsap } from 'gsap';

describe('SceneTransitions', () => {
  let sceneManager: SceneManager;
  let sceneTransitions: SceneTransitions;
  let element: HTMLElement;

  beforeEach(() => {
    sceneManager = { push: vi.fn(), pop: vi.fn(), replace: vi.fn() } as unknown as SceneManager;
    sceneTransitions = new SceneTransitions({ elementId: 'transition-element' });

    element = document.createElement('div');
    element.id = 'transition-element';
    document.body.appendChild(element);

    gsap.globalTimeline.clear();
  });

  it('should attach and detach from scene manager', () => {
    sceneTransitions.attach(sceneManager);
    expect((sceneTransitions as any)._wrappedMethods.size).toBe(3);
    sceneTransitions.detach();
    expect((sceneTransitions as any)._wrappedMethods.size).toBe(0);
  });

  it('should run instant transition', async () => {
    sceneTransitions.attach(sceneManager);
    const pushSpy = vi.spyOn(sceneManager, 'push');

    await (sceneManager.push as any)('test-scene', {}, 'instant');

    expect(pushSpy).toHaveBeenCalled();
  });

  it('should run fade transition', async () => {
    sceneTransitions.attach(sceneManager);
    const pushSpy = vi.spyOn(sceneManager, 'push');
    const gsapSpy = vi.spyOn(gsap, 'to');

    await (sceneManager.push as any)('test-scene', {}, 'fade');

    expect(pushSpy).toHaveBeenCalled();
    expect(gsapSpy).toHaveBeenCalled();
  });
});
