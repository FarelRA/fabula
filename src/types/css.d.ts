// Side-effect CSS imports resolve through the bundler, but the type checker
// (TypeScript 6 reports unresolved side-effect imports as errors) needs its
// own wildcard declarations. These live here, in app source, so every build
// context typechecks: the Docker image context excludes `tests/`, which was
// the only place a matching declaration previously arrived from (vite/client
// via `tests/vite-env.d.ts`).
declare module "*.css";
