import * as pdfjsLib from 'pdfjs-dist';
import type { ExtractedItem } from '../types';
import { useAppStore } from '../store/useAppStore';

// Configure the worker using local build to prevent API version mismatch
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

/**
 * Extract product rows from a loaded PDF document.
 * Uses X/Y coordinate mapping to handle multi-line text and empty cells.
 */
export async function extractDataFromPDF(file: File): Promise<{ dateStr: string; items: ExtractedItem[]; srRowsSeen: number }> {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.onload = async function () {
      try {
        const typedarray = new Uint8Array(this.result as ArrayBuffer);
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        const result = await processPDFProxy(pdf);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    fileReader.onerror = () => reject(new Error('Failed to read file.'));
    fileReader.readAsArrayBuffer(file);
  });
}

function parseAccountingNumber(text: string): number {
  let cln = text.replace(/,/g, '').trim();
  let isNegative = false;
  if (cln.startsWith('(') && cln.endsWith(')')) {
    isNegative = true;
    cln = cln.slice(1, -1);
  } else if (cln.endsWith('-')) {
    isNegative = true;
    cln = cln.slice(0, -1);
  } else if (cln.startsWith('-')) {
    isNegative = true;
    cln = cln.slice(1);
  }
  const val = parseFloat(cln);
  return isNaN(val) ? NaN : (isNegative ? -val : val);
}

