# Contributing

Thanks for helping. XYT stays useful by staying small, so a few guidelines:

- **Language changes** need a reason in terms of the people and models writing programs: what common program gets shorter, or what common mistake disappears? Update `src/reference.js` (the model reference) only when a feature is worth its tokens, and keep `docs/language.md` complete.
- **Errors are part of the interface.** A new error should say what is wrong, where, and what would work instead.
- **Tests.** `npm test` must pass. Language changes get a unit test in `test/compiler.test.mjs`, player logic in `test/player.test.mjs`, the command line in `test/cli.test.mjs`. Changes to the public API also update the types in `src/index.d.ts`. Anything that changes the generated shader should also pass `npm run test:gpu`, which compiles and renders every example on a real WebGL implementation.
- **Examples** in `examples/` are both documentation and regression tests: each one must compile and render.
- Keep the library dependency-free and WebGL 1 compatible.
- **Plugins** (`src/plugins/`) are for vocabulary that only some pages need, especially when it carries data (a font). A plugin brings its own model reference. The plugin interface is internal until a second plugin proves it, so a new plugin is a good moment to discuss it in an issue first.
- **Fonts** for the text plugin are welcome under licenses an MIT library can ship (public domain, MIT, the Hershey terms; not GPL). Credit them where the data lives and in the docs.
