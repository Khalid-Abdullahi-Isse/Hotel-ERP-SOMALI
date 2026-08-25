# Accounting Security

Accounting access uses the existing permission guard. Added permissions are `accounting.view`, `accounting.manage`, `chart_of_accounts.view`, `chart_of_accounts.manage`, `journal.view`, `journal.post`, `journal.reverse`, and `financial_reports.view`.

Administrators receive all accounting permissions. The system Manager role receives view/report permissions but not configuration, manual posting, or reversal permissions. Staff receives none by default. Custom roles can be configured through the existing role-permission system.

Every query is scoped by the authenticated user's hotel. Cross-hotel parents, mappings, journal relationships, users, and journal lines are also rejected by PostgreSQL triggers.

Account/journal/settings changes and journal draft, post, reversal, and event operations write audit entries. Posted rows cannot be updated or deleted at the database layer.

Report generation returns a report ID, hotel identity, currency, period, status, and generation time. PDF authorization will use `financial_reports.view` when PDF generation is added.
