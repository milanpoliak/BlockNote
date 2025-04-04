/// <reference types="vite/client" />

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface ImportMetaEnv {
  readonly NODE_ENV: string;
  //   readonly VITE_APP_TITLE: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
