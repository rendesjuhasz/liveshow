import { Module } from '@nestjs/common';
import { StreamingController } from './streaming.controller';
import { StreamingService } from './streaming.service';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [SecurityModule],
  controllers: [StreamingController],
  providers: [StreamingService],
})
export class StreamingModule { }
