import type { GameApplication } from './js/game-application';
import type { GameplayRuntime } from './js/gameplay-runtime';

declare global {
    interface DevHandles {
        gameApp?: GameApplication;
        gameplayRuntime?: GameplayRuntime;
    }

    interface Window {
        gameApp?: GameApplication;
        gameplayRuntime?: GameplayRuntime;
        __devHandles?: DevHandles;
        __E2E__?: boolean;
    }
}

export {};