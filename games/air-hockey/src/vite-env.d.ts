/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the multiplayer Worker, baked in at build time by CI.
   * Optional — the client falls back to `<origin>/mp`, and to solo play if
   * neither is reachable.
   */
  readonly VITE_MP_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
