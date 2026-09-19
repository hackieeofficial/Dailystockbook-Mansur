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

  // PRODUCT NAME (text-[11px] or text-xs on {item.code})
  code = code.replace(/text-\[11px\]([^>]*\>\{item\.code\})/g, "text-user-title$1");
  code = code.replace(/text-xs([^>]*\>\{item\.code\})/g, "text-user-title$1");
  // Also FinalList uses item.code
  code = code.replace(/text-xs([^>]*\>\{task\.code\})/g, "text-user-title$1");

  // QTY (text-[11px] or text-xs on opening, purQty, soldQty, balanceQty)
  // ReviewList & FinalList & ZeroStockView
  code = code.replace(/text-xs([^>]*\>\{item\.opening\})/g, "text-user-qty$1");
  code = code.replace(/text-xs([^>]*\>\{item\.purQty\})/g, "text-user-qty$1");
  code = code.replace(/text-xs([^>]*\>\{item\.soldQty\})/g, "text-user-qty$1");
  code = code.replace(/text-xs([^>]*\>\{item\.balanceQty\})/g, "text-user-qty$1");
  code = code.replace(/text-xs([^>]*\>\{item\.purQty > 0 \? `\+\$\{item\.purQty\}` : '-'\})/g, "text-user-qty$1");

  // PRICE (text-[11px] or text-xs on mrp, saleRate)
  code = code.replace(/text-xs([^>]*\>₹\{item\.mrp\})/g, "text-user-price$1");
  code = code.replace(/text-xs([^>]*\>₹\{item\.saleRate\})/g, "text-user-price$1");

  if (code !== originalCode) {
    fs.writeFileSync(f, code, 'utf8');
    console.log(`Updated ${f}`);
  }
});
