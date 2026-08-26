(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/components/accounting/accounting-nav.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AccountingNav",
    ()=>AccountingNav
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$providers$2f$auth$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/providers/auth-provider.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$constants$2f$permissions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/constants/permissions.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
const links = [
    [
        "Overview",
        "/accounting",
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$constants$2f$permissions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PERMISSIONS"].accountingRead
    ],
    [
        "Chart of Accounts",
        "/accounting/chart-of-accounts",
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$constants$2f$permissions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PERMISSIONS"].chartOfAccountsRead
    ],
    [
        "Journals",
        "/accounting/journals",
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$constants$2f$permissions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PERMISSIONS"].journalsRead
    ],
    [
        "Entries",
        "/accounting/journal-entries",
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$constants$2f$permissions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PERMISSIONS"].journalsRead
    ],
    [
        "General Ledger",
        "/accounting/general-ledger",
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$constants$2f$permissions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PERMISSIONS"].financialReportsRead
    ],
    [
        "Trial Balance",
        "/accounting/trial-balance",
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$constants$2f$permissions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PERMISSIONS"].financialReportsRead
    ],
    [
        "Profit & Loss",
        "/accounting/profit-loss",
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$constants$2f$permissions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PERMISSIONS"].financialReportsRead
    ],
    [
        "Balance Sheet",
        "/accounting/balance-sheet",
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$constants$2f$permissions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PERMISSIONS"].financialReportsRead
    ],
    [
        "Setup",
        "/accounting/settings",
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$constants$2f$permissions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PERMISSIONS"].accountingRead
    ]
];
function AccountingNav() {
    _s();
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"])();
    const { has } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$providers$2f$auth$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePermissions"])();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
        className: "flex gap-2 overflow-x-auto pb-1",
        "aria-label": "Accounting sections",
        children: links.filter(([, , permission])=>has(permission)).map(([label, href])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                asChild: true,
                variant: pathname === href ? "secondary" : "ghost",
                size: "sm",
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("shrink-0", pathname === href && "font-semibold"),
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                    href: href,
                    "aria-current": pathname === href ? "page" : undefined,
                    children: label
                }, void 0, false, {
                    fileName: "[project]/src/components/accounting/accounting-nav.tsx",
                    lineNumber: 32,
                    columnNumber: 11
                }, this)
            }, href, false, {
                fileName: "[project]/src/components/accounting/accounting-nav.tsx",
                lineNumber: 31,
                columnNumber: 9
            }, this))
    }, void 0, false, {
        fileName: "[project]/src/components/accounting/accounting-nav.tsx",
        lineNumber: 26,
        columnNumber: 5
    }, this);
}
_s(AccountingNav, "Ui1L3QbFI4ADToy9tOMtlMBql1s=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$providers$2f$auth$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePermissions"]
    ];
});
_c = AccountingNav;
var _c;
__turbopack_context__.k.register(_c, "AccountingNav");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_components_accounting_accounting-nav_tsx_1r8nkf3._.js.map