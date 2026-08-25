# Hudheel frontend audit and design architecture

## Audit summary

- **Architecture:** Next.js 16 App Router with server-rendered pages, client islands for mutations and filters, typed service adapters, React Query, React Hook Form, Zod, Tailwind CSS 4, and Radix/shadcn primitives.
- **Strengths preserved:** authentication and permission gates, API contracts, server pagination, formatting helpers, check-in workflow, route error/loading boundaries, and backend-driven data.
- **Visual issues found:** competing brand colors, feature-level status colors, mixed density and radii, overly rounded primary controls, repeated icon containers, and too many equally weighted cards.
- **UX issues found:** database-oriented navigation, Floors and Room Types as top-level destinations, settings split across unrelated destinations, and inconsistent action density in tables.
- **Accessibility issues found:** collapsed navigation depended on native titles, row actions were not consistently grouped, and search did not announce pending navigation.
- **Responsive issues found:** the shell had a useful mobile drawer and bottom bar, but page-level table adaptation varied by feature.

## Hudheel design language

- Primary: `#0067B8`
- Primary container: `#D9ECFF`
- Background: `#F6F8FB`
- Surface: `#FFFFFF`
- Surface container: `#F1F5F9`
- Surface high: `#E8EEF5`
- Text primary: `#172033`
- Text secondary: `#667085`
- Outline: `#D7DEE8`
- Typography: Roboto, Inter, system UI fallback; restrained 12–30px product scale.
- Shape: 4px to 24px scale; 10px controls, 12px operational cards, pills reserved for chips.
- Motion: 150ms hover, 180ms controls, 200ms disclosure, 220ms dialogs, 240ms sidebar.
- Signature: a 3px Hudheel blue rail marks selected destinations and settings sections.
- Status: semantic tokens for availability, occupancy, reservation, cleaning, maintenance, payment, pending, partial, failure, and refund states. Text accompanies every color.

## Information architecture

1. Dashboard
2. Operations: Front Desk, Reservations, Calendar, Guests
3. Property: Rooms, Property Setup → Floors and Room Types
4. Services: Housekeeping, Maintenance, Guest Services
5. Finance: Accounting, Payments, Invoices, Expenses
6. Management: Reports, Audit Logs
7. Help & Support, Settings, user profile

## Shared patterns

- `AppShell`, workflow navigation, mobile drawer, and five-destination mobile bar
- `PageHeader` and `SectionHeader`
- filled, tonal, outlined, text/ghost, destructive, and icon button hierarchy
- semantic `StatusChip` adapters for room, reservation, payment, and transaction states
- dense table primitives, mobile record layouts, debounced list toolbar, and server pagination
- localized loading, empty, permission, server-unavailable, and form error states

## Implementation phases completed

1. Audit
2. Design tokens and semantic roles
3. Core control and status primitives
4. Application shell and information architecture
5. Dashboard, Front Desk, reservations, rooms, check-in, and authentication refinement
6. Finance/status and settings consistency
7. Responsive and accessibility pass
8. Type, lint, unit, production-build, and browser verification
