import { useState, useEffect } from 'react';
import { getOnlinePrinters, sendToPrinter, generateRefillPdfBlob } from '../lib/print';
import { Printer, Loader2, X, CheckSquare, AlertTriangle, Cloud, FileText } from 'lucide-react';
import type { FinalTask } from '../types';

interface PrintDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: FinalTask[];
  reportTitle: string;
  reportDate?: string;
}

export function PrintDialog({ isOpen, onClose, tasks, reportTitle, reportDate }: PrintDialogProps) {
  const [printers, setPrinters] = useState<any[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [printingStatus, setPrintingStatus] = useState<'idle' | 'generating' | 'sending' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const fetchPrinters = async () => {
    setLoadingPrinters(true);
    try {
      const p = await getOnlinePrinters();
      setPrinters(p);
    } catch (e: any) {
      console.error(e);
      setStatusMessage('Error fetching printers.');
    } finally {
      setLoadingPrinters(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPrinters();
      setPrintingStatus('idle');
      setStatusMessage('');
    }
  }, [isOpen]);

  const handlePrint = async (printerId: string, printerName: string) => {
    try {
      setPrintingStatus('generating');
      setStatusMessage('Generating PDF document...');
      
      const blob = await generateRefillPdfBlob(tasks, { date: reportDate || 'Custom' });
      
      setPrintingStatus('sending');
      setStatusMessage(`Sending to printer: ${printerName}...`);
      
      await sendToPrinter({ id: printerId, name: printerName }, blob, { date: reportDate || 'Custom' }, reportTitle, (msg) => {
         setStatusMessage(msg);
      });
      
      setPrintingStatus('success');
      setStatusMessage('Print job sent successfully!');
      
      setTimeout(() => {
        onClose();
        setPrintingStatus('idle');
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setPrintingStatus('error');
      setStatusMessage(err.message || 'Failed to print');
    }
  };

  const handleViewPdf = async () => {
    try {
      setPrintingStatus('generating');
      setStatusMessage('Generating PDF document...');
      
      const blob = await generateRefillPdfBlob(tasks, { date: reportDate || 'Custom' });
      
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      setPrintingStatus('idle');
      onClose();
    } catch (err: any) {
      console.error(err);
      setPrintingStatus('error');
      setStatusMessage(err.message || 'Failed to generate PDF');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 text-slate-800">
            <Cloud size={18} strokeWidth={2.5} className="text-blue-600" />
            <h3 className="font-bold text-sm">Cloud Print</h3>
          </div>
          <button onClick={onClose} disabled={printingStatus === 'sending' || printingStatus === 'generating'} className="p-1 text-slate-400 hover:text-slate-700 bg-white rounded-md border border-slate-200 shadow-sm transition-colors disabled:opacity-50">
            <X size={16} />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="flex flex-col text-center items-center justify-center pt-2 pb-4">
             <Printer size={32} className="text-blue-500 mb-2 opacity-80" />
             <h4 className="text-[13px] font-bold text-slate-800">{reportTitle}</h4>
             <p className="text-[10px] text-slate-500 font-medium">{tasks.length} items to print</p>
          </div>

          {printingStatus !== 'idle' ? (
            <div className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 text-center
              ${printingStatus === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : ''}
              ${printingStatus === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : ''}
              ${(printingStatus === 'generating' || printingStatus === 'sending') ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}
            `}>
              {printingStatus === 'success' && <CheckSquare size={24} className="text-emerald-500 mb-1" />}
              {printingStatus === 'error' && <AlertTriangle size={24} className="text-rose-500 mb-1" />}
              {(printingStatus === 'generating' || printingStatus === 'sending') && <Loader2 size={24} className="animate-spin text-blue-500 mb-1" />}
              <span className="text-xs font-bold">{statusMessage}</span>
              {printingStatus === 'error' && (
                <button onClick={() => setPrintingStatus('idle')} className="mt-2 px-3 py-1.5 bg-white rounded border border-rose-200 text-[10px] font-bold hover:bg-rose-50">
                  Try Again
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Select Target Printer</label>
              {loadingPrinters ? (
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                  <Loader2 size={14} className="animate-spin" />
                  Discovering Cloud Printers...
                </div>
              ) : printers.length === 0 ? (
                <div className="p-4 bg-orange-50 rounded-xl border border-orange-200 text-center">
                  <p className="text-xs font-bold text-orange-800">No printers found</p>
                  <p className="text-[10px] text-orange-600 mt-1">Ensure the Cloud Print Bridge is running on your PC.</p>
                  <button onClick={fetchPrinters} className="mt-2 text-[10px] font-bold px-2 py-1 bg-white border border-orange-200 rounded text-orange-700">Refresh</button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {printers.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handlePrint(p.id, p.name || 'Printer')}
                      className="flex items-center justify-between p-3 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl text-left transition-colors active:scale-[0.98] group"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700">{p.name || p.id}</span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> Online
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        Print Here
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100">
                <button onClick={handleViewPdf} className="w-full flex items-center justify-center gap-2 p-3 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition-colors">
                  <FileText size={16} />
                  View PDF in Browser
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
