/// <reference types="vite/client" />

// vite.config.ts の define で注入されるビルドバージョン文字列
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
