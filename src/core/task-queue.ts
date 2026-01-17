/**
 * Simple FIFO Queue for Tasks
 */
export class TaskQueue<T> {
    private queue: T[] = [];

    constructor(private maxSize: number = 1000) { }

    enqueue(item: T): boolean {
        if (this.queue.length >= this.maxSize) {
            console.warn(`[TaskQueue] Queue full! Dropping item.`);
            return false;
        }
        this.queue.push(item);
        return true;
    }

    dequeue(): T | undefined {
        return this.queue.shift();
    }

    get length(): number {
        return this.queue.length;
    }

    get isEmpty(): boolean {
        return this.queue.length === 0;
    }
}
