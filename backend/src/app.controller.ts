import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get()
  root() {
    return this.health();
  }

  @Get("health")
  health() {
    return { ok: true, service: "liveshow-api" };
  }
}
