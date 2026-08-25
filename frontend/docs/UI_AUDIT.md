# Hotel ERP frontend audit

## 1. Current UI architecture

The frontend uses Next.js 16 App Router with protected server-rendered pages, a shared `AppShell`, permission-aware navigation, server-side list queries, and a local shadcn/Radix component layer. Domain components are grouped by hotel workflow (`front-desk`, `reservations`, `rooms`, `housekeeping`, `finance`, and management). This is a sound base and should be evolved rather than rewritten.

## 2. Current design inconsistencies

- Control heights ranged from 24px to 40px, making the action hierarchy difficult to scan and touch targets inconsistent.
- Cards, status indicators, and page sections mixed generic Tailwind colors with theme tokens.
- Navigation used compact rectangular rows while page actions used several unrelated radii.
- Page density varied by route; some pages felt spacious while operational tables were very compressed.
- Dark colors existed, but there was no user-facing theme control.

## 3. UX problems

- Mobile users had to open a drawer for every destination.
- Row actions were not consistently consolidated; rooms exposed several icon actions while reservations used a menu.
- Search/filter surfaces did not read as a distinct operational toolbar.
- The top app bar did not expose appearance settings, and the application did not persist a user theme.
- Several actions were below the recommended 44px touch target outside dense table contexts.

## 4. Components to reuse

`AppShell`, `PageHeader`, `ListToolbar`, `Pagination`, `EmptyState`, `StatusBadge`, Radix dialogs/menus/sheets, the table primitives, permission helpers, server services, forms, and domain-specific workflow components should remain. They already preserve backend contracts and accessibility behavior.

## 5. Components to refactor

The shared `Button`, `Input`, `Select`, `Card`, `Table`, navigation item, room card, status badge, and shell surfaces should consume the central Material-inspired tokens. Domain components should use these primitives rather than add local foundational colors or radii.

## 6. Components to remove

No working domain component needs removal. Repeated ad-hoc containers and inline action groups should be retired gradually as their pages move to shared cards, toolbars, menus, and responsive row patterns. The deleted legacy revenue overview should not be restored unless it presents actionable data.

## 7. Missing components

The main gaps are a persistent theme toggle, mobile primary navigation, tooltip coverage for icon-only actions, a reusable snackbar/live-region service, sortable table headers, and a reusable side-sheet filter pattern.

## 8. Accessibility issues

- Some controls were smaller than practical touch targets.
- Focus styles varied between primitives.
- Icon-only controls depend on every caller supplying an accessible name.
- Status colors were readable but not uniformly tokenized.
- Reduced-motion behavior was not defined globally.

The redesign adds a consistent focus ring, reduced-motion support, larger primary controls, text-plus-icon statuses, semantic navigation landmarks, and labeled theme/navigation actions.

## 9. Responsive issues

Tables generally overflow or convert to cards, which is appropriate, but the shell previously offered only a drawer on mobile. Page-header actions could also crowd narrow screens. The redesign adds a five-destination bottom navigation, safe-area padding, wrapping header actions, and preserves compact desktop tables.

## 10. Proposed Material 3 design architecture

The application uses a three-layer system:

1. Theme tokens in `globals.css` define color roles, surfaces, type families, shape, focus, elevation, and hotel semantic colors for light and dark themes.
2. Owned UI primitives translate those roles into filled, tonal, outlined, text, icon, field, card, menu, dialog, and data-table behavior.
3. Shared layout and domain components compose workflows without hardcoding foundational presentation.

Business logic, route structure, permission checks, DTOs, pagination, and API services remain unchanged.
