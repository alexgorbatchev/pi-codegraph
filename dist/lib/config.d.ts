import type { CodeGraphSettings } from "./types.js";
export declare const defaultSettings: Readonly<CodeGraphSettings>;
export declare function loadSettings(overrides?: Partial<CodeGraphSettings>): Promise<CodeGraphSettings>;
export declare function settingsEnvironment(settings: CodeGraphSettings, baseRoot: string, trusted?: boolean): NodeJS.ProcessEnv;
//# sourceMappingURL=config.d.ts.map