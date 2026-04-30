import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6);

export const generateId = (prefix: string): string => {
  return `${prefix}_${nanoid()}`;
};

export const generateUserId = (): string => generateId('usr');
export const generateRoomId = (): string => generateId('room');
export const generateMessageId = (): string => generateId('msg');
