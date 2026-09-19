import type { ExtractedItem } from '../types';

export const exportPO = (items: ExtractedItem[], dateStr: string) => {
  if (items.length === 0) {
    alert("No items queued for PO.");
    return;
  }

  // Group items by supplier
  const bySupplier: Record<string, ExtractedItem[]> = {};
  items.forEach(item => {
    const supplier = item.refillBy || 'Unknown Supplier';
    if (!bySupplier[supplier]) bySupplier[supplier] = [];
    bySupplier[supplier].push(item);
  });

  // Generate HTML for printing
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Purchase Orders - ${dateStr}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body { 
          font-family: 'Inter', system-ui, -apple-system, sans-serif; 
          color: #334155; 
          line-height: 1.5; 
          margin: 0; 
          padding: 40px; 
          background-color: #ffffff;
        }
        .supplier-block { margin-bottom: 60px; page-break-inside: avoid; }
        h1 { 
          font-size: 28px; 
          font-weight: 800;
          color: #0f172a; 
          margin-top: 0;
          margin-bottom: 12px; 
          letter-spacing: -0.025em;
        }
        .meta { 
          font-size: 13px; 
          margin-bottom: 24px;
          color: #475569;
          line-height: 1.6;
        }
        .meta strong { color: #0f172a; font-weight: 600; }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 10px; 
          font-size: 13px;
        }
        th, td { 
          padding: 12px 16px; 
          text-align: left; 
          border-bottom: 1px solid #e2e8f0;
        }
        th { 
          font-weight: 600; 
          color: #475569; 
          border-bottom: 2px solid #cbd5e1;
        }
        th:not(:last-child) {
          border-right: 1px solid #e2e8f0;
        }
        td:not(:last-child) {
          border-right: 1px solid #e2e8f0;
        }
        .sku-col { 
          font-family: 'JetBrains Mono', monospace; 
          font-weight: 600; 
          color: #0f172a;
          font-size: 12px;
        }
        .brand-text {
          font-weight: 500;
          color: #334155;
        }
        @media print {
          body { padding: 0; -webkit-print-color-adjust: exact; }
          .supplier-block { page-break-after: always; }
          .supplier-block:last-child { page-break-after: auto; }
        }
      </style>
    </head>
    <body>
      ${Object.entries(bySupplier).map(([supplier, supplierItems]) => `
        <div class="supplier-block">
          <h1>Purchase Order</h1>
          <div class="meta">
            <div><strong>Supplier:</strong> ${supplier}</div>
            <div><strong>Date:</strong> ${dateStr}</div>
            <div><strong>Items:</strong> ${supplierItems.length}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 45%;">Brand / Category</th>
                <th style="width: 20%;">Item Code</th>
                <th style="width: 15%;">Current MRP</th>
                <th style="width: 20%;">Required Qty</th>
              </tr>
            </thead>
            <tbody>
              ${supplierItems.map(item => `
                <tr>
                  <td class="brand-text">${item.brand} &bull; ${item.category}</td>
                  <td class="sku-col">${item.code}</td>
                  <td style="font-weight: 500;">&#8377;${item.mrp}</td>
                  <td style="color: #cbd5e1;">___________</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
      <script>
        window.onload = () => { window.print(); };
      </script>
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
};
