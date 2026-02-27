# Accounting UI Modernization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Modernize 4 accounting UI sections (Dashboard, Diagnostic Financier, TVA, Tax Estimation) with dark glassmorphism theme matching CashPilot DNA, fix NaN% TVA bug, add detail to all sections.

**Architecture:** Convert all light-themed components to dark theme using existing pattern (bg-gray-900, border-gray-800, text-gray-100/400). Add PieChart/AreaChart imports from Recharts. Fix data format mismatch in VATBreakdown.

**Tech Stack:** React 18, Recharts, Tailwind CSS, Lucide icons

---

### Task 1: Fix VATBreakdown Data Format Bug

**Files:**
- Modify: `src/utils/accountingCalculations.js:498-525`

The `calculateVATBreakdownFromEntries` function returns `{account, name, vat}` but `VATDeclaration.jsx` expects `{rate, base, vat}`. Add `rate` and `base` fields.

**Code:**

In `calculateVATBreakdownFromEntries`, change the output/input accumulation objects to include `rate` and `base`:

```js
// Line 511: Change from:
if (!outputByAccount[key]) outputByAccount[key] = { account: key, name: accountMap[key]?.account_name || key, vat: 0 };
outputByAccount[key].vat += (parseFloat(e.credit) || 0) - (parseFloat(e.debit) || 0);

// To:
if (!outputByAccount[key]) outputByAccount[key] = { account: key, name: accountMap[key]?.account_name || key, vat: 0, base: 0, rate: 0 };
const creditAmt = (parseFloat(e.credit) || 0) - (parseFloat(e.debit) || 0);
outputByAccount[key].vat += creditAmt;
```

Same for inputByAccount:
```js
if (!inputByAccount[key]) inputByAccount[key] = { account: key, name: accountMap[key]?.account_name || key, vat: 0, base: 0, rate: 0 };
const debitAmt = (parseFloat(e.debit) || 0) - (parseFloat(e.credit) || 0);
inputByAccount[key].vat += debitAmt;
```

After the loop, calculate rate and base for each entry:
```js
// Before the return statement, compute base and rate
Object.values(outputByAccount).forEach(v => {
  // Common VAT rates: try to infer from account name or use 19.25% default (OHADA)
  const inferredRate = v.name.includes('18') ? 0.18 : v.name.includes('19.25') ? 0.1925 : 0.1925;
  v.rate = inferredRate;
  v.base = v.vat / inferredRate;
});
Object.values(inputByAccount).forEach(v => {
  const inferredRate = v.name.includes('18') ? 0.18 : v.name.includes('19.25') ? 0.1925 : 0.1925;
  v.rate = inferredRate;
  v.base = v.vat / inferredRate;
});
```

### Task 2: Modernize AccountingDashboard

**Files:**
- Modify: `src/components/accounting/AccountingDashboard.jsx`

Add AreaChart for net income trend alongside the existing BarChart. Use 2-column layout with rounded bars and max-width. Add gradient fills with `<defs>` in SVG.

### Task 3: Dark Theme FinancialDiagnostic Wrapper

**Files:**
- Modify: `src/components/accounting/FinancialDiagnostic.jsx`

Convert all light theme classes to dark:
- `bg-gradient-to-r from-blue-50 to-indigo-50` → `bg-gradient-to-br from-[#0f1528] to-[#141c33] border border-gray-800`
- `bg-white` → `bg-gray-900/50 border-gray-800`
- `text-gray-900` → `text-gray-100`
- `text-gray-500` → `text-gray-400`
- `text-gray-600` → `text-gray-400`
- Section separators: `border-gray-200` → `border-gray-800`
- Footer: `bg-gray-50` → `bg-gray-900/50 border-gray-800`

### Task 4: Dark Theme MarginAnalysisSection

**Files:**
- Modify: `src/components/accounting/MarginAnalysisSection.jsx`

Convert MetricCard and progress bars:
- `hover:shadow-md` → `bg-gray-900/50 border border-gray-800`
- `bg-blue-50` icon bg → `bg-gray-800`
- `text-gray-600` → `text-gray-400`
- `text-gray-900` → `text-gray-100`
- Progress bar track: `bg-gray-200` → `bg-gray-700`
- Alert boxes: `bg-yellow-50 border-yellow-200` → `bg-yellow-500/10 border-yellow-500/30`
- `text-yellow-800` → `text-yellow-400`
- `bg-red-50 border-red-200` → `bg-red-500/10 border-red-500/30`
- `text-red-800` → `text-red-400`
- Section header: `text-gray-900` → `text-gray-100`
- Analysis card: default Card → `bg-gray-900/50 border border-gray-800`
- `text-gray-700` → `text-gray-300`
- Indicators: `text-gray-500` → `text-gray-400`
- Border: `border-t` → `border-t border-gray-800`

