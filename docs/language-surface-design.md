# Language Surface Design

## Current Scope

Supported languages are English (`en`) and Chinese (`zh`). The default language
is English. The selected language is saved in `localStorage` under
`vegarank.language`; the app migrates the pre-cutover `trade-scanner.language`
key on read.

Phase 16.1 only switches ranking-result explanation surfaces:

- ranking observations
- review notes and reasons
- signal labels
- action bias labels
- primary structure labels
- detected risk type labels
- ranking evaluation notes

This is not full-site localization. Navigation, filters, table headers, and
general workflow copy may remain English unless they already came from existing
ranking dictionaries.

## Boundary

Ranking APIs, storage, server routes, and shared ranking core files remain
language-neutral. Backend output should continue to emit stable keys and params,
not English or Chinese display text.

## Future TODO

Full-site localization can later define route strategy, export/report behavior,
all shared UI labels, and broader product copy ownership.
