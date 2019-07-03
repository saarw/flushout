import { Model, Snapshot, Command, Result, CommandCompletion, CompletionBatch, Sync } from "./types";
import { PathMapper } from "./path-mapper";
import { applyCompletions } from "./functions";
import { Inner } from "./inner";

export interface FlushResult {
    // If IDs in the model may have changed
    idsChanged: boolean;
    error?: string;
}

export interface ProxyOptions {
    sequentialIds: boolean
}

export class Proxy<T extends object> implements Model<T> {
    private lastCommittedDocument: string;
    private lastCommittedUpdateCount: number;
    private model: Inner<T>;
    private uncommittedCompletions: CommandCompletion[];
    private nextCommittedDocument?: string;
    private nextCommittedUpdateCount?: number;
    constructor(snapshot: Snapshot<T>, private options?: ProxyOptions) {
        this.model = new Inner(snapshot, options ? options.sequentialIds : false);
        this.uncommittedCompletions = [];
        this.lastCommittedDocument = JSON.stringify(snapshot.document);
        this.lastCommittedUpdateCount = snapshot.updateCount;
    }
    getDocument(): T {
        return this.model.getDocument();
    }
    getUpdateCount(): number {
        return this.model.getUpdateCount();
    }
    performCommand(command: Command): Result {
        const result = this.model.performCommand(command);
        if (result.isSuccess == true) {
            // Only store successfully applied commands in delegates
            this.uncommittedCompletions.push({ command: command, createdId: result.createdId });
        } else {
            // If there's a risk that the failed command modified the model, we would want to
            // rebuild it from our last committed snapshot and uncommitted commands, but we
            // don't yet have commands that can fail in that way
        }
        return result;
    }
    beginFlush(): CompletionBatch {
        if (this.nextCommittedDocument != undefined) {
            throw Error('Flush already in progress');
        }
        this.nextCommittedDocument = JSON.stringify(this.model.getDocument());
        this.nextCommittedUpdateCount = this.model.getUpdateCount();
        const batch: CompletionBatch = {
            from: this.lastCommittedUpdateCount,
            completions: this.uncommittedCompletions
        };
        this.uncommittedCompletions = [];
        return batch;
    }
    endFlush(sync?: Sync<T>): FlushResult {
        let idsChanged = false;
        if (this.nextCommittedDocument == undefined) {
            return {
                idsChanged: false,
                error: 'No flush in progress'
            };
        }
        if (!sync) {
            this.lastCommittedDocument = this.nextCommittedDocument;
            this.lastCommittedUpdateCount = this.nextCommittedUpdateCount;
            this.nextCommittedDocument = undefined;
            this.nextCommittedUpdateCount = undefined;
        } else {
            if (sync.isPartial == true) {
                const err = this.applyDiff(sync.diff);
                if (err) {
                    return {
                        idsChanged: true,
                        error: err
                    };
                }
                idsChanged = sync.mappedPaths != undefined;
            }
            else {
                this.model = new Inner(sync.latest, this.options ? this.options.sequentialIds : false);
                idsChanged = true;
            }
            this.lastCommittedDocument = JSON.stringify(this.model.getDocument());
            this.lastCommittedUpdateCount = this.model.getUpdateCount();
            const uncommittedApplied = applyCompletions(this.model, this.uncommittedCompletions, new PathMapper(sync.mappedPaths));
            if (uncommittedApplied) {
                idsChanged = true;
                this.uncommittedCompletions = uncommittedApplied.applied.completions;
                // Silently discard errors in uncommitted
            }
            this.nextCommittedDocument = undefined;
            this.nextCommittedUpdateCount = undefined;
        }
        return {
            idsChanged: idsChanged
        };
    }
    private applyDiff(diff: CompletionBatch): undefined | string {
        if (this.lastCommittedUpdateCount === diff.from) {
            this.model = new Inner({
                updateCount: this.lastCommittedUpdateCount,
                document: JSON.parse(this.lastCommittedDocument)
            }, this.options ? this.options.sequentialIds : false);
            const diffApplied = applyCompletions(this.model, diff.completions, new PathMapper());
            if (diffApplied && diffApplied.errors) {
                return 'Errors when applying diff on previous model';
            }
            return undefined;
        }
        return 'Failed to apply diff because its from-update-count did not match last committed';
    }
}
