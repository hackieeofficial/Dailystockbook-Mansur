const fs = require('fs');
const path = require('path');

const walkSync = function(dir, filelist) {
  const files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = walkSync(path.join(dir, file), filelist);
    }
    else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        filelist.push(path.join(dir, file));
      }
    }
  });
  return filelist;
};

const map = {
  'â€¢': '•',
  'â,¹': '?',
  'â”€': '-',
  'â†’': '?',
  'âœ“': '?',
  'â€”': '—',
  'â€': ''
};

const files = walkSync('./src');
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let changed = false;
  for (const [bad, good] of Object.entries(map)) {
    if (content.includes(bad)) {
      content = content.split(bad).join(good);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(f, content, 'utf8');
    console.log('Fixed:', f);
  }
});
