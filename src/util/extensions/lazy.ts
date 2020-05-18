export interface LazyInitializer<T> {
    (): T
}

export class Lazy<T> {
    private instance: T | null = null;
    private initializer: () => T;

    constructor(initializer: () => T) {
        this.initializer = initializer;
    }

    public get value(): T {
        if (this.instance == null) {
            this.instance = this.initializer();
        }

        return this.instance;
    }
}