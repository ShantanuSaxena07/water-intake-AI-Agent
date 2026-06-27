'use client';
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

export default function Home() {
  // --- Auth & Onboarding State Variables ---
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authMode, setAuthMode] = useState('login'); 
  const [authError, setAuthError] = useState('');
  const [emailValidationError, setEmailValidationError] = useState('');

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
  const isTargetAchieved = percentage >= 100;

  // --- EMAIL REGEX VALIDATOR ---
  const validateEmailFormat = (inputEmail: string) => {
    setEmail(inputEmail);
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!inputEmail) {
      setEmailValidationError('');
    } else if (!emailRegex.test(inputEmail)) {
      setEmailValidationError('Please enter a valid email address (e.g., name@domain.com).');
    } else {
      setEmailValidationError('');
    }
  };

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
      if (session?.user) {
        setDisplayName(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Hydrator');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setDisplayName(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Hydrator');
      }
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
      setDisplayName('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // --- 2. DYNAMIC PROFILE SYNC & PROMPT TRIGGER ---
  const fetchOrCreateProfile = async () => {
    try {
      if (!user?.id) return;
      let { data, error } = await supabase
        .from('user_profiles')
        .select('daily_goal_ml, push_subscription, notifications_enabled, timezone')
        .eq('id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const { data: newProfile, error: insertError } = await supabase
          .from('user_profiles')
          .insert([{ id: user.id, daily_goal_ml: 2500, notifications_enabled: true, timezone: clientTz }])
          .select()
          .single();
        
        if (insertError) throw insertError;
        if (newProfile) {
          setDailyGoal(newProfile.daily_goal_ml);
          setNotificationsEnabled(true);
          if (notificationsEnabled) setShowPushModal(true);
        }
      } else if (error) {
        throw error;
      } else if (data) {
        setDailyGoal(data.daily_goal_ml);
        
        if (data.notifications_enabled !== undefined && data.notifications_enabled !== null) {
          setNotificationsEnabled(data.notifications_enabled);
        }
        
        const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (data.timezone !== clientTz) {
          await supabase
            .from('user_profiles')
            .update({ timezone: clientTz })
            .eq('id', user.id);
        }

        if (!data.push_subscription && typeof window !== 'undefined' && window.Notification && Notification.permission !== 'denied' && data.notifications_enabled) {
          setShowPushModal(true);
        }
      }
    } catch (err) {
      const errorObj = err as any;
      console.error("Profile sync error:", errorObj?.message);
    }
  };

  const handleToggleNotifications = async () => {
    const nextState = !notificationsEnabled;
    setNotificationsEnabled(nextState);
    
    try {
      if (!user?.id) return;
      await supabase
        .from('user_profiles')
        .update({ notifications_enabled: nextState })
        .eq('id', user.id);
        
      setChatHistory((prev) => [
        ...prev, 
        { sender: 'agent', text: nextState ? '🔔 Smart notification channels enabled!' : '🔕 Notifications successfully muted.' }
      ]);
    } catch (err) {
      console.error("Failed to sync preference status:", err);
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
    if (emailValidationError) {
      setAuthError('Please fix validation errors before proceeding.');
      return;
    }

    try {
      if (authMode === 'signup') {
        const { error, data } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              full_name: fullName.trim() || 'Hydrator'
            }
          }
        });
        if (error) throw error;
        alert('Account initialization successful! Check your email inbox for a verification link!');
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
        await saveWaterEntry(data.amount_ml);
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
        <div className="w-full max-w-md bg-slate-800 rounded-[35px] p-8 shadow-2xl border border-slate-700/60 relative overflow-hidden backdrop-blur-md">
          
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full filter blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-600/10 rounded-full filter blur-3xl pointer-events-none" />

          <h2 className="text-3xl font-black text-white tracking-wide text-center bg-gradient-to-r from-sky-400 to-white bg-clip-text text-transparent">HydroAgent AI</h2>
          <p className="text-xs text-slate-400 text-center mt-1.5 mb-8">Secure, intelligent pacing tracking dashboard.</p>
          
          <form onSubmit={handleAuth} className="space-y-5">
            {authMode === 'signup' && (
              <div className="animate-fade-in">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5 px-0.5">Your Full Name</label>
                <input 
                  type="text" 
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all placeholder-slate-600"
                  placeholder="e.g. Shantanu"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5 px-0.5">Email Address</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => validateEmailFormat(e.target.value)}
                className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 transition-all placeholder-slate-600 ${
                  emailValidationError ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-sky-500'
                }`}
                placeholder="you@domain.com"
              />
              {emailValidationError && (
                <p className="text-[11px] text-red-400 mt-1.5 ml-1 font-medium">{emailValidationError}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5 px-0.5">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-4 pr-11 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all placeholder-slate-600"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors focus:outline-none text-xs font-bold uppercase tracking-widest select-none"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {authError && <p className="text-xs text-red-400 bg-red-900/20 p-3 rounded-xl border border-red-800/40 font-medium">{authError}</p>}

            <button type="submit" className="w-full bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white py-3.5 rounded-xl font-bold text-sm shadow-xl transition-all active:scale-98 mt-2">
              {authMode === 'login' ? 'Sign In Dashboard' : 'Initialize Account'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-700/40 text-center text-xs text-slate-400">
            {authMode === 'login' ? (
              <p>Need isolated storage? <button onClick={() => { setAuthMode('signup'); setAuthError(''); }} className="text-sky-400 font-bold hover:underline ml-1">Create Account</button></p>
            ) : (
              <p>Already registered? <button onClick={() => { setAuthMode('login'); setAuthError(''); }} className="text-sky-400 font-bold hover:underline ml-1">Sign In</button></p>
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
          @keyframes celebration-glow {
            0%, 100% { filter: drop-shadow(0 0 6px rgba(52, 211, 153, 0.4)) drop-shadow(0 0 12px rgba(14, 165, 233, 0.2)); }
            50% { filter: drop-shadow(0 0 16px rgba(52, 211, 153, 0.8)) drop-shadow(0 0 24px rgba(14, 165, 233, 0.5)); }
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
          .animate-celebration {
            animation: celebration-glow 2s infinite ease-in-out;
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

        {/* TOP COMPACT HEADER SYSTEM WITH CUSTOM PERSONALIZED GREETING INTERFACE */}
        <div className="p-4 border-b border-slate-700 bg-slate-850 flex flex-col gap-3 px-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-lg font-black tracking-wide bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">HydroAgent AI</h1>
              {/* THE COOL GREETING ALIGNMENT PLACED PROPERLY BELOW MAIN BRANDING HEADER */}
              <p className="text-xs font-semibold text-sky-400/90 tracking-wide mt-0.5 select-none">
                ✨ Welcome back, <span className="text-white capitalize font-bold">{displayName}</span>
              </p>
            </div>
            
            <div className="flex items-center gap-2.5">
              <span className={`text-[9px] font-bold tracking-widest uppercase transition-colors duration-300 ${notificationsEnabled ? 'text-sky-400' : 'text-slate-500'}`}>
                Alerts
              </span>
              <button 
                onClick={handleToggleNotifications}
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
            <div className="flex flex-col items-center justify-center relative my-6">
              
              {/* BOTTLE STEM LAYOUT CONFIGURATION CONTAINER */}
              <div className="relative flex flex-col items-center group pt-3">
                
                {/* DYNAMIC ROTATING HOVER CAP COMPONENT */}
                <div 
                  className={`w-14 h-5 rounded-t-md transition-all duration-1000 cubic-bezier(0.4, 0, 0.2, 1) z-20 border-b border-slate-950/40 transform origin-center ${
                    isTargetAchieved 
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_-4px_12px_rgba(16,185,129,0.6)] translate-y-0 rotate-180 animate-celebration' 
                      : 'bg-gradient-to-r from-slate-600 to-slate-500 -translate-y-3 rotate-0'
                  }`} 
                />
                <div className={`w-18 h-2 transition-all duration-1000 cubic-bezier(0.4, 0, 0.2, 1) z-20 transform ${
                  isTargetAchieved ? 'bg-emerald-600/90 translate-y-0' : 'bg-slate-700 -translate-y-3'
                }`} />

                {/* BROAD WATER BOTTLE CONTAINER SHAPE */}
                <div 
                  className={`relative w-56 h-56 mt-[-2px] bg-transparent transition-all duration-700 flex items-center justify-center overflow-hidden border-4 shadow-[0_10px_30px_rgba(0,0,0,0.3)] ${
                    isTargetAchieved 
                      ? 'border-emerald-400/80 shadow-[0_0_25px_rgba(52,211,153,0.3)] animate-celebration' 
                      : 'border-slate-700/90'
                  }`}
                  style={{
                    borderRadius: '42% 42% 46% 46% / 35% 35% 48% 48%'
                  }}
                >
                  
                  {/* VECTOR LIQUID FLOW TRACK ENGINE */}
                  <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
                    <svg 
                      viewBox="0 0 100 100" 
                      className="w-full h-full absolute transition-all duration-1000 ease-out"
                      style={{ transform: `translateY(${100 - percentage}%)` }}
                      preserveAspectRatio="none"
                    >
                      <path d="M 0 10 Q 25 14 50 10 T 100 10 L 100 110 L 0 110 Z" fill="url(#water-gradient)">
                        <animate 
                          attributeName="d" 
                          dur="4s" 
                          repeatCount="indefinite"
                          values="
                            M 0 10 Q 25 14 50 10 T 100 10 L 100 110 L 0 110 Z;
                            M 0 10 Q 25 6 50 12 T 100 10 L 100 110 L 0 110 Z;
                            M 0 10 Q 25 14 50 10 T 100 10 L 100 110 L 0 110 Z
                          "
                        />
                      </path>
                      <defs>
                        <linearGradient id="water-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor={isTargetAchieved ? "#34d399" : "#38bdf8"} stopOpacity="0.9" />
                          <stop offset="100%" stopColor={isTargetAchieved ? "#047857" : "#2563eb"} stopOpacity="0.75" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>

                  {/* TYPOGRAPHY DATA LAYER */}
                  <div className="text-center z-10 px-4 select-none drop-shadow-[0_2px_10px_rgba(15,23,42,0.95)]">
                    <span className={`text-5xl font-black block tracking-tight font-mono transition-colors duration-500 ${isTargetAchieved ? 'text-emerald-300' : 'text-white'}`}>
                      {waterIntake}
                    </span>
                    
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
                        className={`text-[11px] uppercase tracking-widest font-bold cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 px-3 py-1 rounded-full border border-white/10 transition-all duration-200 block mt-1.5 ${
                          isTargetAchieved ? 'text-emerald-200 border-emerald-500/30 hover:border-emerald-400' : 'text-sky-200/90 hover:border-sky-400/50'
                        }`}
                      >
                        Target: {dailyGoal} ml ✎
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className={`mt-5 border px-4 py-1.5 rounded-full text-xs font-bold shadow-sm transition-all duration-500 ${
                isTargetAchieved ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400' : 'bg-slate-900/60 border-slate-700/50 text-sky-400'
              }`}>
                {isTargetAchieved ? '🎉 TARGET ACCOMPLISHED!' : `${Math.round(percentage)}% Accounted`}
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