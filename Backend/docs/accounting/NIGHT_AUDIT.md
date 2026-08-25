# Night Audit

Night Audit is not implemented in the foundation release. The current stay workflow creates aggregate room charges at checkout, not one earned room-night per business date.

The next implementation must add hotel business date, a unique hotel/reservation-room/business-date room posting key, validation stages, unresolved-folio reporting, cashier checks, and an atomic business-date advance. Re-running a completed date must return the existing result without creating another charge or journal entry.

No current endpoint should be represented as Night Audit, and no report fabricates daily room revenue before these postings exist.
