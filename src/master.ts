import { PathMapper } from "./path-mapper";
import { HistoryStore, Model, CompletionBatch, ApplyResult } from "./types";
import { applyCompletions } from "./functions";

export class Master {
    readonly historyStore?: HistoryStore;
    model: Model;

    constructor(model: Model, historyStore?: HistoryStore) {
        this.model = model;
        this.historyStore = historyStore;
    }

    async apply(batch: CompletionBatch): Promise<ApplyResult> {
        const startUpdate = this.model.getUpdateCount();

        const pathMapper = new PathMapper();
        const result = applyCompletions(this.model, batch.completions, pathMapper);
        const applied = result == undefined ? batch : result.applied;

        let sync = undefined;
        if (batch.from != startUpdate) {
            const historyDiff = this.historyStore ? await this.historyStore.get(batch.from, startUpdate) : undefined;
            if (historyDiff == undefined || (historyDiff.length != startUpdate - batch.from)) {
                sync = {
                    isPartial: false,
                    mappedPath: pathMapper.getMappings(),
                    latest: {
                        updateCount: this.model.getUpdateCount(),
                        document: this.model.getDocument()
                    }
                };
            } else {
                const diff: CompletionBatch = {
                    from: batch.from,
                    completions: historyDiff.concat(applied.completions)
                };
                sync = {
                    isPartial: true,
                    diff: diff,
                    mappedPath: pathMapper.getMappings()
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