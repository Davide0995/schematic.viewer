# Repository Instructions

- Follow `CONTRIBUTING.md` for every change.
- Never push directly to `main` and never merge a pull request.
- For code, test, documentation, or configuration changes, work on a feature branch and open a GitHub pull request targeting `main`.
- Before opening a pull request, run `npm test` and `npm run build`; report any failures and do not open the PR until they are resolved or explicitly disclosed.
- Keep pull requests focused, update tests for parser or decoder changes, and update `README.md` when supported formats or limitations change.
- Do not commit `node_modules/`, `dist/`, resource packs, or copyrighted sample files.
- The user must manually review and approve the pull request on GitHub. Agents may prepare and push the branch and create the PR, but must leave merging to the user.
