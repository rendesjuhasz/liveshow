import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { map } from "rxjs";
import { rewriteMediaUrls } from "./media-sign";

@Injectable()
export class SignedMediaInterceptor implements NestInterceptor {
    intercept(_context: ExecutionContext, next: CallHandler) {
        return next.handle().pipe(
            map((data) => {
                if (data == null || typeof data !== "object") return data;
                return rewriteMediaUrls(data);
            }),
        );
    }
}
