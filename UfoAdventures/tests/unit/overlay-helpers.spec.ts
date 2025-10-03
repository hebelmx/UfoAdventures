import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { setOverlayVisible } from '../../src/js/ui/overlay-helpers';

describe('overlay helpers', () => {
    let overlay: HTMLElement;
    let previousRaf: typeof requestAnimationFrame | undefined;

    beforeEach(() => {
        overlay = document.createElement('div');
        overlay.id = 'overlay-under-test';
        overlay.innerHTML = [
            '<button id="first">First</button>',
            '<button id="autofocus" data-autofocus>Autofocus</button>',
            '<button id="fallback">Fallback</button>'
        ].join('');
        document.body.appendChild(overlay);

        previousRaf = globalThis.requestAnimationFrame;
        (globalThis as { requestAnimationFrame?: typeof requestAnimationFrame }).requestAnimationFrame = (callback => {
            callback(0);
            return 0;
        }) as typeof requestAnimationFrame;
    });

    afterEach(() => {
        if (previousRaf) {
            globalThis.requestAnimationFrame = previousRaf;
        } else {
            delete (globalThis as { requestAnimationFrame?: typeof requestAnimationFrame }).requestAnimationFrame;
        }
        document.body.innerHTML = '';
    });

    it('toggles visibility and aria-hidden attributes', () => {
        setOverlayVisible(overlay, false);
        expect(overlay.style.display).toBe('none');
        expect(overlay.getAttribute('aria-hidden')).toBe('true');

        setOverlayVisible(overlay, true);
        expect(overlay.style.display).toBe('flex');
        expect(overlay.getAttribute('aria-hidden')).toBe('false');
    });

    it('focuses the element marked with data-autofocus when showing the overlay', () => {
        const target = overlay.querySelector<HTMLElement>('[data-autofocus]');
        expect(target).not.toBeNull();

        setOverlayVisible(overlay, true);

        expect(document.activeElement).toBe(target);
    });

    it('uses focus selector when provided', () => {
        const fallback = overlay.querySelector<HTMLElement>('#fallback');
        expect(fallback).not.toBeNull();

        setOverlayVisible(overlay, true, '#fallback');

        expect(document.activeElement).toBe(fallback);
    });
});
