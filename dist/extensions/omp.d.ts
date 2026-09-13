interface OmpBeforeAgentStartEvent {
    systemPrompt?: string;
}
interface OmpExtensionContext {
    cwd?: string;
}
interface OmpExtensionApi {
    on: (event: "before_agent_start", handler: (event: OmpBeforeAgentStartEvent, context: OmpExtensionContext) => Promise<{
        systemPrompt: string;
    }>) => void;
}
export default function ompCodeGraphExtension(omp: OmpExtensionApi): Promise<void>;
export {};
//# sourceMappingURL=omp.d.ts.map