import React, { useState, useRef } from 'react';
import { logger } from '../lib/logger';
import { useNavigate } from 'react-router-dom';
import { extractDataFromPDF, saveExtractedPDFToStore } from '../lib/pdfParser';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';

export const UploadView: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);
  
  const { userPermissions, logActivity } = useAppStore();
  const { user } = useAuthStore();
  
  const hasPerm = (perm: string) => user?.role === 'admin' || (userPermissions[user?.uid || ''] || ['/', '/zero-stock']).includes(perm);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setStatus({ message: `Processing ${file.name.substring(0, 16)}...`, type: 'info' });

    try {
      const result = await extractDataFromPDF(file);
      
      // Collision detection & Overwrite protection
      const existingReport = useAppStore.getState().dailyReports[result.dateStr];
      if (existingReport) {
        if (existingReport._by === 'skeleton') {
          setStatus({ message: `Upload Blocked: Report is archived.`, type: 'error' });
          alert(`Access Denied: Data for ${result.dateStr} exists in the cloud but is older than 30 days and not loaded locally.\n\nOverwriting it now would cause data loss. Please contact an admin.`);
          return;
        }
        if (!hasPerm('action:upload_parse')) {
          setStatus({ message: `Upload Blocked: Data for ${result.dateStr} exists.`, type: 'error' });
          alert(`Access Denied: Data for ${result.dateStr} has already been uploaded.\n\nOnly authorized users can overwrite existing daily records to prevent data loss.`);
          return;
        } else {
          const proceed = window.confirm(`Warning: Data for ${result.dateStr} is already present in the system.\n\nAre you sure you want to merge and overwrite it?`);
          if (!proceed) {
            setStatus({ message: `Upload cancelled by admin.`, type: 'info' });
            return;
          }
        }
      }

      saveExtractedPDFToStore(result.dateStr, result.items);
      
      const { cloudSaveDateReportNow } = await import('../lib/syncEngine');
      const currentReport = useAppStore.getState().dailyReports[result.dateStr];
      
      if (currentReport) {
        setStatus({ message: `Uploading ${result.items.length} items to cloud...`, type: 'success' });
        const { success, error: syncError } = await cloudSaveDateReportNow(result.dateStr, currentReport);
        if (!success) {
          throw new Error(syncError || 'Cloud upload failed. Check permissions or internet.');
        }
      }

      logActivity('Upload PDF', `Parsed and uploaded PDF for date: ${result.dateStr}`);
      
      setStatus({  
        message: `Success! Extracted ${result.items.length} items.`, 
        type: 'success' 
      });

      // Navigate to the workspace for the parsed date after a short delay
      setTimeout(() => {
        navigate(`/workspace/${encodeURIComponent(result.dateStr)}`);
      }, 1500);

    } catch (error: any) {
      logger.error('upload', 'handleFileChange', 'PDF parsing failed', error, { fileName: file?.name });
      setStatus({ message: `Error reading PDF: ${error.message}`, type: 'error' });
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isProcessing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="flex flex-col h-full bg-warmCanvas text-slate-800 overflow-hidden animate-fade-in w-full max-w-md md:max-w-none lg:max-w-6xl mx-auto relative pb-safe">
      <main className="flex-1 flex flex-col px-4 pt-3 md:pt-8 md:px-8 pb-2 justify-between md:justify-start w-full h-full" data-purpose="primary-upload-container">
        
        {/* Top Bar & Live Ingestion Status */}
        <header className="flex items-center justify-between shrink-0 mb-2">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-accentBlue shrink-0"></span>
            <div className="flex items-center space-x-2 truncate">
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900 leading-none truncate">Upload Daily Stock</h1>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 bg-white px-2.5 py-1 rounded-full border border-warmBorder shadow-xs text-xs">
            <span className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 pulse-live'}`}></span>
            <span className="text-[11px] font-medium text-slate-600">{isProcessing ? 'Processing...' : 'System Ready'}</span>
          </div>
        </header>

        <div className="flex flex-col md:grid md:grid-cols-2 md:gap-8 lg:gap-12 md:mt-6 flex-1 space-y-4 md:space-y-0">
          {/* Upload Dropzone Card */}
        <section 
          className={`bg-white rounded-2xl border border-warmBorder shadow-sm p-4 text-center shrink-0 flex flex-col items-center justify-center relative overflow-hidden cursor-pointer transition-all ${isProcessing ? 'opacity-90 cursor-wait' : 'hover:shadow-md'}`}
          data-purpose="pdf-upload-dropzone"
          onClick={handleTriggerClick}
        >
          {/* Background subtle decorative aura */}
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-blue-50 rounded-full blur-2xl pointer-events-none"></div>
          
          {/* Dashed drop boundary container */}
          <div className={`w-full dropzone-border rounded-xl p-3.5 flex flex-col items-center ${isProcessing ? 'bg-amber-50/30' : 'bg-blue-50/20'}`}>
            <div className={`w-12 h-12 mb-2 rounded-full border flex items-center justify-center shadow-[0_2px_8px_rgba(37,99,235,0.12)] ${isProcessing ? 'bg-amber-50 border-amber-100 text-amber-600' : 'bg-blue-50 border-blue-100 text-accentBlue'}`}>
              {isProcessing ? (
                <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              ) : (
                <svg className="w-6 h-6 stroke-[2]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M12 18v-6"></path><path d="m9 15 3-3 3 3"></path></svg>
              )}
            </div>
            
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              {status ? status.message : 'Upload Daily Stock PDF'}
            </h2>
            
            <p className={`text-xs mt-0.5 leading-snug ${status?.type === 'error' ? 'text-red-500 font-medium' : status?.type === 'success' ? 'text-emerald-600 font-medium' : 'text-slate-500'}`}>
              {status ? (status.type === 'error' ? 'Please try again.' : 'Redirecting to workspace...') : 'Drag & drop stock report PDF or click to browse'}
            </p>
            
            <div className="mt-2.5 inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600 tracking-wider uppercase border border-slate-200">
              <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
              <span>PDF FORMAT ONLY  MAX 25MB</span>
            </div>
            
            <button 
              type="button" 
              className={`mt-3.5 w-full font-semibold text-xs py-2.5 px-4 rounded-xl shadow-md transition flex items-center justify-center space-x-1.5 ${isProcessing ? 'bg-amber-500 text-white shadow-amber-500/20' : 'bg-accentBlue hover:bg-blue-700 text-white shadow-blue-500/20 active:scale-[0.99]'}`}
            >
              {isProcessing ? (
                <span>Parsing Data...</span>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                  <span>+ Upload Daily Stock PDF</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Quick Guide & Ingestion Architecture (Vertical List View) */}
        <section className="flex flex-col shrink-0 my-2" data-purpose="quick-guide-timeline">
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">How it works</h3>
            <span className="text-[10px] text-accentBlue font-medium">Auto-Parsing v2.4</span>
          </div>
          
          <div className="flex flex-col space-y-2">
            <div className="bg-white p-3 rounded-xl border border-warmBorder shadow-sm flex items-start gap-3 transition hover:shadow-md">
              <div className="w-6 h-6 mt-0.5 rounded-md bg-blue-50 text-accentBlue flex items-center justify-center font-bold text-xs border border-blue-200 shrink-0">1</div>
              <div className="flex-1">
                <span className="text-xs font-bold text-slate-900 block mb-0.5">Select Stock Report</span>
                <p className="text-[11px] leading-snug text-slate-500">Select your daily stock status report and export the PDF from Softcon.</p>
              </div>
            </div>
            
            <div className="bg-white p-3 rounded-xl border border-warmBorder shadow-sm flex items-start gap-3 transition hover:shadow-md">
              <div className="w-6 h-6 mt-0.5 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs border border-indigo-200 shrink-0">2</div>
              <div className="flex-1">
                <span className="text-xs font-bold text-slate-900 block mb-0.5">Automatic Parsing</span>
                <p className="text-[11px] leading-snug text-slate-500">The system instantly reads the PDF and extracts Opening, Inward (+), Outward (-), and Closing balances.</p>
              </div>
            </div>
            
            <div className="bg-white p-3 rounded-xl border border-warmBorder shadow-sm flex items-start gap-3 transition hover:shadow-md">
              <div className="w-6 h-6 mt-0.5 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs border border-rose-200 shrink-0">3</div>
              <div className="flex-1">
                <span className="text-xs font-bold text-slate-900 block mb-0.5">0-Stock Detection</span>
                <p className="text-[11px] leading-snug text-slate-500">SKUs that have reached zero balance are instantly flagged and sent to the 0-Stock tab for reordering.</p>
              </div>
            </div>
            
            <div className="bg-white p-3 rounded-xl border border-warmBorder shadow-sm flex items-start gap-3 transition hover:shadow-md">
              <div className="w-6 h-6 mt-0.5 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs border border-emerald-200 shrink-0">4</div>
              <div className="flex-1">
                <span className="text-xs font-bold text-slate-900 block mb-0.5">Reorder & Dispatch</span>
                <p className="text-[11px] leading-snug text-slate-500">Easily assign suppliers, set order quantities, and print Purchase Orders for out-of-stock items.</p>
              </div>
            </div>
          </div>
        </section>
        </div>

      </main>

      {/* Hidden File Input */}
      <input 
        ref={fileInputRef}
        type="file" 
        accept="application/pdf"
        className="hidden"
        onChange={handleFileUpload}
      />
    </div>
  );
};

