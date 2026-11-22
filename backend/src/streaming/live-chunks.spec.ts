import { promises as fsp } from "fs";
import * as os from "os";
import * as path from "path";
import { concatLiveChunkFiles, liveChunkFileName } from "./live-chunks";

describe("live chunks", () => {
    it("pads chunk names so they sort in order", () => {
        const names = [2, 10, 0, 1].map(liveChunkFileName).sort();
        expect(names).toEqual(["000000.part", "000001.part", "000002.part", "000010.part"]);
    });

    it("concatenates files in the given order", async () => {
        const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "live-chunks-"));
        const a = path.join(dir, "a.bin");
        const b = path.join(dir, "b.bin");
        const dest = path.join(dir, "out.bin");
        await fsp.writeFile(a, Buffer.from("AAA"));
        await fsp.writeFile(b, Buffer.from("BBB"));
        await concatLiveChunkFiles([a, b], dest);
        const body = await fsp.readFile(dest);
        expect(body.toString()).toBe("AAABBB");
        await fsp.rm(dir, { recursive: true, force: true });
    });
});
