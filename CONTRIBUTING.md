# Contributing

Thanks for helping improve Schematic Viewer.

## Development setup

```bash
npm install
npm run dev
```

Before opening a pull request, run:

```bash
npm test
npm run build
```

## Contribution workflow

The `main` branch is protected. Nobody should push directly to it. Every change must be made on a feature branch and submitted as a pull request. The pull request must pass the `verify` status check before it can be merged.

### Contributors without repository access

1. Fork this repository on GitHub.
2. Clone your fork and create a feature branch:

	```bash
	git clone https://github.com/YOUR-USERNAME/schematic.viewer.git
	cd schematic.viewer
	git checkout -b feature/short-description
	```

3. Make and test your changes.
4. Push the feature branch to your fork:

	```bash
	git push origin feature/short-description
	```

5. Open a pull request from your fork's feature branch into `Davide0995/schematic.viewer:main`.

### Collaborators with repository access

Collaborators may clone the main repository, but should still work on a feature branch:

```bash
git checkout -b feature/short-description
git push origin feature/short-description
```

Open a pull request from that branch into `main`. Do not push commits directly to `main`; branch protection will reject the push.

### Repository owner

The owner follows the same feature-branch and pull-request workflow. Because this is currently a solo-maintainer project, pull requests do not require a second approval. They do require the `verify` CI check and resolved conversations before merging.

## Pull requests

- Keep changes focused and explain the user-facing reason for the change.
- Add or update tests for parser and decoder behavior.
- Update the README when supported formats or limitations change.
- Do not commit `node_modules/`, `dist/`, resource packs, or copyrighted sample files.
- Include browser and file-format details for compatibility fixes.

## Bug reports

Use the bug-report template when possible. Include your browser, operating system, file format/version, reproduction steps, and a sanitized fixture or minimal reproduction if you can legally share one.
