import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { ChatGateway } from './chat.gateway';

@Module({
	imports: [AuthModule, DatabaseModule, RedisModule],
	providers: [ChatGateway],
})
export class ChatModule {}
