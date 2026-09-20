const fs = require('fs');

const dateReportPath = 'c:/dailystock/react-app/src/features/Workspace/DateReport.tsx';
let dCode = fs.readFileSync(dateReportPath, 'utf8');

dCode = dCode.replace(
  'h2 className="text-sm font-black text-slate-900 tracking-tight leading-snug uppercase"',
  'h2 className="text-user-title font-black text-slate-900 tracking-tight leading-snug uppercase"'
);
dCode = dCode.replace(
  'span className="text-[11px] font-black text-slate-800 border border-slate-200 px-2 py-0.5 rounded"',
  'span className="text-user-qty font-black text-slate-800 border border-slate-200 px-2 py-0.5 rounded"'
);
fs.writeFileSync(dateReportPath, dCode, 'utf8');
console.log('DateReport updated.');

const reportsViewPath = 'c:/dailystock/react-app/src/features/ReportsView.tsx';
let rCode = fs.readFileSync(reportsViewPath, 'utf8');

rCode = rCode.replace(
  /<h2 className="text-sm font-bold text-slate-700 uppercase break-words/g,
  '<h2 className="text-user-title font-bold text-slate-700 uppercase break-words'
);
rCode = rCode.replace(
  /<h2 className="text-sm font-black text-slate-900 uppercase break-words/g,
  '<h2 className="text-user-title font-black text-slate-900 uppercase break-words'
);
fs.writeFileSync(reportsViewPath, rCode, 'utf8');
console.log('ReportsView updated.');
