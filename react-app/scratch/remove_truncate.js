const fs = require('fs');
const files = [
  'src/features/ReportsView.tsx',
  'src/features/ZeroStockView.tsx',
  'src/features/Workspace/FinalList.tsx',
  'src/features/Workspace/ReviewList.tsx',
  'src/features/Workspace/DateReport.tsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace truncate on h2/h3 titles to allow multi-line wrap
  content = content.replace(/\btruncate\b/g, 'break-words whitespace-normal');
  
  fs.writeFileSync(file, content);
  console.log('Fixed ' + file);
});
