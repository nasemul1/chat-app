import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private client: Redis;
  private pubClient: Redis;
  private subClient: Redis;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    
    this.client = new Redis(redisUrl);
    this.pubClient = new Redis(redisUrl);
    this.subClient = new Redis(redisUrl);

    this.client.on('error', (err) => console.error('Redis client error:', err));
    this.pubClient.on('error', (err) => console.error('Redis pub client error:', err));
    this.subClient.on('error', (err) => console.error('Redis sub client error:', err));
  }

  getClient(): Redis {
    return this.client;
  }

  getPubClient(): Redis {
    return this.pubClient;
  }

  getSubClient(): Redis {
    return this.subClient;
  }

  async setSession(token: string, data: Record<string, any>, ttl = 86400): Promise<void> {
    await this.client.setex(
      `session:${token}`,
      ttl,
      JSON.stringify(data),
    );
  }

  async getSession(token: string): Promise<Record<string, any> | null> {
    const data = await this.client.get(`session:${token}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteSession(token: string): Promise<void> {
    await this.client.del(`session:${token}`);
  }

  async addActiveUser(roomId: string, username: string): Promise<void> {
    await this.client.sadd(`room:active:${roomId}`, username);
  }

  async removeActiveUser(roomId: string, username: string): Promise<void> {
    await this.client.srem(`room:active:${roomId}`, username);
  }

  async getActiveUsers(roomId: string): Promise<string[]> {
    return this.client.smembers(`room:active:${roomId}`);
  }

  async getActiveUserCount(roomId: string): Promise<number> {
    return this.client.scard(`room:active:${roomId}`);
  }

  async setSocketState(socketId: string, data: Record<string, any>): Promise<void> {
    await this.client.hset(`socket:${socketId}`, data);
  }

  async getSocketState(socketId: string): Promise<Record<string, any>> {
    return this.client.hgetall(`socket:${socketId}`);
  }

  async deleteSocketState(socketId: string): Promise<void> {
    await this.client.del(`socket:${socketId}`);
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.pubClient.publish(channel, message);
  }

  subscribe(channel: string, callback: (message: string) => void): void {
    this.subClient.subscribe(channel, (err) => {
      if (err) console.error('Failed to subscribe:', err);
    });

    this.subClient.on('message', (receivedChannel, message) => {
      if (receivedChannel === channel) {
        callback(message);
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
    await this.pubClient.quit();
    await this.subClient.quit();
  }
}
