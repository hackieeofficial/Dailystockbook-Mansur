import React from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { usePreferencesStore, defaultPreferences } from '../store/usePreferencesStore';
import type { UserPreferences } from '../store/usePreferencesStore';
import { Type, Palette, Shield, MonitorSmartphone, LayoutTemplate, RotateCcw } from 'lucide-react';

const RangeSlider = ({ 
  label, value, onChange, min, max, unit = 'px', onReset 
}: { 
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; unit?: string; onReset?: () => void 
}) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center text-xs font-medium text-slate-700">
        <span>{label}</span>
        <div className="flex items-center gap-2">
          {onReset && (
            <button onClick={onReset} className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Reset to default">
              <RotateCcw size={12} />
            </button>
          )}
          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{value}{unit}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <input 
          type="range" min={min} max={max} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <input 
          type="number" min={min} max={max} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-14 text-xs border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 font-mono text-center"
        />
      </div>
    </div>
  );
};

const Toggle = ({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) => {
  return (
    <div className="flex items-center justify-between py-2 cursor-pointer group" onClick={() => onChange(!checked)}>
      <div className="flex flex-col pr-4">
        <span className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">{label}</span>
        {description && <span className="text-[10px] text-slate-500">{description}</span>}
      </div>
      <button 
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}
      >
        <span className="sr-only">Use setting</span>
        <span aria-hidden="true" className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-2' : '-translate-x-2'}`} />
      </button>
    </div>
  );
};

const SelectRow = ({ label, description, value, options, onChange }: { label: string; description?: string; value: string; options: {value: string, label: string}[], onChange: (v: string) => void }) => {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex flex-col pr-4">
        <span className="text-sm font-semibold text-slate-800">{label}</span>
        {description && <span className="text-[10px] text-slate-500">{description}</span>}
      </div>
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="text-xs border border-slate-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 bg-white font-medium"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
};

const Section = ({ title, icon: Icon, children, onResetAll }: { title: string, icon: any, children: React.ReactNode, onResetAll?: () => void }) => (
  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-6">
    <div className="flex items-center justify-between bg-slate-50 border-b border-slate-100 px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="bg-white p-1.5 rounded shadow-sm text-blue-600 border border-slate-200">
          <Icon size={16} />
        </div>
        <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs">{title}</h3>
      </div>
      {onResetAll && (
        <button onClick={onResetAll} className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors">
          <RotateCcw size={10} />
          <span>RESET ALL</span>
        </button>
      )}
    </div>
    <div className="p-4 flex flex-col gap-5">
      {children}
    </div>
  </div>
);

