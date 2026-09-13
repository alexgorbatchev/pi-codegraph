import type { CodeGraphTool } from "./types.js";
export declare const codegraphTools: readonly CodeGraphTool[];
export declare const codegraphToolNames: readonly string[];
export declare function toolCallLabel(_name: string, args?: Record<string, unknown>): string;
export declare function summarizeToolText(text: unknown): {
    firstLine: string;
    lineCount: number;
    truncated: boolean;
};
//# sourceMappingURL=tool-metadata.d.ts.map