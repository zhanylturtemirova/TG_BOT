# Working on TubobubaBot

Use clear names and small modules with one responsibility. Consolidate repeated behavior instead of copying another downloader or handler. Do not split a cohesive function solely to satisfy a line-count target.

- `index.js` starts and stops the bot. `bot/createBot.js` composes dependencies without connecting to Telegram on import.
- `bot/` coordinates Telegram interactions; `services/UIService.js` owns user-facing text and buttons.
- `downloaders/BaseDownloader.js` owns the common media workflow. Platform classes contain only differences. `config/platforms.js` is the source of truth for capabilities.
- `services/` owns selection state, bounded job execution, process execution and temporary files. Use explicit platform IDs rather than constructor names.
- Keep external calls replaceable in tests. Preserve actual business logic, file operations and grammY handlers in functional tests.
- Run `npm test` for behavioral changes. Cover observable behavior and failure paths, not source-code strings or private implementation details. See `docs/QA.md` for manual verification.
- This project has a Telegram UI, not a website. Do not add a web frontend to satisfy the word “frontend”.
- The user’s backend, frontend and qa skills are installed in their personal Codex skill directory and scoped to this project.

Do not commit credentials or temporary media. Existing tracked cookie files must not be printed or used by automated tests. A test with a mocked transport is not evidence of a real Telegram delivery.
