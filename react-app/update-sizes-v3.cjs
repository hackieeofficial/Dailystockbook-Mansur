const fs = require('fs');

const appFile = 'c:/dailystock/react-app/src/App.tsx';
let appCode = fs.readFileSync(appFile, 'utf8');

// Update variables in App.tsx
appCode = appCode.replace(/document\.body\.classList\.toggle\('blur-sensitive', prefs\.blurSensitiveData\);/g, '');
appCode = appCode.replace(
  /root\.style\.setProperty\('--user-font-title-mobile', `\$\{prefs\.mobileTitleSize\}px`\);[\s\S]*?root\.style\.setProperty\('--user-font-badge-desktop', `\$\{prefs\.desktopBadgeSize\}px`\);/g,
  `// Mobile Typography
      root.style.setProperty('--user-font-title-mobile', \`\${prefs.mobileTitleSize}px\`);
      root.style.setProperty('--user-font-category-mobile', \`\${prefs.mobileCategorySize}px\`);
      root.style.setProperty('--user-font-qty-mobile', \`\${prefs.mobileQtySize}px\`);
      root.style.setProperty('--user-font-qty-label-mobile', \`\${prefs.mobileQtyLabelSize}px\`);
      root.style.setProperty('--user-font-price-primary-mobile', \`\${prefs.mobilePricePrimarySize}px\`);
      root.style.setProperty('--user-font-price-secondary-mobile', \`\${prefs.mobilePriceSecondarySize}px\`);
      root.style.setProperty('--user-font-badge-mobile', \`\${prefs.mobileBadgeSize}px\`);
      root.style.setProperty('--user-font-meta-mobile', \`\${prefs.mobileMetaSize}px\`);
      
      // Desktop Typography
      root.style.setProperty('--user-font-title-desktop', \`\${prefs.desktopTitleSize}px\`);
      root.style.setProperty('--user-font-category-desktop', \`\${prefs.desktopCategorySize}px\`);
      root.style.setProperty('--user-font-qty-desktop', \`\${prefs.desktopQtySize}px\`);
      root.style.setProperty('--user-font-qty-label-desktop', \`\${prefs.desktopQtyLabelSize}px\`);
      root.style.setProperty('--user-font-price-primary-desktop', \`\${prefs.desktopPricePrimarySize}px\`);
      root.style.setProperty('--user-font-price-secondary-desktop', \`\${prefs.desktopPriceSecondarySize}px\`);
      root.style.setProperty('--user-font-badge-desktop', \`\${prefs.desktopBadgeSize}px\`);
      root.style.setProperty('--user-font-meta-desktop', \`\${prefs.desktopMetaSize}px\`);`
);

fs.writeFileSync(appFile, appCode);

// Update index.css
const indexCssFile = 'c:/dailystock/react-app/src/index.css';
let indexCss = fs.readFileSync(indexCssFile, 'utf8');

// Replace Typography Block
indexCss = indexCss.replace(
  /\/\* Desktop Typography \*\/[\s\S]*?\/\* Mobile Typography \*\/[\s\S]*?\.text-user-badge \{ font-size: var\(--user-font-badge-mobile, [0-9]+px\); \}\n  \}/g,
  `/* Desktop Typography */
  @media (min-width: 768px) {
    .text-user-title { font-size: var(--user-font-title-desktop, 14px); }
    .text-user-category { font-size: var(--user-font-category-desktop, 10px); }
    .text-user-qty { font-size: var(--user-font-qty-desktop, 16px); }
    .text-user-qty-label { font-size: var(--user-font-qty-label-desktop, 8px); }
    .text-user-price-primary { font-size: var(--user-font-price-primary-desktop, 12px); }
    .text-user-price-secondary { font-size: var(--user-font-price-secondary-desktop, 9px); }
    .text-user-badge { font-size: var(--user-font-badge-desktop, 10px); }
    .text-user-meta { font-size: var(--user-font-meta-desktop, 9px); }
  }

  /* Mobile Typography */
  @media (max-width: 767px) {
    .text-user-title { font-size: var(--user-font-title-mobile, 14px); }
    .text-user-category { font-size: var(--user-font-category-mobile, 10px); }
    .text-user-qty { font-size: var(--user-font-qty-mobile, 16px); }
    .text-user-qty-label { font-size: var(--user-font-qty-label-mobile, 8px); }
    .text-user-price-primary { font-size: var(--user-font-price-primary-mobile, 12px); }
    .text-user-price-secondary { font-size: var(--user-font-price-secondary-mobile, 9px); }
    .text-user-badge { font-size: var(--user-font-badge-mobile, 9px); }
    .text-user-meta { font-size: var(--user-font-meta-mobile, 9px); }
  }`
);

