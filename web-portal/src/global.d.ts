// src/declarations.d.ts
declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

interface ImportMetaEnv {
  readonly VITE_SITE_ACCESS_DURATION_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