### Task 5: Dark Theme FinancingAnalysisSection

**Files:**
- Modify: `src/components/accounting/FinancingAnalysisSection.jsx`

Convert FinanceMetricCard and recommendations:
- `hover:shadow-md` → `bg-gray-900/50 border border-gray-800`
- `bg-purple-50` icon bg → `bg-gray-800`
- `text-gray-600` → `text-gray-400`
- `text-gray-900` → `text-gray-100`
- Badge colors: `bg-gray-100 text-gray-700` → `bg-gray-700 text-gray-300`
- `bg-green-100 text-green-700` → `bg-green-500/20 text-green-400`
- `bg-orange-100 text-orange-700` → `bg-orange-500/20 text-orange-400`
- Cards without explicit bg → `bg-gray-900/50 border border-gray-800`
- Progress bars: `bg-green-200` / `bg-red-200` → `bg-gray-700`
- `text-gray-700` → `text-gray-300`
- Recommendations: `bg-red-50 border-red-200 text-red-800` → `bg-red-500/10 border-red-500/30 text-red-400`
- `bg-orange-50 border-orange-200 text-orange-800` → `bg-orange-500/10 border-orange-500/30 text-orange-400`
- `bg-yellow-50 border-yellow-200 text-yellow-800` → `bg-yellow-500/10 border-yellow-500/30 text-yellow-400`
- `bg-green-50 border-green-200 text-green-800` → `bg-green-500/10 border-green-500/30 text-green-400`

### Task 6: Dark Theme KeyRatiosSection + RatioGauge

**Files:**
- Modify: `src/components/accounting/KeyRatiosSection.jsx`
- Modify: `src/components/accounting/RatioGauge.jsx`

KeyRatiosSection:
- Section header: `text-gray-900` → `text-gray-100`
- Cards: default → `bg-gray-900/50 border border-gray-800`
- Tables: `bg-gray-50` thead → `bg-gray-800`
- `text-gray-500` headers → `text-gray-400`
- `divide-gray-200` → `divide-gray-800`
- Table cells text: add `text-gray-300` for values
- `bg-blue-50 text-blue-800` explanations → `bg-blue-500/10 text-blue-400`
- `bg-gray-50` analysis → `bg-gray-800`
- `text-gray-700` → `text-gray-300`
- `bg-purple-50` icon bg → `bg-gray-800`
- `text-purple-600` icon → `text-purple-400`
- Autonomie card: `bg-red-200` → `bg-gray-700`
- Badge colors: `bg-green-100 text-green-800` → `bg-green-500/20 text-green-400` etc
- `bg-orange-50 border-orange-200 text-orange-800` → dark pattern
- `bg-green-50 border-green-200 text-green-800` → dark pattern

RatioGauge:
- `hover:shadow-md` → `bg-gray-900/50 border border-gray-800`
- `text-gray-600` → `text-gray-400`
- `text-gray-900` value → `text-gray-100`
- `bg-gray-200` gauge track → `bg-gray-700`
- Badge: `bg-green-100 text-green-800` → `bg-green-500/20 text-green-400`
- `bg-yellow-100 text-yellow-800` → `bg-yellow-500/20 text-yellow-400`
- `bg-red-100 text-red-800` → `bg-red-500/20 text-red-400`
- Trend icons: `text-green-600` → `text-green-400`, etc
- Reference text: `text-gray-400` stays

### Task 7: Modernize VATDeclaration

**Files:**
- Modify: `src/components/accounting/VATDeclaration.jsx`

1. Add PieChart imports from Recharts
2. Replace `revenue * 0.2` estimate with real VAT data from entries
3. Show account code in breakdown detail instead of just rate
4. Add donut chart for VAT breakdown distribution
5. Add stacked bars for monthly chart
6. Adapt display to handle both legacy (`rate`/`base`) and entry-based (`account`/`name`) formats

### Task 8: Modernize TaxEstimation

**Files:**
- Modify: `src/components/accounting/TaxEstimation.jsx`

1. Add PieChart from Recharts for bracket distribution donut
2. Add waterfall-style breakdown visualization
3. Add effective rate progress bar
4. Add quarterly payment Q1-Q4 cards with due dates
5. Enhance detail section with visual indicators

### Task 9: Build and Verify

Run `npm run build` to verify no errors. Test all tabs visually.
