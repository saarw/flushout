import { Model, Snapshot, Command, Result, CommandCompletion, CompletionBatch, Sync } from "./types";
import { PathMapper } from "./pathmapper";
import { applyCompletions } from "./functions";
import { Inner } from "./inner";
export class Proxy implements Model {
    private lastCommittedDocument: string;
    private lastCommittedUpdateCount: number;
    private model: Inner;
    private uncommittedCompletions: CommandCompletion[];
    private nextCommittedDocument?: string;
    private nextCommittedUpdateCount?: number;
    constructor(snapshot: Snapshot) {
        this.model = new Inner(snapshot);
        this.lastCommittedDocument = JSON.stringify(snapshot.document);
        this.lastCommittedUpdateCount = snapshot.updateCount;
    }
    getDocument(): any {
        return this.model.getDocument();
    }
    getUpdateCount(): number {
        return this.model.getUpdateCount();
    }
    performCommand(command: Command): Result {
        const result = this.model.performCommand(command);
        if (result.isSuccess == true) {
            // Only store successfully applied commands in delegates
            this.uncommittedCompletions.push({ command: command, newId: result.newId });
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
    endFlush(sync?: Sync): string | undefined {
        if (this.nextCommittedDocument == undefined) {
            return 'No flush in progress';
        }
        if (!sync) {
            this.lastCommittedDocument = this.nextCommittedDocument;
            this.lastCommittedUpdateCount = this.nextCommittedUpdateCount;
            this.nextCommittedDocument = undefined;
            this.nextCommittedUpdateCount = undefined;
        }
        else {
            if (sync.isPartial == true) {
                const err = this.applyDiff(sync.diff);
                if (err) {
                    return err;
                }
            }
            else {
                this.model = new Inner(sync.latest);
            }
            this.lastCommittedDocument = JSON.stringify(this.model.getDocument());
            this.lastCommittedUpdateCount = this.model.getUpdateCount();
            const uncommittedApplied = applyCompletions(this.model, this.uncommittedCompletions, new PathMapper(sync.mappedPaths));
            if (uncommittedApplied) {
                this.uncommittedCompletions = uncommittedApplied.applied.completions;
                // Silently discard errors in uncommitted
            }
            this.nextCommittedDocument = undefined;
            this.nextCommittedUpdateCount = undefined;
        }
        return undefined;
    }
    private applyDiff(diff: CompletionBatch): undefined | string {
        if (this.lastCommittedUpdateCount === diff.from) {
            this.model = JSON.parse(this.lastCommittedDocument);
            const diffApplied = applyCompletions(this.model, diff.completions, new PathMapper());
            if (diffApplied && diffApplied.errors) {
                return 'Errors when applying diff on previous model';
            }
            return undefined;
        }
        return 'Failed to apply diff because its from-update-count did not match last committed';
    }
}
