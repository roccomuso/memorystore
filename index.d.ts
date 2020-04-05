import expressSession, {
	MemoryStore as ExpressMemoryStore,
} from "express-session";

interface MemoryStoreOptions {
	/**
	 * Define how long MemoryStore will check for expired.
	 * The period is in ms. The automatic check is disabled by default!
	 * Not setting this is kind of silly, since that's the whole purpose of
	 * this lib.
	 */
	checkPeriod?: number;
	/**
	 * The maximum size of the cache, checked by applying the length
	 * function to all values in the cache. It defaults to `Infinity`.
	 */
	max?: number;
	/**
	 * Session TTL (expiration) in milliseconds.
	 * Defaults to `session.maxAge` (if set), or one day.
	 */
	ttl?: number | ((options: any, sess: any, sessionId: any) => number);
	/**
	 * Function that is called on sessions when they are dropped from the
	 * cache. This can be handy if you want to close file descriptors or do
	 * other cleanup tasks when sessions are no longer accessible. It's
	 * called before actually removing the item from the internal cache, so
	 * if you want to immediately put it back in, you'll have to do that in
	 * a `nextTick` or `setTimeout` callback or it won't do anything.
	 */
	dispose?: (key: any, value: any) => void;
	/**
	 * By default, if you set a `maxAge`, it'll only actually pull stale
	 * items out of the cache when you `get(key)`. (That is, it's not
	 * pre-emptively doing a setTimeout or anything.) If you set
	 * `stale:true`, it'll return the stale value before deleting it. If
	 * you don't set this, then it'll return undefined when you try to get
	 * a stale entry, as if it had already been deleted.
	 */
	stale?: boolean;
	/**
	 * By default, if you set a `dispose()` method, then it'll be called
	 * whenever a `set()` operation overwrites an existing key. If you set
	 * this option, `dispose()` will only be called when a key falls out of
	 * the cache, not when it is overwritten.
	 */
	noDisposeOnSet?: boolean;
	/**
	 * An object compatible with Javascript's JSON to override the
	 * serializer used.
	 */
	serializer?: {
		stringify: (arg: object) => string;
		parse: (str: string) => object;
	};
}

declare class MemoryStore extends ExpressMemoryStore {
	constructor(options: MemoryStoreOptions);
	/** method to start the automatic check for expired. */
	startInterval(): void;
	/** method to clear the automatic check for expired. */
	stopInterval(): void;
	/** use to manually remove only the expired entries from the store. */
	prune(): void;
}

/**
 * Sample usage:
 * ```
 * import session from 'express-session';
 * import createMemoryStore from 'memorystore';
 * const MemoryStore = createMemoryStore(session);
 * ...
 * app.use(session({ store: new MemoryStore({ ...options }) }));
 * ```
 */
declare function createMemoryStore(
	session: typeof expressSession
): typeof MemoryStore;
export = createMemoryStore;
