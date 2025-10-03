import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GameApplication } from '../../src/js/game-application';

const getMaxFrameSkip = (): number => Reflect.get(GameApplication as unknown as Record<string, unknown>, 'MAX_FRAME_SKIP') as number;

describe('GameApplication fixed-step guard', () => {
    beforeEach(() => {
        document.body.innerHTML = '<canvas id="gameCanvas"></canvas>';
    });

    it('limits fixed updates per frame and preserves fractional remainder', () => {
        const gameApp = new GameApplication();
        const fixedUpdate = vi.fn();
        const update = vi.fn();
        const render = vi.fn();

        (gameApp as any)._sceneManager = { fixedUpdate, update, render };

        const runtimeStub = {
            setFrameSkipCount: vi.fn(),
            finalizeFrame: vi.fn()
        };

        const services = (gameApp as any).services;
        services.replace('gameplayRuntime', runtimeStub);

        const ticker = {
            deltaMS: 0,
            add: vi.fn(),
            remove: vi.fn(),
            start: vi.fn(),
            stop: vi.fn()
        };

        (gameApp as any).pixiApp = { ticker };

        const fixedDelta = (gameApp as any)._fixedDelta as number;
        const maxSkip = getMaxFrameSkip();
        const extraSteps = 2.5;
        const deltaSeconds = (maxSkip + extraSteps) * fixedDelta;
        ticker.deltaMS = deltaSeconds * 1000;

        (gameApp as any)._onTick();

        const fractionalRemainder = (extraSteps % 1) * fixedDelta;

        expect(fixedUpdate).toHaveBeenCalledTimes(maxSkip);
        expect(update).toHaveBeenCalledTimes(1);
        expect(update.mock.calls[0][0]).toBeCloseTo(deltaSeconds, 6);
        expect((gameApp as any)._accumulator).toBeCloseTo(fractionalRemainder, 6);
        expect((gameApp as any)._tickInterpolation).toBeCloseTo(extraSteps % 1, 6);
        expect(render).toHaveBeenCalledTimes(1);
        expect(render.mock.calls[0][0]).toBeCloseTo(extraSteps % 1, 6);
        expect(runtimeStub.setFrameSkipCount).toHaveBeenCalledWith(maxSkip);
        expect(runtimeStub.finalizeFrame).toHaveBeenCalledTimes(1);
        expect(runtimeStub.finalizeFrame.mock.calls[0][0]).toBeCloseTo(deltaSeconds * 1000, 6);
        expect(runtimeStub.finalizeFrame.mock.calls[0][1]).toBeCloseTo(extraSteps % 1, 6);
    });

    it('resets accumulator when ticker pauses and resumes', () => {
        const gameApp = new GameApplication();
        const ticker = {
            stop: vi.fn(),
            start: vi.fn()
        };

        (gameApp as any)._ticker = ticker;

        (gameApp as any)._accumulator = 0.12;
        (gameApp as any)._tickInterpolation = 0.8;

        gameApp.pauseTicker();

        expect(ticker.stop).toHaveBeenCalledOnce();
        expect((gameApp as any)._accumulator).toBe(0);
        expect((gameApp as any)._tickInterpolation).toBe(0);

        (gameApp as any)._accumulator = 0.18;
        (gameApp as any)._tickInterpolation = 0.5;

        gameApp.resumeTicker();

        expect(ticker.start).toHaveBeenCalledOnce();
        expect((gameApp as any)._accumulator).toBe(0);
        expect((gameApp as any)._tickInterpolation).toBe(0);
    });

    it('clears accumulator when lifecycle handlers fire', () => {
        const gameApp = new GameApplication();

        const ticker = {
            add: vi.fn(),
            remove: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            deltaMS: 0
        };

        (gameApp as any).pixiApp = { ticker };
        (gameApp as any)._sceneManager = { fixedUpdate: vi.fn(), update: vi.fn(), render: vi.fn() };
        (gameApp as any)._startTicker();

        (gameApp as any)._accumulator = 0.2;
        (gameApp as any)._tickInterpolation = 0.6;

        window.dispatchEvent(new Event('blur'));

        expect((gameApp as any)._accumulator).toBe(0);
        expect((gameApp as any)._tickInterpolation).toBe(0);

        (gameApp as any)._unbindLifecycleHandlers();
    });
});