async function processPDFProxy(pdf: pdfjsLib.PDFDocumentProxy): Promise<{ dateStr: string; items: ExtractedItem[]; srRowsSeen: number }> {
  const items: any[] = [];
  let fullText = '';

  // -- Step 1: Collect all text items with their coordinates --
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    textContent.items.forEach((item: any) => {
      const str = item.str.trim();
      if (str !== '') {
        items.push({
          text: str,
          x: Math.round(item.transform[4]),
          y: Math.round(item.transform[5]),
          page: i
        });
        fullText += str + ' ';
      }
    });
  }

  // -- Step 2: Extract report date from PDF header ------------
  let reportDate: string | null = null;
  
  // Reject multi-day reports to prevent data corruption
  if (/(?:From|Period)\s+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s+to\s+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/i.test(fullText)) {
    throw new Error("Multi-day reports are not supported. Please generate and upload a report for a single date only.");
  }

  const dateMatch = fullText.match(/(?:From|Date|Stock Date|Period|As on|Dated)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i);
  if (dateMatch) {
    const rawDate = dateMatch[1].replace(/-/g, '/');
    const [d, m, y] = rawDate.split('/');
    reportDate = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  } else {
    for (let i = 0; i < Math.min(items.length, 250); i++) {
      const m = items[i].text.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/);
      if (m) {
        const rawDate = m[1].replace(/-/g, '/');
        const [d, mo, y] = rawDate.split('/');
        reportDate = `${String(d).padStart(2, '0')}/${String(mo).padStart(2, '0')}/${y}`;
        break;
      }
    }
  }

  if (!reportDate) {
    throw new Error("Could not detect date (e.g. 'From DD/MM/YYYY') in PDF header.");
  }

  // -- Step 3: Sort items top-to-bottom, left-to-right -------
  items.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > 5) return yDiff;
    return a.x - b.x;
  });

  // -- Step 4: Dynamically locate column X-positions ---------
  const cols = { sr: 20, prod: 60, opening: 9999, pur: 9999, sold: 9999, mrp: 9999, rate: 9999, bal: 9999 };

  items.forEach(item => {
    const t = item.text.toLowerCase().trim();
    if (t === 'sr.' || t === 'sr' || t === 's.no' || t === 'sl no' || t === 'sl.no') cols.sr = item.x;
    if (t === 'product' || t === 'item' || t === 'particulars' || t === 'description') cols.prod = item.x;
    if (t === 'opening' || t === 'opn' || t === 'op.qty' || t === 'op qty' || t === 'open') cols.opening = item.x;
    if (t === 'pur qty' || t === 'pur' || t === 'purchase' || t === 'pur.qty' ||
        t === 'p.qty' || t.includes('pur qty') || t.includes('purchase')) cols.pur = item.x;
    if (t.includes('sold qty') || t === 'sold' || t === 'sale' || t === 'sale qty' || t === 'sales') cols.sold = item.x;
    if (t === 'mrp') cols.mrp = item.x;
    if (t === 'rate' || t === 's.rate' || t === 'sell rate' ||
        t.includes('sale rate') || t.includes('sell rate')) cols.rate = item.x;
    if (t.includes('balance') || t === 'bal' || t === 'closing' || t === 'cl.qty' || t === 'cl qty' || t === 'close') cols.bal = item.x;
  });

  // -- Step 5: Parse rows using column positions --------------
  const extractedProducts: ExtractedItem[] = [];
  let currentBrand = 'Unknown Brand';
  let activeProduct: any = null;
  let srRowsSeen = 0;

  const appStore = useAppStore.getState();
  const productMaster = appStore.productMaster;
  const configuredGodowns = appStore.configuredGodowns;

  function pushActiveProduct() {
    if (activeProduct && activeProduct.nameLines.length > 0) {
      const pCode = activeProduct.nameLines[0] || '';
      const pCategory = activeProduct.nameLines.slice(1).join(' ') || '';
      const prodKey = `${activeProduct.brand}_${pCode}`.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      const memory = productMaster[prodKey];

      extractedProducts.push({
        id: prodKey,
        brand: activeProduct.brand,
        code: pCode,
        category: pCategory,
        opening: activeProduct.opening,
        purQty: activeProduct.pur,
        soldQty: activeProduct.sold,
        mrp: activeProduct.mrp,
        saleRate: activeProduct.rate,
        balanceQty: activeProduct.bal,
        godown: (memory && configuredGodowns.includes(memory.godown)) ? memory.godown : '',
        isLearned: !!memory,
        processed: false,
        decisionType: null,
        refillStatus: null
      });
    }
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const text = item.text;
    const lowerText = text.toLowerCase();

    const brandMatch = text.match(/^\s*brand\b\s*:?\s*(.*)$/i);
    const isBrandRow = brandMatch && (text.match(/^\s*brand\b\s*:/i) || brandMatch[1].trim() === '');
    if (isBrandRow) {
      const rest = (brandMatch[1] || '').trim();
      if (rest !== '') {
        currentBrand = rest;
      } else if (i + 1 < items.length && Math.abs(items[i + 1].y - item.y) < 15) {
        currentBrand = items[i + 1].text.trim();
        i++;
      }
      continue;
    }

    if (lowerText.includes('total') || lowerText.includes('page ') ||
        lowerText.includes('print date') || lowerText.includes('mansur')) {
      pushActiveProduct();
      activeProduct = null;
      continue;
    }

    if (Math.abs(item.x - cols.sr) < 20 && /^\d+$/.test(text)) {
      pushActiveProduct();
      activeProduct = { brand: currentBrand, nameLines: [], opening: 0, pur: 0, sold: 0, mrp: 0, rate: 0, bal: 0 };
      srRowsSeen++;
      continue;
    }

    if (activeProduct) {
      if (item.x > cols.sr + 20 && item.x < cols.opening - 20) {
        if (activeProduct.lastY && Math.abs(activeProduct.lastY - item.y) > 8) {
          activeProduct.nameLines.push(text);
        } else {
          if (activeProduct.nameLines.length === 0) activeProduct.nameLines.push(text);
          else activeProduct.nameLines[activeProduct.nameLines.length - 1] += ' ' + text;
        }
        activeProduct.lastY = item.y;
      } else if (Math.abs(item.x - cols.opening) < 30 && !isNaN(parseAccountingNumber(text))) {
        activeProduct.opening = parseAccountingNumber(text) || 0;
      } else if (cols.pur < 9000 && Math.abs(item.x - cols.pur) < 30 && !isNaN(parseAccountingNumber(text))) {
        activeProduct.pur = parseAccountingNumber(text) || 0;
      } else if (Math.abs(item.x - cols.sold) < 30 && !isNaN(parseAccountingNumber(text))) {
        activeProduct.sold = parseAccountingNumber(text) || 0;
      } else if (Math.abs(item.x - cols.mrp) < 30 && !isNaN(parseAccountingNumber(text))) {
        activeProduct.mrp = parseAccountingNumber(text) || 0;
      } else if (Math.abs(item.x - cols.rate) < 40 && !isNaN(parseAccountingNumber(text))) {
        activeProduct.rate = parseAccountingNumber(text) || 0;
      } else if (Math.abs(item.x - cols.bal) < 30 && !isNaN(parseAccountingNumber(text))) {
        activeProduct.bal = parseAccountingNumber(text) || 0;
      }
    }
  }

  pushActiveProduct();

  return {
    dateStr: reportDate,
    items: extractedProducts,
    srRowsSeen
  };
}

export function saveExtractedPDFToStore(dateStr: string, extractedProducts: ExtractedItem[]) {
  const appStore = useAppStore.getState();
  const currentReport = appStore.dailyReports[dateStr];

  if (!currentReport) {
    appStore.updateDailyReport(dateStr, {
      extracted: extractedProducts,
      final: [],
      tombstones: {},
      _by: 'react-v1',
      _at: Date.now()
    });
  } else {
    // Merge without overwriting processed items
    const updatedExtracted = [...currentReport.extracted];
    extractedProducts.forEach(newProd => {
      const existingIdx = updatedExtracted.findIndex(e => e.id === newProd.id);
      if (existingIdx === -1) {
        updatedExtracted.push(newProd);
      } else {
        const existing = updatedExtracted[existingIdx];
        if (!existing.processed) {
          updatedExtracted[existingIdx] = {
            ...existing,
            opening: newProd.opening,
            purQty: newProd.purQty,
            soldQty: newProd.soldQty,
            balanceQty: newProd.balanceQty,
            mrp: newProd.mrp,
            saleRate: newProd.saleRate
          };
        }
      }
    });
    
    appStore.updateDailyReport(dateStr, {
      ...currentReport,
      extracted: updatedExtracted,
      _at: Date.now(),
      _by: 'react-v1'
    });
  }
}
