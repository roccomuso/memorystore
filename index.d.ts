// Definitions by: Clément Berthou <https://github.com/cberthou>

import * as express from 'express';
import * as expressSession from 'express-session';

declare module 'memorystore' {
  type memorystore = (session: SessionGenerator) => MemoryStoreConstructable;

  type SessionGenerator = (
    options?: expressSession.SessionOptions,
  ) => express.RequestHandler;

  interface MemoryStoreConstructable {
    new (config?: MemoryStoreOptions): MemoryStore;
  }

  class MemoryStore extends expressSession.MemoryStore {
    public touch: (
      sid: string,
      session: Express.SessionData,
      callback?: (err?: any) => void,
    ) => void;
  }

  interface MemoryStoreOptions {
    checkPeriod?: number;
    max?: number;
    ttl?: (
      options: any,
      session: Express.Session,
      sessionID: string,
    ) => number | number;
    dispose?: (key: string, value: any) => void;
    stale?: boolean;
    serializer?: Serializer;
  }

  interface Serializer {
    stringify: (object: any) => string;
    parse: (value: string) => any;
  }

  const fun: memorystore;
  export = fun;
}
