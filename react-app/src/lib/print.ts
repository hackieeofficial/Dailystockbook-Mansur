import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { fbPrint } from './firebase';
import { useAuthStore } from '../store/useAuthStore';
import firebase from 'firebase/compat/app';
import { logger } from './logger';

const QUEUE = 'print_queue';
const STORE = 'print/';
const STALE_MS = 150 * 1000;
const LAST_KEY = 'ds_print_printer';

function numFormat(v: any) {
  const n = parseFloat(v);
  return isNaN(n) ? '-' : String(Math.round(n));
}

function buildRefillPdf(list: any[], meta: any) {
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'landscape' });
  const M = 4;
  let y = 6;

  doc.setFont('helvetica', 'bold'); 
  doc.setFontSize(10); 
  doc.setTextColor(0, 0, 0);
  doc.text('Daily Refill Report', M, y);
  
  doc.setFont('helvetica', 'normal'); 
  doc.setFontSize(6); 
  doc.setTextColor(50, 50, 50);
  const mStr = `${meta.date || '-'}  |  ${meta.staff === 'ALL' ? 'All Staff' : (meta.staff || 'All')}  |  ${meta.status === 'ALL' ? 'All' : (meta.status || 'All')}  |  ${meta.printed}`;
  doc.text(mStr, M + 42, y);
  y += 3;

  const groups: Record<string, any[]> = {};
  list.forEach(t => {
    const g = String(t.godown || 'To decide');
    if (!groups[g]) groups[g] = [];
    groups[g].push(t);
  });
  
  const gKeys = Object.keys(groups).sort((a, b) => {
    if (a === 'To decide') return 1;
    if (b === 'To decide') return -1;
    return a.localeCompare(b);
  });

  const body: any[] = [];
  gKeys.forEach(gKey => {
    body.push([{ 
      content: 'Godown: ' + gKey, 
      colSpan: 8, 
      styles: { fillColor: [235, 235, 235], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'left', fontSize: 6.5, cellPadding: { top: 4, bottom: 1.5, left: 1, right: 1 } } 
    }]);
    
    groups[gKey].forEach((t, i) => {
      const code = String(t.code || '');
      const brand = String(t.brand || '').toUpperCase();
      const cat = String(t.category || '');
      let prod = code;
      if (cat) prod += '\n' + cat;
      
      const stock = t.balanceQty != null ? t.balanceQty : (Number(t.opening||0) + Number(t.purQty||0) - Number(t.soldQty||0));

      body.push([
        String(i + 1),
        prod,
        brand,
        String(t.refillQty != null ? t.refillQty : ''),
        String(stock),
        'MRP: ' + numFormat(t.mrp) + '\nSelling: ' + numFormat(t.saleRate),
        String(t.refillBy || '-'),
        String(t.status || 'Pending')
      ]);
    });
  });

  (doc as any).autoTable({
    startY: y,
    margin: { left: M, right: M, top: 4, bottom: 4 },
    head: [['#', 'Product', 'Brand', 'Refill', 'In Stock', 'MRP/Selling', 'Staff', 'Status']],
    body: body,
    theme: 'grid',
    showHead: 'everyPage',
    styles: { fontSize: 6, cellPadding: 0.6, valign: 'middle', lineColor: [80, 80, 80], lineWidth: 0.2, textColor: [0, 0, 0], overflow: 'linebreak' },
    headStyles: { fillColor: [30, 30, 30], textColor: 255, fontSize: 6, fontStyle: 'bold', halign: 'left', cellPadding: 0.8 },
    columnStyles: {
      0: { cellWidth: 6,  halign: 'center' },
      1: { fontStyle: 'bold' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 10, halign: 'center', fontStyle: 'bold', textColor: [0, 0, 0], fontSize: 6.5 },
      4: { cellWidth: 10, halign: 'center', textColor: [60, 60, 60], fontSize: 5 },
      5: { cellWidth: 22, fontSize: 5.5, textColor: [60, 60, 60], halign: 'center' },
      6: { cellWidth: 18, halign: 'center' },
      7: { cellWidth: 16, halign: 'center', fontStyle: 'bold' }
    },
    didParseCell: function (data: any) {
      if (data.section === 'head' && data.column.index !== 1) {
        data.cell.styles.halign = 'center';
      }
      if (data.section === 'body' && data.column.index === 7 && data.row.cells[0].colSpan === 1) {
        data.cell.styles.textColor = [0,0,0];
      }
    }
  });

  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : y;
  const fy = finalY + 3;
  const totalPcs = list.reduce((s, t) => s + (parseFloat(t.refillQty) || 0), 0);
  const doneCnt  = list.filter((t) => String(t.status || '').toLowerCase() === 'completed').length;
  
  doc.setFont('helvetica', 'bold'); 
  doc.setFontSize(6.5); 
  doc.setTextColor(0, 0, 0);
  doc.text(`Total: ${list.length} items  |  ${totalPcs} pcs  |  Done: ${doneCnt}/${list.length}`, M, fy);
  
  return doc.output('blob');
}

