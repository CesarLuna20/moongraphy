import { MMKV } from "react-native-mmkv";

type NativeGlobals = typeof globalThis & {
  nativeCallSyncHook?: unknown;
  HermesInternal?: unknown;
};

const nativeGlobals = globalThis as NativeGlobals;

const hasNativeSyncHook =
  typeof nativeGlobals.nativeCallSyncHook === "function" ||
  typeof nativeGlobals.HermesInternal === "object";

let storage: MMKV | null = null;

if (hasNativeSyncHook) {
  try {
    storage = new MMKV();
  } catch (error) {
    console.warn("[secureStorage] Failed to initialize MMKV. Using in-memory fallback.", error);
  }
} else {
  console.warn(
    "[secureStorage] MMKV unavailable. Remote debugging or missing JSI prevents synchronous access. Using in-memory fallback."
  );
}

const memoryStore = new Map<string, string>();

const setItem = (key: string, value: string) => {
  if (storage) {
    storage.set(key, value);
    return;
  }
  memoryStore.set(key, value);
};

const getItem = (key: string) => {
  if (storage) {
    return storage.getString(key) ?? null;
  }
  return memoryStore.get(key) ?? null;
};

const removeItem = (key: string) => {
  if (storage) {
    storage.delete(key);
    return;
  }
  memoryStore.delete(key);
};

const clearAllItems = () => {
  if (storage) {
    storage.clearAll();
    return;
  }
  memoryStore.clear();
};

export const STORAGE_KEYS = {
  AUTH_TOKEN: "auth.token",
  AUTH_USER: "auth.user",
  AUTH_SESSION: "auth.session",
  USERS: "storage.users",
  LAST_RECOVERY_EVENT: "auth.recovery",
  AUDIT_LOG: "audit.log"
} as const;

export const secureStorage = {
  setString(key: string, value: string) {
    setItem(key, value);
  },
  getString(key: string) {
    return getItem(key);
  },
  setJson<T>(key: string, value: T) {
    setItem(key, JSON.stringify(value));
  },
  getJson<T>(key: string): T | null {
    const value = getItem(key);
    if (!value) {
      return null;
    }
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.warn(`[secureStorage] Failed to parse JSON for key ${key}`, error);
      return null;
    }
  },
  remove(key: string) {
    removeItem(key);
  },
  clearAll() {
    clearAllItems();
  }
};
