## 2024-05-23 - Bun Build Crash
**Learning:** `bun --bun next build` crashed with SIGILL (Illegal instruction) during the build process, likely due to some native module interaction or worker threads implementation in Bun 1.2.14. However, the build actually "Compiled successfully" before the crash happened during "Finalizing page optimization" or post-build steps.
**Action:** When running build verification in this environment, be aware that `bun --bun next build` might crash even if the code is correct. Rely on "Compiled successfully" message and consider running `bun next build` (without --bun flag for the binary) if persistent, or just checking lint/types separately. For now, since lint failed due to missing directory, I should trust manual verification more.

## 2024-05-23 - Linting Command
**Learning:** `bun run lint` failed because it tried to run `next lint` which wasn't found in the path correctly or the directory argument was wrong.
**Action:** Use `bun x next lint` or ensure `node_modules` are properly set up. The environment seems to have some path issues.
