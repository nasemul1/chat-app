import { Injectable, Inject } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.module';
import { users } from '../database/schema';
import { RedisService } from '../redis/redis.service';
import { generateUserId } from '../common/utils/id-generator';
import { User } from '../database/schema';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private db: any,
    private redisService: RedisService,
  ) {}

  generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  async upsertUser(username: string): Promise<User> {
    // Check if user exists
    const existingUser = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existingUser.length > 0) {
      return existingUser[0];
    }

    // Create new user
    const userId = generateUserId();
    const newUser = await this.db
      .insert(users)
      .values({
        id: userId,
        username,
      })
      .returning();

    return newUser[0];
  }

  async login(username: string): Promise<{ sessionToken: string; user: User }> {
    // Upsert user in database
    const user = await this.upsertUser(username);

    // Generate session token
    const sessionToken = this.generateToken();

    // Store session in Redis with 24h TTL (86400 seconds)
    await this.redisService.setSession(sessionToken, {
      userId: user.id,
      username: user.username,
    });

    return {
      sessionToken,
      user,
    };
  }

  async validateSession(
    token: string,
  ): Promise<{ userId: string; username: string } | null> {
    const session = await this.redisService.getSession(token);
    if (!session) {
      return null;
    }
    return {
      userId: session.userId,
      username: session.username,
    };
  }
}
