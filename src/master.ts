import { PathMapper } from "./path-mapper";
import { Model, CompletionBatch, Snapshot, Sync, CompletionError, CommandCompletion } from "./types";
import { applyCompletions } from "./functions";
import { Inner } from "./inner";

export interface ApplyResult<T extends object> {
    sync?: Sync<T>;
    applied: CompletionBatch,
    errors?: CompletionError[]
}

export interface MasterConfig {
    historyProvider?: HistoryProvider,
    sequentialIds?: boolean         // used for testing
}


export interface HistoryProvider {
    // Returns the history from the specified update count, if available, otherwise undefined
    get(from: number, to: number): Promise<CommandCompletion[] | undefined>;
}

export class Master<T extends object> {
    private readonly historyStore?: HistoryProvider;
    private readonly model: Model<T>;

    constructor(snapshot: Snapshot<T>, config?: MasterConfig) {
        this.model = new Inner(snapshot, config ? !!config.sequentialIds : false);
        this.historyStore = config ? config.historyProvider : undefined;
    }

    public getSnapshot(): Snapshot<T> {
        return {
            updateCount: this.model.getUpdateCount(),
            document: this.model.getDocument()
        };
    }

    public async apply(batch: CompletionBatch): Promise<ApplyResult<T>> {
        const startUpdate = this.model.getUpdateCount();

        const pathMapper = new PathMapper();
        const result = applyCompletions(this.model, batch.completions, pathMapper);
        const applied: CompletionBatch = {
            from: startUpdate,
            completions: result == undefined ? batch.completions : result.applied.completions
        };

        let sync: Sync<T> | undefined;
        if (batch.from !== startUpdate) {
            const historyDiff = this.historyStore ? await this.historyStore.get(batch.from, startUpdate) : undefined;
            if (historyDiff == undefined || (historyDiff.length !== startUpdate - batch.from)) {
                sync = {
                    isPartial: false,
                    mappedPaths: pathMapper.getMappings(),
                    latest: this.getSnapshot()
                };
            } else {
                const diff: CompletionBatch = {
                    from: batch.from,
                    completions: historyDiff.concat(applied.completions)
                };
                sync = {
                    isPartial: true,
                    diff,
                    mappedPaths: pathMapper.getMappings()
                };
            }
        }
        return {
            sync,
            applied,
            errors: result == undefined ? undefined : result.errors
        };
    }
}