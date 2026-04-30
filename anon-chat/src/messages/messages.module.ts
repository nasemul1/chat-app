import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
	imports: [DatabaseModule, RedisModule],
	controllers: [MessagesController],
	providers: [MessagesService],
	exports: [MessagesService],
})
export class MessagesModule {}
