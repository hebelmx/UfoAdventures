import type { GameApplication } from './js/game-application';
import type { GameplayRuntime } from './js/gameplay-runtime';

declare global {
    interface Window {
        gameApp?: GameApplication;
        gameplayRuntime?: GameplayRuntime;
        __E2E__?: boolean;
    }
}

export {};
