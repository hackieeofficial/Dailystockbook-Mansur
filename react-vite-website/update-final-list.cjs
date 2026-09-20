const fs = require('fs');

const path = 'c:/dailystock/react-app/src/features/Workspace/FinalList.tsx';
let code = fs.readFileSync(path, 'utf8');

// Title
code = code.replace(
  'text-sm font-black text-slate-950 leading-snug tracking-tight',
  'text-user-title font-black text-slate-950 leading-snug tracking-tight'
);

// Opening
code = code.replace(
  'font-semibold text-slate-800 text-xs',
  'font-semibold text-slate-800 text-user-qty'
);

// PUR, SOLD, BAL quantities (3 occurrences)
code = code.replace(
  /<span className="font-bold text-slate-800 text-xs leading-none">\{item\.purQty > 0/g,
  '<span className="font-bold text-slate-800 text-user-qty leading-none">{item.purQty > 0'
);
code = code.replace(
  /<span className="font-bold text-slate-800 text-xs leading-none">\{item\.soldQty\}/g,
  '<span className="font-bold text-slate-800 text-user-qty leading-none">{item.soldQty}'
);
code = code.replace(
  /<span className="font-bold text-slate-800 text-xs leading-none">\{item\.balanceQty\}/g,
  '<span className="font-bold text-slate-800 text-user-qty leading-none">{item.balanceQty}'
);

// Prices
code = code.replace(
  '<span className="text-[11px] font-bold font-mono text-slate-400 line-through">₹{item.mrp}</span>',
  '<span className="text-user-price font-bold font-mono text-slate-400 line-through">₹{item.mrp}</span>'
);
code = code.replace(
  '<span className="text-[11px] font-black font-mono text-slate-900 ml-1">₹{item.saleRate}</span>',
  '<span className="text-user-price font-black font-mono text-slate-900 ml-1">₹{item.saleRate}</span>'
);

fs.writeFileSync(path, code, 'utf8');
console.log('FinalList updated.');
