# Trade Scanner Design System

## Product UI Principle

Trade Scanner is a desktop-first professional research terminal. The interface is dense but readable, and it supports structured observation over prediction. UI copy and layout must make the product feel like a research workspace, not an execution platform or financial-advice product.

The app should prioritize evidence, context, scanner state, and follow-up checks. It should avoid hype, profit framing, and trading-call language.

## Layout System

The app shell uses a compact global header above page-specific workspaces. Terminal pages should preserve key context near the top while allowing the main workspace to scroll normally.

The five terminal pages, Scanner, Screener, Watchlist, History, and Symbol Research, use a fixed-height workspace on desktop. The browser page itself should not scroll on these pages; only bounded workspace elements scroll. The global header remains above the workspace, and page-specific command/context bars stay inside the fixed workspace.

Use compact command/context bars for pages where users compare data while scrolling inside bounded panes. These bars must include only the information needed to preserve orientation: current symbol or result set, exchange, timeframe, asset class, quality, latest timestamp, current state, and the primary reason or rank summary.

Terminal timestamps use neutral numeric display: full datetime is `YYYY-MM-DD HH:mm`, date-only is `YYYY-MM-DD`, compact same-context datetime may use `MM-DD HH:mm`, and time-only is `HH:mm`. Do not use locale month names, AM/PM, or language-specific date words in terminal UI.

Desktop research layouts use a fixed grid structure:

- Primary workspace: chart, table, or main data surface.
- Analysis column: explanation, score interpretation, and next checks.
- Context rail: market backdrop, history, timeline, and secondary details.

Screener pages follow a full-table philosophy. The table is the product surface, so filters, status bars, and detail panels should support table scanning rather than compete with it.

## Visual Hierarchy

The hierarchy is:

1. Primary decision or status.
2. Chart, table, or data workspace.
3. Explanation and checks.
4. Context rail.
5. Diagnostics and raw data.

Diagnostics, raw JSON, source metadata, and broad detail tables are lowest priority. Keep them collapsed by default unless a phase explicitly asks for diagnostic-first work.

## Density Rules

Use compact cards, short labels, tight row spacing, and concise English copy. Avoid repeated explanatory copy, decorative UI, nested cards, oversized headers inside tool surfaces, and unnecessary internal scrollbars.

Terminal page content should not create a page-level scrollbar on desktop. Internal scrollbars are used for primary tables, recent-run rails, symbol analysis columns, context rails, raw diagnostics, expanded source data, very wide tables, and intentionally bounded raw panels.

## Desktop Height Balancing

Terminal workspaces should use the first desktop viewport deliberately. Avoid one long context rail while primary and analysis columns end early with dead space below them.

Columns should have comparable visual weight in the first desktop viewport. If one column becomes much longer, collapse lower-priority content or redistribute existing summary information into the analysis column. Do this with existing evidence, history, or context data rather than introducing new product concepts.

Chart compactness must not make the primary visual too short. Use responsive sizing such as clamp-based heights so the chart remains the dominant workspace on desktop without reintroducing viewport-locked page sections or default internal scrollbars.

## Color And Status Semantics

Colors support scanning and should not become decoration.

- Eligible, constructive, and supportive states use positive greens.
- Watch, mixed, and neutral states use muted or moderate tones.
- Risk, negative, and invalid states use red.
- Overheated or caution states use amber.
- Secondary metadata uses muted foreground colors.

Do not overuse saturated color. A status color should identify state, priority, or risk, not decorate a module.

## Table And List Rules

Tables should use compact row height, tabular numerals, clear active sort indicators, and right alignment for numeric values where practical. Missing and neutral states should be muted.

Lists should show the most important rows first. If a compact panel has more than a few items, show the top 3-4 by default and omit the rest unless the hidden content has clear user value. Do not add generic "more" expanders just to expose low-priority overflow.

The Screener should not default to a pagination or top-100 pattern. Full result visibility is the baseline unless performance or a specific phase requires otherwise.

## Symbol Research Rules

Symbol Research keeps the command bar and decision strip fixed inside the terminal workspace on desktop. The context should preserve symbol, exchange, timeframe, asset class, quality, latest timestamp, current decision/state, and the primary reason or rank summary.

