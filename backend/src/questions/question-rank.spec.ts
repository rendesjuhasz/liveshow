import { viewerStatus, viewerStatusLabelHu } from "./question-rank";

describe("viewer question status", () => {
    it("maps missed to nem került sorra without treating it as rejected", () => {
        expect(viewerStatus("missed")).toBe("missed");
        expect(viewerStatusLabelHu("missed")).toBe("Nem került sorra");
        expect(viewerStatus("pending")).toBe("pending");
        expect(viewerStatus("rejected")).toBe("rejected");
    });
});
