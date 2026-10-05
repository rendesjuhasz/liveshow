import { OptionalJwtAuthGuard } from "./jwt-auth.guard";

describe("OptionalJwtAuthGuard", () => {
    it("still invokes Passport when Authorization is missing so cookie JWT can load", async () => {
        const guard = new OptionalJwtAuthGuard();
        const superActivate = jest
            .spyOn(Object.getPrototypeOf(OptionalJwtAuthGuard.prototype), "canActivate")
            .mockResolvedValue(true);
        const ctx = {
            switchToHttp: () => ({
                getRequest: () => ({ headers: {} }),
            }),
        } as any;

        await expect(guard.canActivate(ctx)).resolves.toBe(true);
        expect(superActivate).toHaveBeenCalledTimes(1);
        superActivate.mockRestore();
    });

    it("allows the request as guest if Passport rejects", async () => {
        const guard = new OptionalJwtAuthGuard();
        const superActivate = jest
            .spyOn(Object.getPrototypeOf(OptionalJwtAuthGuard.prototype), "canActivate")
            .mockRejectedValue(new Error("No auth token"));
        const ctx = {
            switchToHttp: () => ({
                getRequest: () => ({ headers: {} }),
            }),
        } as any;

        await expect(guard.canActivate(ctx)).resolves.toBe(true);
        superActivate.mockRestore();
    });
});
