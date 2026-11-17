import { closeSync, openSync, readSync } from "fs";

/** Read at most `max` bytes from the start of a file. Never loads the whole object. */
export function readFileHead(filePath: string, max = 64): Buffer {
    const size = Math.max(1, Math.min(max, 4096));
    const fd = openSync(filePath, "r");
    try {
        const buf = Buffer.alloc(size);
        const n = readSync(fd, buf, 0, size, 0);
        return n < size ? buf.subarray(0, n) : buf;
    } finally {
        closeSync(fd);
    }
}