The chart remains the primary visual element and should fill the left workspace column without forcing page-level overflow. Multi-timeframe context sits with the chart. Why and Check Next explain decision quality and next research steps. The right rail contains context modules: Backdrop, History, Timeline, and Details. Analysis and context columns may scroll independently when content exceeds the viewport.

Timeline defaults to the most relevant recent rows and should not show an internal scrollbar in its compact state. Newer secondary-row notices should read as small status notes, not warning banners. Avoid generic "show more" controls in the rail; the compact rail should prioritize recent activity over exhaustive history.

Details and Raw Diagnostics stay collapsed by default and should remain visually lower priority than chart, explanation, and context modules.

## Screener Rules

The Screener is table-first. Keep full result visibility by default, with a compact sticky left filter rail on desktop. Filters should be efficient and low-friction; status and primary signal colors should improve scanning rather than decorate rows.

Avoid pagination-first layouts, oversized summary cards, or empty marketing sections. Preserve dense comparison workflows.

## Scanner Rules

Scanner is the latest single-timeframe scan output viewer. Keep it close to raw scanner output, with a compact terminal summary, concise left controls, semantic group counts, and one dense result table. It must not become Screener, Watchlist, Symbol Research, History, an AI summary, or a backtest page.

Scanner summary and group counts should be compact terminal strips, not metric-card grids. Eligible, watch, overheated, risk, neutral, and insufficient-history rows should share the same table; the state remains visible through chips in the Signal column. Manual sorting belongs in table headers for Symbol, Rank, Signal, Action, Setup Type, Quality, and Price. Left-rail controls should change data scope or provide workflow utilities such as copy, export, and navigation, not duplicate row grouping as separate lists.

## Watchlist Rules

The Watchlist is a selected-symbol monitoring terminal. The selected-symbol table is primary; summary, attention, and backdrop context must stay compact and secondary. Use fixed terminal context where feasible so the command/status band remains visible during row review.

Watchlist command/status context should fit in one compact band on desktop when possible, combining source, visible/selected/found/missing/risk counts, and system actions with consistent terminal chip and button sizing.

The left rail should prioritize Symbols, Presets, and Filters. Import/export is a secondary collapsed affordance and must not dominate permanent rail space. Avoid generic "show more" overflow controls.

Watchlist sorting is a table-header behavior for Symbol, timeframe, Primary, and Attention columns. Do not place Sort controls in the left rail, and do not make Research or Remove sortable.

Research and Remove are system actions, not market states. Research uses blue system styling; Remove stays neutral with only light system hover treatment.

Follow strict Watchlist color semantics: green means healthy, eligible, or completed; red means risk, breakdown, or invalid; yellow means warning, hot, data gap, or needs attention; gray means neutral, missing, unavailable, or not returned; blue means system action, link, selected state, or active sort. The left rail is supporting control space; the selected-symbol table remains the main object. Watchlist is desktop-first, while mobile only needs basic no-broken-layout behavior.

## History Rules

History is a historical validation terminal, not a light report page. Use the dark terminal system, compact command/status context, and a controlled Recent Runs rail. Outcome Rows are the primary workspace; Outcome Summary, Selected Scan, and Validation Source context should stay compact. Original Scan Rows are secondary and should be collapsed, visually reduced, and loaded on demand rather than fetched on the initial page load. Details, raw metadata, maturity logic, and diagnostics stay collapsed. Avoid light report cards, workflow prose, and repeated caveats.

## Copy Rules

Use concise English UI copy. Prefer words like research, context, evidence, observation, state, quality, and check next.

Avoid financial advice language, hype, predictions, trading calls, and profit framing. Avoid direct execution language such as buy, sell, long, short, entry, exit, target, take profit, or stop loss in product UI unless documenting prohibited wording.

## Future UI Change Rules

New modules must justify their information priority. Do not add cards unless they reduce cognitive load or fit an established workspace role.

Prefer reorganizing existing information over adding new concepts. Preserve backend and data semantics unless a phase explicitly asks to change them.
