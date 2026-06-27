'use client';
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

export default function Home() {
  // --- Auth State Variables ---
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState('login'); 
  const [authError, setAuthError] = useState('');

  // --- App Tracker State Variables ---
  const [waterIntake, setWaterIntake] = useState(0); 
  const [dailyGoal, setDailyGoal] = useState(2500); 
  const [isEditingGoal, setIsEditingGoal] = useState(false); 
  const [chatMessage, setChatMessage] = useState(''); 
  const [isLoading, setIsLoading] = useState(false); 
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [chatHistory, setChatHistory] = useState<Array<{ sender: string; text: string }>>([
    { sender: 'agent', text: 'Hello! I am your AI Water Assistant. Your entries are safely secured to your private account!' }
  ]);

  // --- View & Notification State Controls ---
  const [currentTab, setCurrentTab] = useState<'main' | 'history' | 'schedule'>('main');
  const [weeklyHistory, setWeeklyHistory] = useState<any[]>([]);
  const [showPushModal, setShowPushModal] = useState(false); 

  const percentage = Math.min((waterIntake / dailyGoal) * 100, 100);

  // --- HEALTH-OPTIMIZED DYNAMIC TIMELINE ALGORITHM ---
  const [scheduleSlots, setScheduleSlots] = useState<any[]>([]);

  useEffect(() => {
    let slotsCount = 4; 
    if (dailyGoal > 1800 && dailyGoal <= 3000) slotsCount = 6;
    if (dailyGoal > 3000) slotsCount = 8; 

    const generatedSlots = [];
    const morningStart = 8; 
    const eveningEnd = 21.5; 
    const totalAvailableHours = eveningEnd - morningStart;
    const intervalDelta = totalAvailableHours / (slotsCount - 1);

    for (let i = 0; i < slotsCount; i++) {
      const targetHourDecimal = morningStart + (i * intervalDelta);
      const displayHour = Math.floor(targetHourDecimal);
      const displayMinutes = Math.round((targetHourDecimal % 1) * 60);
      
      const ampm = displayHour >= 12 ? 'PM' : 'AM';
      const formattedHour = displayHour % 12 === 0 ? 12 : displayHour % 12;
      const formattedMinutes = displayMinutes < 10 ? `0${displayMinutes}` : displayMinutes;
      const timeLabel = `${formattedHour}:${formattedMinutes} ${ampm}`;

      const cumulativePct = (i + 1) / slotsCount;

      let label = 'Hydration Window';
      if (i === 0) label = 'Morning Wakeup Wake';
      else if (i === slotsCount - 1) label = 'Night Wind-Down Seal';
      else if (cumulativePct <= 0.4) label = 'Mid-Morning Target';
      else if (cumulativePct <= 0.7) label = 'Post-Lunch Distribution';
      else label = 'Evening Companion';

      generatedSlots.push({
        time: timeLabel,
        label: label,
        pct: Number(cumulativePct.toFixed(2))
      });
    }

    setScheduleSlots(generatedSlots);
  }, [dailyGoal]);

  // --- 1. AUTH MONITOR ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchOrCreateProfile();
      fetchTodayWater();
      fetchWeeklyHistory();
    } else {
      setWaterIntake(0);
      setDailyGoal(2500);
      setWeeklyHistory([]);
      setShowPushModal(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // --- 2. DYNAMIC PROFILE SYNC & PROMPT TRIGGER ---
  const fetchOrCreateProfile = async () => {
    try {
      if (!user?.id) return;
      let { data, error } = await supabase
        .from('user_profiles')
        .select('daily_goal_ml, push_subscription')
        .eq('id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        const { data: newProfile, error: insertError } = await supabase
          .from('user_profiles')
          .insert([{ id: user.id, daily_goal_ml: 2500 }])
          .select()
          .single();
        
        if (insertError) throw insertError;
        if (newProfile) {
          setDailyGoal(newProfile.daily_goal_ml);
          if (notificationsEnabled) setShowPushModal(true);
        }
      } else if (error) {
        throw error;
      } else if (data) {
        setDailyGoal(data.daily_goal_ml);
        if (!data.push_subscription && typeof window !== 'undefined' && window.Notification && Notification.permission !== 'denied' && notificationsEnabled) {
          setShowPushModal(true);
        }
      }
    } catch (err) {
      const errorObj = err as any;
      console.error("Profile sync error:", errorObj?.message);
    }
  };

  // --- Register Browser Service Worker & Handshake with Keys ---
  const registerPushNotifications = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('Push notifications are not natively supported on this specific browser environment.');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setShowPushModal(false);
        return;
      }

      await navigator.serviceWorker.register('/sw.js');
      const registration = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BMjCfUN_5D-zH3l84gVj2VEGiDY4QuquMGGJEDm7K5NoBtS4DbIVrIwg_bujBJFpBSsa32JMicbC267jJeIgdZc';

      const padding = '='.repeat((4 - (publicKey.length % 4)) % 4);
      const base64 = (publicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: outputArray
      });

      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id || user?.id;

      if (!currentUserId) return;

      const { error } = await supabase
        .from('user_profiles')
        .update({ push_subscription: subscription })
        .eq('id', currentUserId);

      if (error) throw error;

      setShowPushModal(false);
      setChatHistory((prev) => [...prev, { sender: 'agent', text: '🎉 Push alerts successfully linked! I will notify you when the timeline hits.' }]);

    } catch (err) {
      const errorObj = err as any;
      console.error("Notification registration crash:", errorObj?.message);
      alert('Failed to connect subscription lines.');
    }
  };

  const updateDailyGoalInCloud = async (newGoal: number) => {
    try {
      if (!user?.id) return;
      const { error = null } = await supabase
        .from('user_profiles')
        .update({ daily_goal_ml: newGoal })
        .eq('id', user.id);

      if (error) throw error;
      setDailyGoal(newGoal);
      setIsEditingGoal(false);
    } catch (err) {
      const errorObj = err as any;
      console.error("Failed to update goal:", errorObj?.message);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Check your email inbox for a verification link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      const errorObj = err as any;
      setAuthError(errorObj?.message || 'Authentication failed');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const fetchTodayWater = async () => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('water_entries')
        .select('amount_ml')
        .gte('created_at', todayStart.toISOString()); 

      if (error) throw error;

      const total = data.reduce((sum: number, entry: any) => sum + entry.amount_ml, 0);
      setWaterIntake(total);
    } catch (err) {
      const errorObj = err as any;
      console.error("Error reading data:", errorObj?.message);
    }
  };

  const fetchWeeklyHistory = async () => {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('water_entries')
        .select('amount_ml, created_at')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const groups: { [key: string]: number } = {};
      
      data.forEach((entry: any) => {
        const dateKey = new Date(entry.created_at).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric'
        });
        groups[dateKey] = (groups[dateKey] || 0) + entry.amount_ml;
      });

      const formattedHistory = Object.keys(groups).map(dateStr => ({
        date: dateStr,
        total: groups[dateStr]
      }));

      setWeeklyHistory(formattedHistory);
    } catch (err) {
      const errorObj = err as any;
      console.error("History fetch failure:", errorObj?.message);
    }
  };

  const saveWaterEntry = async (amount: number) => {
    try {
      const { error } = await supabase
        .from('water_entries')
        .insert([{ amount_ml: amount }]); 

      if (error) throw error;
      setWaterIntake((prev) => Math.max(0, prev + amount));
      fetchWeeklyHistory(); 
    } catch (err) {
      const errorObj = err as any;
      console.error("Database save error:", errorObj?.message);
    }
  };

  const resetWaterEntries = async () => {
    try {
      const { error } = await supabase
        .from('water_entries')
        .delete()
        .neq('id', 0);

      if (error) throw error;
      setWaterIntake(0);
      fetchWeeklyHistory();
    } catch (err) {
      const errorObj = err as any;
      console.error("Database reset error:", errorObj?.message);
    }
  };

  const handleQuickAdd = async (amount: number) => {
    await saveWaterEntry(amount);
    setChatHistory((prev) => [...prev, { sender: 'agent', text: `Logged ${amount}ml to your private account!` }]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || isLoading) return;

    const currentMessage = chatMessage;
    setChatHistory((prev) => [...prev, { sender: 'user', text: currentMessage }]);
    setChatMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage: currentMessage }),
      });

      const data = await response.json();

      if (data.action === 'log' && data.amount_ml > 0) {
        await saveWaterEntry(data.action === 'log' && data.amount_ml > 0 ? data.amount_ml : 0);
      } 
      else if (data.action === 'decrease' && data.amount_ml > 0) {
        await saveWaterEntry(-data.amount_ml);
      } 
      else if (data.action === 'reset') {
        await resetWaterEntries();
      }

      setChatHistory((prev) => [...prev, { sender: 'agent', text: data.ai_reply }]);

    } catch (error) {
      console.error("AI Fetch Failure:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-900 font-sans p-4">
        <div className="w-full max-w-md bg-slate-800 rounded-[30px] p-8 shadow-2xl border border-slate-700 text-center">
          <h2 className="text-3xl font-extrabold text-white tracking-wide mb-2">HydroAgent AI</h2>
          <p className="text-sm text-slate-400 mb-6">Create an account to securely isolate your tracking stats.</p>
          
          <form onSubmit={handleAuth} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Email Address</label>
              <input 
                type="email" 
                required
                suppressHydrationWarning
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Password</label>
              <input 
                type="password" 
                required
                suppressHydrationWarning
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="••••••••"
              />
            </div>

            {authError && <p className="text-xs text-red-400 bg-red-900/30 p-3 rounded-lg border border-red-800">{authError}</p>}

            <button type="submit" className="w-full bg-sky-600 hover:bg-sky-500 text-white py-3.5 rounded-xl font-semibold text-sm shadow-lg transition-all active:scale-95">
              {authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-700/50 text-xs text-slate-400">
            {authMode === 'login' ? (
              <p>Need a private account? <button onClick={() => setAuthMode('signup')} className="text-sky-400 font-bold hover:underline">Sign Up</button></p>
            ) : (
              <p>Already have an account? <button onClick={() => setAuthMode('login')} className="text-sky-400 font-bold hover:underline">Sign In</button></p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-slate-900 font-sans p-4">
      <div className="w-full max-w-md h-[850px] bg-slate-800 rounded-[40px] shadow-2xl border-8 border-slate-700 flex flex-col overflow-hidden relative [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-slate-900/20 [&::-webkit-scrollbar-thumb]:bg-slate-700/80 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-sky-600/50">
        
        <style jsx global>{`
          @keyframes text-pulse-blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
          @keyframes fluid-wobble-base {
            0% { baseFrequency: 0.015 0.035; }
            50% { baseFrequency: 0.025 0.045; }
            100% { baseFrequency: 0.015 0.035; }
          }
          .scrollbar-elegant::-webkit-scrollbar {
            width: 5px;
          }
          .scrollbar-elegant::-webkit-scrollbar-track {
            background: rgba(15, 23, 42, 0.3);
            border-radius: 999px;
          }
          .scrollbar-elegant::-webkit-scrollbar-thumb {
            background: rgba(100, 116, 139, 0.4);
            border-radius: 999px;
            transition: all 0.2s;
          }
          .scrollbar-elegant::-webkit-scrollbar-thumb:hover {
            background: rgba(14, 165, 233, 0.6);
          }
          .no-spinners::-webkit-outer-spin-button,
          .no-spinners::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          .no-spinners {
            -moz-appearance: textfield;
          }
          .animate-text-blink {
            animation: text-pulse-blink 1.4s infinite ease-in-out;
          }
          .wobble-filter-engine {
            animation: fluid-wobble-base 5s infinite ease-in-out;
          }
        `}</style>

        {showPushModal && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-slate-800 border border-slate-700 w-full max-w-xs rounded-3xl p-6 text-center shadow-2xl animate-fade-in">
              <div className="w-12 h-12 bg-sky-500/10 text-sky-400 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">🔔</div>
              <h3 className="text-base font-bold text-white tracking-wide">Enable Reminders?</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Receive advanced smart alerts when timeline intervals trigger to keep your high-performance hydration targets completely on track.
              </p>
              <div className="mt-5 space-y-2">
                <button 
                  onClick={registerPushNotifications}
                  className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs py-2.5 rounded-xl shadow transition-all active:scale-95"
                >
                  Yes, Keep Me Hydrated
                </button>
                <button 
                  onClick={() => setShowPushModal(false)}
                  className="w-full bg-transparent hover:bg-slate-700/40 text-slate-400 font-medium text-xs py-2 rounded-xl transition-all"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 text-center text-white border-b border-slate-700 bg-slate-850 flex flex-col gap-3 px-6">
          <div className="flex justify-between items-center">
            <h1 className="text-lg font-bold tracking-wide bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">HydroAgent AI</h1>
            
            <div className="flex items-center gap-2.5">
              <span className={`text-[9px] font-bold tracking-widest uppercase transition-colors duration-300 ${notificationsEnabled ? 'text-sky-400' : 'text-slate-500'}`}>
                Alerts
              </span>
              <button 
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 relative outline-none border border-slate-600/50 ${
                  notificationsEnabled ? 'bg-sky-500/20 border-sky-400/40 shadow-[0_0_10px_rgba(14,165,233,0.2)]' : 'bg-slate-900'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center text-[8px] font-bold ${
                  notificationsEnabled ? 'translate-x-4 bg-sky-400 text-slate-950' : 'translate-x-0 bg-slate-500 text-white'
                }`}>
                  {notificationsEnabled ? '✓' : '✕'}
                </div>
              </button>

              <button onClick={handleSignOut} className="text-[11px] font-semibold text-slate-400 bg-slate-700/60 hover:bg-slate-600 px-2.5 py-1.5 rounded-xl border border-slate-600 transition-all">
                Exit
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-3 bg-slate-900/80 p-1 rounded-xl text-xs font-medium border border-slate-700/40">
            <button onClick={() => setCurrentTab('main')} className={`py-1.5 rounded-lg transition-all ${currentTab === 'main' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
              Tracker
            </button>
            <button onClick={() => setCurrentTab('schedule')} className={`py-1.5 rounded-lg transition-all ${currentTab === 'schedule' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
              Timeline
            </button>
            <button onClick={() => setCurrentTab('history')} className={`py-1.5 rounded-lg transition-all ${currentTab === 'history' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
              History
            </button>
          </div>
        </div>

        {currentTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-elegant">
            <div className="border-b border-slate-700 pb-2">
              <h2 className="text-base font-bold text-white">7-Day Intake History</h2>
              <p className="text-xs text-slate-400">Clean aggregated summary of daily water totals</p>
            </div>
            {weeklyHistory.length === 0 ? (
              <div className="text-center text-slate-500 text-sm py-12 italic">No hydration records found.</div>
            ) : (
              <div className="space-y-3 pt-2">
                {weeklyHistory.map((item, index) => (
                  <div key={index} className="flex justify-between items-center bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4 shadow-sm">
                    <span className="text-sm font-semibold text-slate-200">{item.date}</span>
                    <span className="text-sm font-bold text-sky-400">{(item.total / 1000).toFixed(1)} Litres</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentTab === 'schedule' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4 pb-36 scrollbar-elegant">
            <div className="border-b border-slate-700 pb-2">
              <h2 className="text-base font-bold text-white">Adaptive Hydration Pacing</h2>
              <p className="text-xs text-slate-400">Dynamic targets recalibrated using clinical fluid distribution limits.</p>
            </div>

            <div className="relative border-l-2 border-slate-700 ml-4 pl-6 space-y-6 pt-4">
              {scheduleSlots.map((slot, index) => {
                const requiredAmount = Math.round(dailyGoal * slot.pct);
                const isMet = waterIntake >= requiredAmount;

                return (
                  <div key={index} className="relative group">
                    <div className={`absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border-2 transition-all ${
                      isMet ? 'bg-sky-500 border-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]' : 'bg-slate-800 border-slate-600'
                    }`} />
                    
                    <div className="bg-slate-900/40 border border-slate-700/40 rounded-xl p-3 shadow-sm flex justify-between items-center">
                      <div>
                        <span className="text-xs font-bold text-sky-400 block tracking-wide">{slot.time}</span>
                        <span className="text-sm font-medium text-slate-200 block mt-0.5">{slot.label}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block font-medium">Interval Target</span>
                        <span className={`text-xs font-bold ${isMet ? 'text-emerald-400' : 'text-slate-300'}`}>
                          {isMet ? '✓ Met' : `${requiredAmount} ml`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {currentTab === 'main' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32 scrollbar-elegant">
            <div className="flex flex-col items-center justify-center relative my-4">
              <div className="relative w-52 h-52 bg-transparent rounded-full border-4 border-slate-700/80 shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex items-center justify-center overflow-hidden">
                
                {/* RECALIBRATED SVG GRAPHICS ENGINE FEATURING LOCALIZED TURBULENCE FILTERS FOR TRUE NATURAL WOBBLE EFFECTS */}
                <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
                  <svg 
                    viewBox="0 0 100 100" 
                    className="w-full h-full absolute transition-all duration-1000 ease-out"
                    style={{ 
                      transform: `translateY(${100 - percentage}%)`,
                      filter: 'url(#fluid-displacement-wobble)'
                    }}
                    preserveAspectRatio="none"
                  >
                    {/* FIXED DEPTH FLUID LEVEL MESH */}
                    <path 
                      d="M 0 10 Q 25 14 50 10 T 100 10 L 100 110 L 0 110 Z" 
                      fill="url(#water-gradient)" 
                    />
                    <defs>
                      <linearGradient id="water-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity="0.75" />
                      </linearGradient>

                      {/* HIGH-PERFORMANCE NOISE ENGINE FOR IN-PLACE PHYSICAL RIPPLES */}
                      <filter id="fluid-displacement-wobble" x="0%" y="0%" width="100%" height="100%">
                        <feTurbulence 
                          type="fractalNoise" 
                          numOctaves="2" 
                          result="noise" 
                          className="wobble-filter-engine"
                        />
                        <feDisplacementMap 
                          in="SourceGraphic" 
                          in2="noise" 
                          scale="4" 
                          xChannelSelector="R" 
                          yChannelSelector="G" 
                        />
                      </filter>
                    </defs>
                  </svg>
                </div>

                {/* TEXT LAYER FLOATING IN THE STRUCTURAL MIDPOINT */}
                <div className="text-center z-10 px-4 select-none drop-shadow-[0_2px_10px_rgba(15,23,42,0.95)]">
                  <span className="text-5xl font-black text-white block tracking-tight font-mono">{waterIntake}</span>
                  
                  {isEditingGoal ? (
                    <div className="mt-1 bg-slate-900/90 rounded-full px-3 py-1 border border-sky-400/50 shadow-[0_0_15px_rgba(14,165,233,0.3)] flex items-center justify-center">
                      <input
                        type="number"
                        defaultValue={dailyGoal}
                        onBlur={(e: React.FocusEvent<HTMLInputElement>) => updateDailyGoalInCloud(Number(e.target.value) || 2500)}
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                          if (e.key === 'Enter') updateDailyGoalInCloud(Number((e.target as HTMLInputElement).value) || 2500);
                        }}
                        autoFocus
                        className="w-20 bg-transparent text-center text-xs text-white font-black outline-none focus:ring-0 p-0 border-none no-spinners animate-text-blink"
                      />
                    </div>
                  ) : (
                    <span 
                      onClick={() => setIsEditingGoal(true)}
                      className="text-[11px] text-sky-200/90 hover:text-white uppercase tracking-widest font-bold cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 px-3 py-1 rounded-full border border-white/10 hover:border-sky-400/50 transition-all duration-200 block mt-1.5"
                    >
                      Target: {dailyGoal} ml ✎
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 bg-slate-900/60 border border-slate-700/50 px-4 py-1.5 rounded-full text-xs font-bold text-sky-400 shadow-sm">
                {Math.round(percentage)}% Accounted
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Quick Log</h3>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => handleQuickAdd(250)} className="bg-slate-700 hover:bg-slate-600 active:scale-95 text-white py-3 rounded-2xl font-semibold text-sm transition-all shadow-md border border-slate-600/30">
                  +250ml <span className="block text-[10px] text-slate-400 font-normal mt-0.5">Glass</span>
                </button>
                <button onClick={() => handleQuickAdd(500)} className="bg-slate-700 hover:bg-slate-600 active:scale-95 text-white py-3 rounded-2xl font-semibold text-sm transition-all shadow-md border border-slate-600/30">
                  +500ml <span className="block text-[10px] text-slate-400 font-normal mt-0.5">Bottle</span>
                </button>
                <button onClick={() => handleQuickAdd(750)} className="bg-slate-700 hover:bg-slate-600 active:scale-95 text-white py-3 rounded-2xl font-semibold text-sm transition-all shadow-md border border-slate-600/30">
                  +750ml <span className="block text-[10px] text-slate-400 font-normal mt-0.5">Flask</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Agent Chat</h3>
              <div className="bg-slate-900/60 rounded-2xl p-4 h-48 overflow-y-auto space-y-3 text-sm border border-slate-700/50 scrollbar-elegant">
                {chatHistory.map((msg: any, idx: number) => (
                  <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm leading-relaxed ${
                      msg.sender === 'user' ? 'bg-sky-600 text-white rounded-tr-none border border-sky-500/30' : 'bg-slate-700 text-slate-200 rounded-tl-none border border-slate-600/30'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-700/50 text-slate-400 rounded-2xl rounded-tl-none px-4 py-2 text-xs italic animate-pulse">
                      Agent is processing...
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="absolute bottom-0 left-0 right-0 p-4 bg-slate-800 border-t border-slate-700 flex gap-2 items-center backdrop-blur-md z-30">
          <input 
            type="text" 
            value={chatMessage}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChatMessage(e.target.value)}
            disabled={isLoading}
            placeholder={isLoading ? "Thinking..." : "Tell the AI what you drank..."} 
            className="flex-1 bg-slate-900 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-500 border border-slate-700 disabled:opacity-50"
          />
          <button type="submit" disabled={isLoading} className="bg-sky-600 hover:bg-sky-500 active:scale-95 text-white px-5 py-3 rounded-xl font-medium text-sm transition-all shadow-md disabled:opacity-50">
            {isLoading ? "..." : "Send"}
          </button>
        </form>

      </div>
    </div>
  );
}