// Add data-font attributes to index.css
if (!indexCss.includes('body[data-font="Plus Jakarta Sans"]')) {
  indexCss += `
body[data-font="Plus Jakarta Sans"] { --font-sans: 'Plus Jakarta Sans', sans-serif; font-family: 'Plus Jakarta Sans', sans-serif; }
body[data-font="Inter"] { --font-sans: 'Inter', sans-serif; font-family: 'Inter', sans-serif; }
body[data-font="Roboto"] { --font-sans: 'Roboto', sans-serif; font-family: 'Roboto', sans-serif; }
body[data-font="Outfit"] { --font-sans: 'Outfit', sans-serif; font-family: 'Outfit', sans-serif; }
body[data-font="Quicksand"] { --font-sans: 'Quicksand', sans-serif; font-family: 'Quicksand', sans-serif; }
body[data-font="Poppins"] { --font-sans: 'Poppins', sans-serif; font-family: 'Poppins', sans-serif; }
  `;
}
fs.writeFileSync(indexCssFile, indexCss);

// Inject into React files
const filesToInject = [
  'c:/dailystock/react-app/src/features/Workspace/ReviewList.tsx',
  'c:/dailystock/react-app/src/features/Workspace/FinalList.tsx',
  'c:/dailystock/react-app/src/features/Workspace/DateReport.tsx',
  'c:/dailystock/react-app/src/features/ZeroStockView.tsx'
];

filesToInject.forEach(file => {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf8');

  // Categories (text-[10px] item.category)
  code = code.replace(/className="(.*?)text-\[10px\](.*?)>(.*?item\.category)/g, 'className="$1text-user-category$2>$3');

  // Qty labels (text-[8px] uppercase tracking-tighter)
  code = code.replace(/className="(.*?)text-\[8px\](.*?)>/g, 'className="$1text-user-qty-label$2>');

  // Secondary Prices (text-[9px] / ₹{item.mrp}) -> text-user-price-secondary
  // Example: <span className="text-[9px] text-slate-400 font-normal">/ {item.mrp
  code = code.replace(/className="text-\[9px\](.*?)">\/\s*\{item\.mrp/g, 'className="text-user-price-secondary $1">/ {item.mrp');

  // Primary Prices (text-user-price) -> text-user-price-primary
  code = code.replace(/text-user-price/g, 'text-user-price-primary');

  // Badges (text-[9px] font-black uppercase rounded)
  code = code.replace(/className="(.*?)text-\[9px\](.*?)uppercase rounded(.*?)>/g, 'className="$1text-user-badge$2uppercase rounded$3>');

  // Refilled tags (text-[9px] font-extrabold text-emerald-900 bg-emerald-200)
  code = code.replace(/className="(.*?)text-\[9px\](.*?)bg-emerald-200(.*?)>/g, 'className="$1text-user-badge$2bg-emerald-200$3>');

  // `#01` tag (text-[11px] font-black text-emerald-700) -> make it text-user-badge
  code = code.replace(/className="(.*?)text-\[11px\](.*?)font-black text-emerald-700(.*?)>/g, 'className="$1text-user-badge$2font-black text-emerald-700$3>');

  // Meta (text-[9px] ... item.refillBy) -> text-user-meta
  code = code.replace(/className="(.*?)text-\[9px\](.*?mt-1.*?)>/g, 'className="$1text-user-meta$2>');

  fs.writeFileSync(file, code);
  console.log('Updated ' + file);
});
