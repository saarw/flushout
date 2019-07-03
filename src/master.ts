import { PathMapper } from "./path-mapper";
import { HistoryStore, Model, CompletionBatch, ApplyResult, Snapshot, Sync } from "./types";
import { applyCompletions } from "./functions";
import { Inner } from "./inner";

export interface MasterConfig {
    historyStore?: HistoryStore,
    sequentialIds?: boolean         // used for testing
}

export class Master<T extends object> {
    private readonly historyStore?: HistoryStore;
    private readonly model: Model<T>;

    constructor(snapshot: Snapshot<T>, config?: MasterConfig) {
        this.model = new Inner(snapshot, config ? !!config.sequentialIds : false);
        this.historyStore = config ? config.historyStore : undefined;
    }

    getSnapshot(): Snapshot<T> {
        return {
            updateCount: this.model.getUpdateCount(),
            document: this.model.getDocument()
        };
    }

    async apply(batch: CompletionBatch): Promise<ApplyResult<T>> {
        const startUpdate = this.model.getUpdateCount();

        const pathMapper = new PathMapper();
        const result = applyCompletions(this.model, batch.completions, pathMapper);
        const applied = result == undefined ? batch : result.applied;

        let sync: Sync<T> | undefined = undefined;
        if (batch.from != startUpdate) {
            const historyDiff = this.historyStore ? await this.historyStore.get(batch.from, startUpdate) : undefined;
            if (historyDiff == undefined || (historyDiff.length != startUpdate - batch.from)) {
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
                    diff: diff,
                    mappedPaths: pathMapper.getMappings()
                };
            }
        }
        if (this.historyStore) {
            this.historyStore.store(startUpdate, applied.completions);
        }
        return {
            sync: sync,
            errors: result == undefined ? undefined : result.errors
        };
    }
}