export function nowStamp() {
  return new Date().toLocaleDateString('en-GB') + ' ' +
         new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export async function getOnlinePrinters() {
  const out: any[] = [];
  const fb = fbPrint();
  if (!fb) return out;
  const now = Date.now();
  
  function absorb(x: any) {
    const ts = (x.lastSeen && x.lastSeen.toDate) ? x.lastSeen.toDate().getTime() : 0;
    const online = ts > 0 && (now - ts) < STALE_MS && x.status !== 'offline';
    (x.printers || []).forEach((p: any) => {
      if (!p || !p.id) return;
      const e = out.find(o => o.id === p.id);
      if (!e) out.push({ id: p.id, name: p.name || p.id, online: online, paper: p.defaultPaper || 'A5' });
      else if (online && !e.online) e.online = true;
    });
  }
  
  try {
    const qs = await fb.db.collection('system_print_bridges').get();
    qs.forEach((d: any) => absorb(d.data() || {}));
  } catch (e) {
    logger.warn('print', 'discoverPrinters:bridges', 'Print bridge query failed', e);
  }
  
  if (!out.length) {
    try {
      const d = await fb.db.collection('system').doc('printBridge').get();
      if (d.exists) absorb(d.data() || {});
    } catch (e) {
      logger.warn('print', 'discoverPrinters:fallback', 'Fallback bridge query failed', e);
    }
  }
  return out;
}

export async function sendToPrinter(printer: any, blob: Blob, meta: any, title: string, onStatus: (msg: string) => void) {
  const fb = fbPrint();
  if (!fb) throw new Error('Firebase print bridge is offline.');
  
  try { localStorage.setItem(LAST_KEY, printer.id); } catch (e) {
    logger.debug('print', 'sendToPrinter:cache', 'Failed to cache printer ID', e);
  }
  
  const authStore = useAuthStore.getState();
  const email = authStore.user?.email || null;
  const name = authStore.user?.name || (email ? email.split('@')[0] : null);

  const ref = fb.db.collection(QUEUE).doc();
  const jobId = ref.id;
  const path = STORE + jobId + '.pdf';

  onStatus('Uploading to printer...');
  
  await fb.storage.ref().child(path).put(blob, {
    contentType: 'application/pdf',
    customMetadata: {
      jobId, type: 'quote', jobName: 'RefillSheet.pdf',
      createdBy: String(email || ''), createdByName: String(name || '')
    }
  });
  
  await ref.set({
    type: 'quote',
    jobName: title || ('Daily Refill Sheet ' + (meta.date || '')),
    copies: 1,
    printer: printer.id,
    paperSize: 'A5',
    storagePath: path,
    status: 'queued',
    createdBy: email,
    createdByName: name || email,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    retries: 0,
    source: 'dailystock'
  });
  
  onStatus(`Sent to ${printer.name}  printing...`);

  // We could return the unsubscribe function here or just wrap it in a promise
  return new Promise<void>((resolve, reject) => {
    let handled = false;
    const unsub = ref.onSnapshot(s => {
      if (!s.exists) return;
      const d = s.data() || {};
      if (d.status === 'printing') onStatus(`Printing on ${printer.name}...`);
      else if (d.status === 'printed') {
        onStatus(`Printed on ${printer.name}`);
        if (!handled) { handled = true; unsub(); resolve(); }
      }
      else if (d.status === 'failed') {
        onStatus(`Print failed: ${d.errorMsg || 'check the office PC'}`);
        if (!handled) { handled = true; unsub(); reject(new Error(d.errorMsg)); }
      }
    });
    
    // Timeout
    setTimeout(() => {
      if (!handled) { handled = true; unsub(); resolve(); }
    }, 90000);
  });
}

export function generateRefillPdfBlob(list: any[], meta: any) {
  return buildRefillPdf(list, meta);
}
