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

## Pull requests

- Keep changes focused and explain the user-facing reason for the change.
- Add or update tests for parser and decoder behavior.
- Update the README when supported formats or limitations change.
- Do not commit `node_modules/`, `dist/`, resource packs, or copyrighted sample files.
- Include browser and file-format details for compatibility fixes.

## Bug reports

Use the bug-report template when possible. Include your browser, operating system, file format/version, reproduction steps, and a sanitized fixture or minimal reproduction if you can legally share one.
