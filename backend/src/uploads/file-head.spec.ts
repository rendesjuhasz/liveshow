import { mkdtempSync, writeFileSync, unlinkSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { readFileHead } from "./file-head";
import { assertUploadedMedia } from "./upload-magic";

describe("readFileHead", () => {
    it("returns only the requested prefix of a large file", () => {
        const dir = mkdtempSync(join(tmpdir(), "ls-head-"));
        const file = join(dir, "big.bin");
        const body = Buffer.alloc(2 * 1024 * 1024, 7);
        body[0] = 0xff;
        body[1] = 0xd8;
        body[2] = 0xff;
        writeFileSync(file, body);
        const head = readFileHead(file, 64);
        expect(head.length).toBe(64);
        expect(head[0]).toBe(0xff);
        expect(head[1]).toBe(0xd8);
        const t0 = Date.now();
        assertUploadedMedia(file, "image/jpeg", "image");
        expect(Date.now() - t0).toBeLessThan(1000);
        unlinkSync(file);
        rmSync(dir, { recursive: true, force: true });
    });
});
