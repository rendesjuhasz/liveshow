import { Controller, Get } from "@nestjs/common";
import { OpsService } from "./ops/ops.service";

@Controller()
export class AppController {
    constructor(private readonly ops: OpsService) {}

    @Get()
    root() {
        return this.ops.live();
    }
}
