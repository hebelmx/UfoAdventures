import type { BehaviorTreeNodeDefinition, BossConfig, EnemySpawningConfig, WeaponDefinitionWithExtras } from './combat-types';
import type { InputConfig } from './input-service';
import type { MissionConfig } from './mission-service';

export interface ApplicationScreenConfig {
    width?: number;
    height?: number;
    backgroundColor?: number | string;
}

export interface ApplicationConfig {
    screen?: ApplicationScreenConfig;
    [key: string]: unknown;
}

export interface AssetDefinition {
    alias: string;
    src: string;
    type?: string;
    json?: string;
    animations?: Record<string, string[]>;
    [key: string]: unknown;
}

export type WeaponConfigMap = Record<string, Partial<WeaponDefinitionWithExtras>>;
export type BehaviorTreeConfigMap = Record<string, BehaviorTreeNodeDefinition>;

export interface GameConfiguration {
    application?: ApplicationConfig;
    assets?: AssetDefinition[];
    missions?: MissionConfig;
    behaviorTrees?: BehaviorTreeConfigMap;
    weapons?: WeaponConfigMap;
    input?: InputConfig;
    enemies?: EnemySpawningConfig;
    boss?: BossConfig;
    progression?: Record<string, unknown>;
    [key: string]: unknown;
}