export const DisplaySettingsTab: React.FC = () => {
  const { user } = useAuthStore();
  const { getPreferences, updatePreferences } = usePreferencesStore();
  
  if (!user) return null;

  const prefs = getPreferences(user.uid);
  const setPref = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    updatePreferences(user.uid, { [key]: value });
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-3xl pb-20">
      
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">Display & Accessibility</h2>
          <p className="text-xs text-slate-500">Settings are synced to your cloud profile and apply across all your devices instantly.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-0">
        
        {/* LEFT COLUMN */}
        <div className="flex flex-col">
          <Section title="Mobile Typography" icon={MonitorSmartphone} onResetAll={() => {
            updatePreferences(user.uid, {
              mobileTitleSize: defaultPreferences.mobileTitleSize,
              mobileCategorySize: defaultPreferences.mobileCategorySize,
              mobileQtySize: defaultPreferences.mobileQtySize,
              mobileQtyLabelSize: defaultPreferences.mobileQtyLabelSize,
              mobilePricePrimarySize: defaultPreferences.mobilePricePrimarySize,
              mobilePriceSecondarySize: defaultPreferences.mobilePriceSecondarySize,
              mobileBadgeSize: defaultPreferences.mobileBadgeSize,
              mobileMetaSize: defaultPreferences.mobileMetaSize,
            });
          }}>
            <RangeSlider label="Product Name" value={prefs.mobileTitleSize} min={10} max={32} onChange={(v) => setPref('mobileTitleSize', v)} onReset={() => setPref('mobileTitleSize', defaultPreferences.mobileTitleSize)} />
            <RangeSlider label="Category & Desc" value={prefs.mobileCategorySize} min={8} max={24} onChange={(v) => setPref('mobileCategorySize', v)} onReset={() => setPref('mobileCategorySize', defaultPreferences.mobileCategorySize)} />
            <RangeSlider label="Quantity Numbers" value={prefs.mobileQtySize} min={10} max={40} onChange={(v) => setPref('mobileQtySize', v)} onReset={() => setPref('mobileQtySize', defaultPreferences.mobileQtySize)} />
            <RangeSlider label="Qty Labels (OPN, etc)" value={prefs.mobileQtyLabelSize} min={6} max={16} onChange={(v) => setPref('mobileQtyLabelSize', v)} onReset={() => setPref('mobileQtyLabelSize', defaultPreferences.mobileQtyLabelSize)} />
            <RangeSlider label="Primary Price (Sale)" value={prefs.mobilePricePrimarySize} min={10} max={32} onChange={(v) => setPref('mobilePricePrimarySize', v)} onReset={() => setPref('mobilePricePrimarySize', defaultPreferences.mobilePricePrimarySize)} />
            <RangeSlider label="Secondary Price (MRP)" value={prefs.mobilePriceSecondarySize} min={8} max={24} onChange={(v) => setPref('mobilePriceSecondarySize', v)} onReset={() => setPref('mobilePriceSecondarySize', defaultPreferences.mobilePriceSecondarySize)} />
            <RangeSlider label="Badges & Tags" value={prefs.mobileBadgeSize} min={8} max={20} onChange={(v) => setPref('mobileBadgeSize', v)} onReset={() => setPref('mobileBadgeSize', defaultPreferences.mobileBadgeSize)} />
            <RangeSlider label="Meta Info (Timestamp)" value={prefs.mobileMetaSize} min={7} max={16} onChange={(v) => setPref('mobileMetaSize', v)} onReset={() => setPref('mobileMetaSize', defaultPreferences.mobileMetaSize)} />
          </Section>

          <Section title="Appearance & Theme" icon={Palette} onResetAll={() => {
            updatePreferences(user.uid, {
              themeAccent: defaultPreferences.themeAccent,
              fontFamily: defaultPreferences.fontFamily,
              highContrastMode: defaultPreferences.highContrastMode,
              grayscaleMode: defaultPreferences.grayscaleMode
            });
          }}>
            <SelectRow 
              label="Theme Accent Color" 
              value={prefs.themeAccent} 
              onChange={(v) => setPref('themeAccent', v as any)}
              options={[{value:'blue',label:'Ocean Blue'},{value:'emerald',label:'Emerald Green'},{value:'slate',label:'Slate Gray'},{value:'violet',label:'Deep Violet'}]} 
            />
            <SelectRow 
              label="Font Family" 
              value={prefs.fontFamily} 
              onChange={(v) => setPref('fontFamily', v as any)}
              options={[
                {value:'Plus Jakarta Sans',label:'Plus Jakarta Sans (Default)'},
                {value:'Inter',label:'Inter'},
                {value:'Roboto',label:'Roboto'},
                {value:'Outfit',label:'Outfit'},
                {value:'Quicksand',label:'Quicksand'},
                {value:'Poppins',label:'Poppins'}
              ]} 
            />
            <div className="border-t border-slate-100 pt-2 mt-2">
              <Toggle label="High Contrast Mode" description="Increases border thickness and darkens colors for readability." checked={prefs.highContrastMode} onChange={v => setPref('highContrastMode', v)} />
              <Toggle label="Grayscale / Focus Mode" description="Removes all color from the UI to reduce distractions." checked={prefs.grayscaleMode} onChange={v => setPref('grayscaleMode', v)} />
            </div>
          </Section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col">
          <Section title="Desktop Typography" icon={Type} onResetAll={() => {
            updatePreferences(user.uid, {
              desktopTitleSize: defaultPreferences.desktopTitleSize,
              desktopCategorySize: defaultPreferences.desktopCategorySize,
              desktopQtySize: defaultPreferences.desktopQtySize,
              desktopQtyLabelSize: defaultPreferences.desktopQtyLabelSize,
              desktopPricePrimarySize: defaultPreferences.desktopPricePrimarySize,
              desktopPriceSecondarySize: defaultPreferences.desktopPriceSecondarySize,
              desktopBadgeSize: defaultPreferences.desktopBadgeSize,
              desktopMetaSize: defaultPreferences.desktopMetaSize,
            });
          }}>
            <RangeSlider label="Product Name" value={prefs.desktopTitleSize} min={10} max={32} onChange={(v) => setPref('desktopTitleSize', v)} onReset={() => setPref('desktopTitleSize', defaultPreferences.desktopTitleSize)} />
            <RangeSlider label="Category & Desc" value={prefs.desktopCategorySize} min={8} max={24} onChange={(v) => setPref('desktopCategorySize', v)} onReset={() => setPref('desktopCategorySize', defaultPreferences.desktopCategorySize)} />
            <RangeSlider label="Quantity Numbers" value={prefs.desktopQtySize} min={10} max={40} onChange={(v) => setPref('desktopQtySize', v)} onReset={() => setPref('desktopQtySize', defaultPreferences.desktopQtySize)} />
            <RangeSlider label="Qty Labels (OPN, etc)" value={prefs.desktopQtyLabelSize} min={6} max={16} onChange={(v) => setPref('desktopQtyLabelSize', v)} onReset={() => setPref('desktopQtyLabelSize', defaultPreferences.desktopQtyLabelSize)} />
            <RangeSlider label="Primary Price (Sale)" value={prefs.desktopPricePrimarySize} min={10} max={32} onChange={(v) => setPref('desktopPricePrimarySize', v)} onReset={() => setPref('desktopPricePrimarySize', defaultPreferences.desktopPricePrimarySize)} />
            <RangeSlider label="Secondary Price (MRP)" value={prefs.desktopPriceSecondarySize} min={8} max={24} onChange={(v) => setPref('desktopPriceSecondarySize', v)} onReset={() => setPref('desktopPriceSecondarySize', defaultPreferences.desktopPriceSecondarySize)} />
            <RangeSlider label="Badges & Tags" value={prefs.desktopBadgeSize} min={8} max={20} onChange={(v) => setPref('desktopBadgeSize', v)} onReset={() => setPref('desktopBadgeSize', defaultPreferences.desktopBadgeSize)} />
            <RangeSlider label="Meta Info (Timestamp)" value={prefs.desktopMetaSize} min={7} max={16} onChange={(v) => setPref('desktopMetaSize', v)} onReset={() => setPref('desktopMetaSize', defaultPreferences.desktopMetaSize)} />
          </Section>

          <Section title="Layout & Density" icon={LayoutTemplate} onResetAll={() => {
            updatePreferences(user.uid, {
              uiDensity: defaultPreferences.uiDensity,
              qtyAlignment: defaultPreferences.qtyAlignment,
              stickyHeader: defaultPreferences.stickyHeader,
              hideZeroBalances: defaultPreferences.hideZeroBalances,
              reduceMotion: defaultPreferences.reduceMotion
            });
          }}>
            <SelectRow 
              label="UI Padding & Density" 
              value={prefs.uiDensity} 
              onChange={(v) => setPref('uiDensity', v as any)}
              options={[{value:'compact',label:'Compact (Dense)'},{value:'comfortable',label:'Comfortable (Default)'},{value:'spacious',label:'Spacious (Relaxed)'}]} 
            />
            <SelectRow 
              label="Quantity Column Alignment" 
              value={prefs.qtyAlignment} 
              onChange={(v) => setPref('qtyAlignment', v as any)}
              options={[{value:'left',label:'Left'},{value:'center',label:'Center'},{value:'right',label:'Right'}]} 
            />
            <div className="border-t border-slate-100 pt-2 mt-2">
              <Toggle label="Sticky Header" description="Keep search and filters visible while scrolling." checked={prefs.stickyHeader} onChange={v => setPref('stickyHeader', v)} />
              <Toggle label="Hide Out-Of-Stock" description="Removes 0-balance warning cards from the main list." checked={prefs.hideZeroBalances} onChange={v => setPref('hideZeroBalances', v)} />
              <Toggle label="Reduce Motion" description="Disables all UI animations and transitions." checked={prefs.reduceMotion} onChange={v => setPref('reduceMotion', v)} />
            </div>
          </Section>

          <Section title="Privacy & Audio" icon={Shield} onResetAll={() => {
            updatePreferences(user.uid, {
              showCurrencySymbol: defaultPreferences.showCurrencySymbol,
              showCategoryLabels: defaultPreferences.showCategoryLabels,
              enableSounds: defaultPreferences.enableSounds,
              soundVolume: defaultPreferences.soundVolume
            });
          }}>
            <Toggle label="Show Currency Symbol" description="Displays ₹ symbol next to prices." checked={prefs.showCurrencySymbol} onChange={v => setPref('showCurrencySymbol', v)} />
            <Toggle label="Show Category Labels" description="Displays product categories below titles." checked={prefs.showCategoryLabels} onChange={v => setPref('showCategoryLabels', v)} />
            <div className="border-t border-slate-100 pt-3 mt-1">
              <Toggle label="Enable Interface Sounds" description="Play sounds when processing refills or skipping items." checked={prefs.enableSounds} onChange={v => setPref('enableSounds', v)} />
              {prefs.enableSounds && (
                <div className="pl-2 pt-2">
                  <RangeSlider label="Sound Volume" value={Math.round(prefs.soundVolume * 100)} min={0} max={100} unit="%" onChange={(v) => setPref('soundVolume', v / 100)} />
                </div>
              )}
            </div>
          </Section>
        </div>

      </div>
    </div>
  );
};
