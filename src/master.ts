import { PathMapper } from "./path-mapper";
import { Model, CompletionBatch, Snapshot, Sync, CompletionError, CommandCompletion } from "./types";
import { applyCompletions } from "./functions";
import { Inner } from "./inner";

export interface ApplyResult<T extends object> {
    applied: CompletionBatch,
    sync?: Sync<T>;
    errors?: CompletionError[]
}

export interface MasterConfig {
    historyProvider?: HistoryProvider,
    sequentialIds?: boolean         // used for testing
}


export interface HistoryProvider {
    /** 
     * Returns the history from the specified update count, if available, otherwise undefined
     */
    get(from: number, to: number): Promise<CommandCompletion[] | undefined>;
}

/**
 * Updates the master model and responds to flush batches, providing diffs from an optional
 * history provider.
 */
export class Master<T extends object> {
    private readonly historyProvider?: HistoryProvider;
    private readonly model: Model<T>;

    constructor(snapshot: Snapshot<T>, config?: MasterConfig) {
        this.model = new Inner(snapshot, config ? !!config.sequentialIds : false);
        this.historyProvider = config ? config.historyProvider : undefined;
    }

    public getSnapshot(): Snapshot<T> {
        return {
            updateCount: this.model.getUpdateCount(),
            document: this.model.getDocument()
        };
    }

    /**
     * Applies the flushed commands to the model and returns a result that contains the commands
     * that were successfully applied and from what update count, any errors that occurred when 
     * applying the commands, and optionally a sync object to bring the requesting Proxy up to 
     * the same state as the master. If the Master was constructed with a history provider, the
     * sync object may be a partial diff that returns the commands needed to update the proxy
     * from the batch's update count to the master's current state.  
     * @param batch 
     */
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
            const historyDiff = this.historyProvider ? await this.historyProvider.get(batch.from, startUpdate) : undefined;
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