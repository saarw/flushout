export class PathMapper {
    private readonly mappedPaths: Record<string, string[]>;
    private isEmpty: boolean;
    constructor(mappedPaths?: Record<string, string[]>) {
        this.mappedPaths = mappedPaths ? mappedPaths : {};
        this.isEmpty = Object.keys(this.mappedPaths).length === 0;
    }
    
    public get(path: string[]): string[] | undefined {
        if (this.isEmpty) {
            return undefined;
        }
        let p = path;
        while (p.length > 0) {
            const mappedSection = this.mappedPaths[p.toString()];
            if (mappedSection != undefined) {
                const mappedPath = mappedSection.concat(path.slice(p.length, path.length));
                this.put(path, mappedPath);
                return mappedPath;
            }
            p = p.slice(0, p.length - 1); 
        }
        return undefined;
    }
    public put(path: string[], remappedPath: string[]) {
        this.isEmpty = false;
        this.mappedPaths[path.toString()] = remappedPath;
    }
    public getMappings(): Record<string, string[]> {
        return this.mappedPaths;
    }
}
