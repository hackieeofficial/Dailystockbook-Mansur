const fs = require('fs');

const files = [
  'c:/dailystock/react-app/src/features/Workspace/ReviewList.tsx',
  'c:/dailystock/react-app/src/features/ZeroStockView.tsx',
  'c:/dailystock/react-app/src/features/Workspace/FinalList.tsx',
  'c:/dailystock/react-app/src/features/Workspace/DateReport.tsx',
  'c:/dailystock/react-app/src/features/ReportsView.tsx'
];

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let code = fs.readFileSync(f, 'utf8');
  let originalCode = code;

  // Title: item.code or task.code
  code = code.replace(/(className="[^"]*)(text-\[11px\]|text-xs)([^"]*"\s*>\{?(?:item|task)\.code\}?)/g, "$1text-user-title$3");

  // Qty: item.opening, item.purQty, item.soldQty, item.balanceQty
  code = code.replace(/(className="[^"]*)(text-\[11px\]|text-xs)([^"]*"\s*>\{?item\.(?:opening|purQty|soldQty|balanceQty)\}?)/g, "$1text-user-qty$3");
  // Special case purQty > 0 logic
  code = code.replace(/(className="[^"]*)(text-\[11px\]|text-xs)([^"]*"\s*>\{item\.purQty > 0)/g, "$1text-user-qty$3");

  // Price: item.mrp, item.saleRate
  code = code.replace(/(className="[^"]*)(text-\[11px\]|text-xs)([^"]*"\s*>₹\{?item\.(?:mrp|saleRate)\}?)/g, "$1text-user-price$3");
  
  // DateReport specific: item.product_name, item.opening, item.in, item.out, item.closing, item.mrp, item.sale_rate
  code = code.replace(/(className="[^"]*)(text-\[11px\]|text-xs)([^"]*"\s*>\{?item\.product_name\}?)/g, "$1text-user-title$3");
  code = code.replace(/(className="[^"]*)(text-\[11px\]|text-xs)([^"]*"\s*>\{?item\.(?:opening|in|out|closing)\}?)/g, "$1text-user-qty$3");
  code = code.replace(/(className="[^"]*)(text-\[11px\]|text-xs)([^"]*"\s*>₹\{?item\.(?:mrp|sale_rate)\}?)/g, "$1text-user-price$3");

  if (code !== originalCode) {
    fs.writeFileSync(f, code, 'utf8');
    console.log(`Updated ${f}`);
  }
});
