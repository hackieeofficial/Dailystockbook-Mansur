const sharp = require('sharp');
const fs = require('fs');

async function generate() {
  const svgBuffer = fs.readFileSync('./public/favicon.svg');
  
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile('./public/pwa-192x192.png');
    
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile('./public/pwa-512x512.png');
    
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile('./public/pwa-512x512-maskable.png'); // usually needs padding but we'll use same

  console.log("Icons generated.");
}

generate().catch(console.error);
