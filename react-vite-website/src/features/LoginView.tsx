import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { login } from '../lib/auth';

export const LoginView: React.FC = () => {
  const { user, isLoading, error } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  React.useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    await login(email, password, keepSignedIn);
  };

  return (
    <div className="bg-[#f7f3ea] text-brand-navy font-sans antialiased min-h-[100dvh] flex flex-col md:flex-row md:items-center justify-between md:justify-center overflow-x-hidden relative">
      {/* Ambient background elements */}
      <div className="ambient-glow blob-1 md:block"></div>
      <div className="ambient-glow blob-2 md:block"></div>

      {/* BEGIN: MainContainer */}
      <main className="relative z-10 w-full max-w-md md:max-w-4xl lg:max-w-5xl mx-auto px-5 md:px-0 pt-8 md:pt-0 pb-7 md:pb-0 flex-1 md:flex-none flex flex-col md:flex-row justify-between md:justify-center md:bg-white/60 md:backdrop-blur-xl md:shadow-2xl md:rounded-3xl md:border md:border-white/50 md:overflow-hidden">
        
        {/* Left Side: Branding & Features (Desktop Wrapper) */}
        <div className="md:w-1/2 md:p-8 lg:p-12 md:flex md:flex-col md:justify-between">
          {/* BEGIN: BrandHeader */}
          <header className="flex flex-col items-center md:items-start text-center md:text-left mt-2 md:mt-0 mb-6 md:mb-8">
            {/* 3D-styled Blue App Icon */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-[#3b7cf8] to-[#1752cd] flex items-center justify-center shadow-icon transform active:scale-95 transition-transform duration-200 mb-4 ring-4 ring-white/70">
              <span className="text-white text-3xl font-extrabold tracking-tight select-none">M</span>
            </div>
            
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#0a1835] mb-1 md:mb-2">
              Mansur Enterprises
            </h1>
            <p className="text-[11px] md:text-xs lg:text-sm font-extrabold tracking-widest uppercase text-brand-blue mb-1.5 md:mb-2">
              Daily Stock Book
            </p>
            <p className="text-xs md:text-sm text-brand-slate font-medium max-w-[240px] md:max-w-[280px]">
              Simple stock management for a smarter business.
            </p>
          </header>

          {/* Desktop Feature Grid (Hidden on Mobile) */}
          <section className="hidden md:block mb-8">
            <div className="grid grid-cols-1 gap-5">
              <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </div>
                <div>
                  <span className="text-sm font-bold text-brand-navy block leading-tight mb-0.5">Cloud Sync</span>
                  <span className="text-xs text-brand-slate font-medium leading-tight">Always in sync across devices</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </div>
                <div>
                  <span className="text-sm font-bold text-brand-navy block leading-tight mb-0.5">Refill Tracking</span>
                  <span className="text-xs text-brand-slate font-medium leading-tight">Stay informed about stock levels</span>
                </div>
              </div>
            </div>
          </section>

          {/* Desktop Footer (Hidden on Mobile) */}
          <footer className="hidden md:block">
            <p className="text-[9.5px] font-extrabold uppercase tracking-[0.2em] text-[#9b8d76] mb-1">
              Reliable • Simple • Built for your business
            </p>
            <p className="text-[10px] text-[#9b8d76]/80 font-medium">
              &copy; 2026 Mansur Enterprises. All rights reserved.
            </p>
          </footer>
        </div>

        {/* Right Side: Login Form */}
        <div className="md:w-1/2 md:p-8 lg:p-12 md:bg-white/50 flex flex-col justify-center">
          {/* BEGIN: LoginCard */}
          <section className="bg-white/95 md:bg-white backdrop-blur-md rounded-3xl p-6 sm:p-7 shadow-card md:shadow-none border border-[#f0eade]/80 md:border-transparent relative overflow-hidden">
            {/* Accent Top Gradient Border Line (Hidden on Desktop) */}
            <div className="absolute top-0 left-6 right-6 h-[3px] bg-gradient-to-r from-brand-blue/30 via-brand-blue to-brand-blue/30 rounded-full md:hidden"></div>
            
            {/* Card Title & Subheading */}
            <div className="mb-5 md:mb-8 pt-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-blue block mb-1">
                Staff Portal
              </span>
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-brand-navy tracking-tight">
                Welcome back.
              </h2>
              <p className="text-xs md:text-sm text-brand-slate mt-0.5 md:mt-1.5 font-normal md:font-medium">
                Use your work email to continue.
              </p>
            </div>

            {/* Form Elements */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-[11px] font-bold px-3 py-2 rounded-xl flex items-start gap-2 shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-600 mt-1 shrink-0" />
                  {error}
                </div>
              )}

              {/* Work Email Input */}
              <div className="space-y-1.5">
                <label htmlFor="work-email" className="block text-xs font-bold text-[#1a2844] tracking-tight">
                  Work email
                </label>
                <div className="relative rounded-2xl group transition-all duration-200">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-blue transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                  </div>
                  <input 
                    id="work-email" 
                    name="email" 
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@shop.com" 
                    required
                    disabled={isLoading}
                    autoComplete="email" 
                    className="block w-full pl-11 pr-4 py-3 md:py-3.5 bg-[#faf9f6] hover:bg-white text-sm text-brand-navy placeholder:text-slate-400 font-medium border border-gray-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all duration-200 shadow-inner sm:text-sm" 
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label htmlFor="work-password" className="block text-xs font-bold text-[#1a2844] tracking-tight">
                  Password
                </label>
                <div className="relative rounded-2xl group transition-all duration-200">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-blue transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                  </div>
                  <input 
                    id="work-password" 
                    name="password" 
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password" 
                    required
                    disabled={isLoading}
                    autoComplete="current-password" 
                    className="block w-full pl-11 pr-11 py-3 md:py-3.5 bg-[#faf9f6] hover:bg-white text-sm text-brand-navy placeholder:text-slate-400 font-medium border border-gray-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all duration-200 shadow-inner sm:text-sm" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility" 
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-brand-navy focus:outline-none focus:text-brand-blue transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" strokeLinecap="round" strokeLinejoin="round"></path>
                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" strokeLinecap="round" strokeLinejoin="round"></path>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Options row */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={keepSignedIn}
                    onChange={(e) => setKeepSignedIn(e.target.checked)}
                    disabled={isLoading}
                    className="w-4 h-4 rounded text-brand-blue border-gray-300 focus:ring-brand-blue focus:ring-offset-0 transition duration-150 cursor-pointer" 
                  />
                  <span className="text-xs font-medium text-brand-slate">Keep me signed in</span>
                </label>
                <a href="#forgot" className="text-xs font-bold text-brand-blue hover:text-brand-blueHover hover:underline transition-colors focus:outline-none">
                  Forgot password?
                </a>
              </div>

              {/* CTA Login Button */}
              <button 
                type="submit" 
                disabled={isLoading}
                className={`btn-shine-overlay w-full mt-2 py-3.5 md:py-4 px-4 bg-gradient-to-r from-[#1e5cd9] to-[#1850bf] hover:from-[#1b53c7] hover:to-[#1444a4] text-white font-bold text-base md:text-lg rounded-2xl shadow-pill active:scale-[0.985] focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 flex items-center justify-center gap-2 transition-all duration-150 ${isLoading ? 'opacity-90 cursor-not-allowed' : ''}`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 md:h-5 md:w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Log in</span>
                    <svg className="w-4 h-4 md:w-5 md:h-5 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.3" viewBox="0 0 24 24">
                      <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                  </>
                )}
              </button>

              {/* FaceID / Biometric alternative */}
              <div className="pt-2 text-center">
                <button type="button" className="inline-flex items-center gap-1.5 text-[11px] md:text-xs font-semibold text-slate-500 hover:text-brand-blue transition-colors py-1 px-3 rounded-full hover:bg-brand-cream">
                  <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M7 3H5a2 2 0 00-2 2v2m0 10v2a2 2 0 002 2h2m10-16h2a2 2 0 012 2v2m0 10v2a2 2 0 01-2 2h-2M9 10h.01M15 10h.01M9.5 15.5c1.333 1 3.667 1 5 0" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                  Sign in with Biometrics
                </button>
              </div>
            </form>
          </section>

          {/* BEGIN: FeatureGrid (Mobile only) */}
          <section className="mt-6 mb-4 md:hidden">
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-white/80 backdrop-blur-sm border border-[#ede5d6] rounded-2xl p-2.5 flex flex-col items-center text-center shadow-soft active:bg-white transition-colors">
                <div className="w-7 h-7 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center mb-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </div>
                <span className="text-[11px] font-bold text-brand-navy leading-tight">Cloud Sync</span>
                <span className="text-[9.5px] text-brand-slate font-medium mt-0.5 leading-tight">Always in sync</span>
              </div>
              
              <div className="bg-white/80 backdrop-blur-sm border border-[#ede5d6] rounded-2xl p-2.5 flex flex-col items-center text-center shadow-soft active:bg-white transition-colors">
                <div className="w-7 h-7 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center mb-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </div>
                <span className="text-[11px] font-bold text-brand-navy leading-tight">Refill Tracking</span>
                <span className="text-[9.5px] text-brand-slate font-medium mt-0.5 leading-tight">Stay informed</span>
              </div>
              
              <div className="bg-white/80 backdrop-blur-sm border border-[#ede5d6] rounded-2xl p-2.5 flex flex-col items-center text-center shadow-soft active:bg-white transition-colors">
                <div className="w-7 h-7 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center mb-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </div>
                <span className="text-[11px] font-bold text-brand-navy leading-tight">A5 Print</span>
                <span className="text-[9.5px] text-brand-slate font-medium mt-0.5 leading-tight">Ready to print</span>
              </div>
            </div>
          </section>

          {/* BEGIN: FooterDetails (Mobile only) */}
          <footer className="text-center pt-2 pb-1 md:hidden">
            <p className="text-[9.5px] font-extrabold uppercase tracking-[0.2em] text-[#9b8d76] mb-1">
              Reliable  Simple  Built for your business
            </p>
            <p className="text-[10px] text-[#9b8d76]/80 font-medium">
              &copy; 2026 Mansur Enterprises. All rights reserved.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
};
