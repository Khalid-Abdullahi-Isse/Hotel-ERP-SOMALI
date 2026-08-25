# Hudheel Hotel ERP design system

## Visual direction

Hudheel is calm, operational, and hospitality-specific. Blue communicates the primary operating state, teal supports positive hotel actions, and warm semantic colors are reserved for cleaning, maintenance, balances, and risk. Surfaces create hierarchy without heavy borders or decorative gradients.

## Color roles

- `background`: application canvas
- `surface`: app bar, cards, menus, and dialogs
- `surface-container-low`: toolbars and subtle grouped content
- `surface-container`: neutral selected or supporting content
- `surface-container-high`: stronger hover and nested hierarchy
- `primary` / `primary-foreground`: the single dominant action
- `secondary` / `secondary-foreground`: tonal actions and selected navigation
- `outline-variant`: quiet separators and container edges
- `destructive`: destructive actions and errors only
- Hotel status roles: available, occupied, reserved, dirty, cleaning, maintenance, and out of service

Every status includes readable text and an icon; color is never the only signal. Light and dark themes use separate surface hierarchies rather than inversion.

## Typography

Roboto is self-hosted through `next/font` for interface text. Geist Mono is reserved for booking IDs, room identifiers, and machine-oriented values. Page titles are 28–30px, section titles 20–24px, card titles 16px, body text 14–16px, and labels 12–14px. Weights are primarily 400, 500, and 600.

## Spacing and density

The layout follows a 4px base with primary 8px rhythm: 4, 8, 12, 16, 20, 24, 32, 40, 48, and 64px. Forms and page actions use comfortable density. Operational tables use 44px headers and 48px rows to balance scan speed with accessibility.

## Shape

- Inputs: 12px
- Cards and panels: 16px
- Menus: 12px
- Dialogs and sheets: 20–24px
- Buttons, chips, selected navigation, and icon states: pill

## Elevation

Elevation communicates stacking only. Cards use a very subtle level-1 shadow plus outline. Menus use level 2. Dialogs and sheets use level 3. Tonal surface changes are preferred to stronger shadows.

## Actions

- Filled: one primary action per region, 40px default / 48px prominent
- Tonal (`secondary`): important secondary action
- Outlined: secondary utilities such as export and filters
- Text (`ghost` or `link`): tertiary and navigation actions
- Icon: 40px default with an accessible name; 32–36px is permitted inside dense tables
- Destructive: destructive actions only and separated in menus/dialogs

Buttons expose hover, focus-visible, pressed, disabled, invalid, and `aria-busy` states. Loading actions must set `aria-busy` and prevent duplicate submission.

## Fields

Inputs and selects are 44px, use outlined containers, keep labels visible, and display validation adjacent to the affected field. Search uses a leading search icon, descriptive placeholder, debounced server query, and clear action.

## Cards and metrics

Cards group related information; they are not used for decoration. Metric cards use neutral surfaces and semantic accents only for changes or attention. Room cards prioritize room number, status, guest, stay timing, housekeeping state, balance, then action.

## Tables and pagination

Tables use a sticky tonal header, dense rows, tabular numeric alignment, row hover/focus state, and consolidated action menus. On mobile, priority content becomes a readable card row or the table scrolls when column comparison is essential. Pagination remains server-side.

## Navigation

Desktop uses a 264px expanded rail and 80px collapsed rail. Selected destinations use a tonal pill. Mobile uses Dashboard, Front Desk, Reservations, Rooms, and More in bottom navigation; More opens the complete permission-aware drawer.

## Feedback and states

Every data region must provide localized loading, empty, error, disabled, no-permission, and success feedback. Mutations update the affected region and announce success or failure through a snackbar/live region. Destructive actions require an alert dialog; normal actions do not.

## Motion

State transitions use 120–220ms durations. Navigation width changes use 200ms. Motion never shifts operational content dramatically. `prefers-reduced-motion` reduces all animation and smooth scrolling.

## Breakpoints

- Mobile: 320–639px
- Tablet: 640–1023px
- Laptop: 1024–1279px
- Desktop: 1280–1599px
- Large desktop: 1600px+

The content frame caps at 1600px and preserves moderate enterprise density on wide screens.
