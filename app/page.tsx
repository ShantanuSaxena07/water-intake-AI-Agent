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
  const [chatHistory, setChatHistory] = useState([
    { sender: 'agent', text: 'Hello! I am your AI Water Assistant. Your entries are safely secured to your private account!' }
  ]);

  // --- View & Notification State Controls ---
  const [currentTab, setCurrentTab] = useState<'main' | 'history' | 'schedule'>('main');
  const [weeklyHistory, setWeeklyHistory] = useState<any[]>([]);
  const [showPushModal, setShowPushModal] = useState(false); // Controls advanced push invitation visibility

  const percentage = Math.min((waterIntake / dailyGoal) * 100, 100);

  const scheduleSlots = [
    { time: '08:00 AM', label: 'Morning Wakeup', pct: 0.15 },
    { time: '11:00 AM', label: 'Mid-Morning Boost', pct: 0.35 },
    { time: '01:30 PM', label: 'Post-Lunch Hydration', pct: 0.55 },
    { time: '04:00 PM', label: 'Mid-Afternoon Refresh', pct: 0.75 },
    { time: '07:00 PM', label: 'Dinner Companion', pct: 0.90 },
    { time: '09:30 PM', label: 'Night Wind-Down', pct: 1.00 },
  ];

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
  }, [user]);

  // --- 2. DYNAMIC PROFILE SYNC & PROMPT TRIGGER ---
  const fetchOrCreateProfile = async () => {
    try {
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
          setShowPushModal(true); // Brand new user, invite to push notifications immediately!
        }
      } else if (error) {
        throw error;
      } else if (data) {
        setDailyGoal(data.daily_goal_ml);
        // If they haven't set up dynamic push subscriptions yet, remind them gently
        if (!data.push_subscription && Notification.permission !== 'denied') {
          setShowPushModal(true);
        }
      }
    } catch (err) {
      const errorObj = err as any;
      console.error("Profile sync error:", errorObj?.message);
    }
  };

  // --- ADVANCED LOGIC: Register Browser Service Worker & Handshake with Keys ---
  const registerPushNotifications = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('Push notifications are not natively supported on this specific browser environment.');
        return;
      }

      // 1. Request structural permissions from the host hardware device
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setShowPushModal(false);
        return;
      }

      // 2. Register our custom sw.js script in the browser thread
      await navigator.serviceWorker.register('/sw.js');
      
      // Wait until the browser confirms the Service Worker is fully booted and active
      const registration = await navigator.serviceWorker.ready;
      
      // 3. Complete Handshake using your Public VAPID key (with hardcoded string fallback)
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BMjCfUN_5D-zH3l84gVj2VEGiDY4QuquMGGJEDm7K5NoBtS4DbIVrIwg_bujBJFpBSsa32JMicbC267jJeIgdZc';

      // Convert the base64 VAPID string to a UInt8Array that the browser's PushManager demands
      const padding = '='.repeat((4 - (publicKey.length % 4)) % 4);
      const base64 = (publicKey + padding).replace(/\-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: outputArray
      });

      // 4. Fetch true current user session to circumvent local state timing issues
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id || user?.id;

      if (!currentUserId) {
        console.warn("Skipping DB update: No authenticated user ID found.");
        return;
      }

      // Save this delivery token address directly to their cloud column row!
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
      const { error } = await supabase
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

  const handleAuth = async (e: any) => {
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

  const handleSendMessage = async (e: any) => {
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
                onChange={(e: any) => setEmail(e.target.value)}
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
                onChange={(e: any) => setPassword(e.target.value)}
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
      <div className="w-full max-w-md h-[850px] bg-slate-800 rounded-[40px] shadow-2xl border-8 border-slate-700 flex flex-col overflow-hidden relative">
        
        {/* NEW PERMISSIONS PROMPT CARD MODAL */}
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
            <h1 className="text-lg font-bold tracking-wide">HydroAgent AI</h1>
            <button onClick={handleSignOut} className="text-[11px] font-semibold text-slate-400 bg-slate-700/60 hover:bg-slate-600 px-2.5 py-1.5 rounded-xl border border-slate-600 transition-all">
              Exit
            </button>
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
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="border-b border-slate-700 pb-2">
              <h2 className="text-base font-bold text-white">Hydration Schedule</h2>
              <p className="text-xs text-slate-400">Timed interval goals scaled to match your target</p>
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
                        <span className="text-xs text-slate-400 block font-medium">Target Stack</span>
                        <span className={`text-xs font-bold ${isMet ? 'text-emerald-400' : 'text-slate-300'}`}>
                          {isMet ? '✓ Achieved' : `${requiredAmount} ml`}
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
          <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
            <div className="flex flex-col items-center justify-center relative my-4">
              <div className="relative w-48 h-48 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-[12px] border-slate-700"></div>
                <div className="text-center z-10 p-2">
                  <span className="text-4xl font-extrabold text-sky-400 block">{waterIntake}</span>
                  {isEditingGoal ? (
                    <input
                      type="number"
                      defaultValue={dailyGoal}
                      onBlur={(e: any) => updateDailyGoalInCloud(Number(e.target.value) || 2500)}
                      onKeyDown={(e: any) => {
                        if (e.key === 'Enter') updateDailyGoalInCloud(Number(e.target.value) || 2500);
                      }}
                      autoFocus
                      className="w-20 bg-slate-950 border border-sky-500 rounded text-center text-xs text-white p-0.5 mt-1 font-semibold"
                    />
                  ) : (
                    <span 
                      onClick={() => setIsEditingGoal(true)}
                      className="text-xs text-slate-400 uppercase tracking-widest font-semibold cursor-pointer border-b border-dashed border-slate-500 hover:text-sky-400 transition-all block mt-1"
                    >
                      of {dailyGoal} ml
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-4 bg-slate-700/50 px-4 py-1.5 rounded-full text-xs font-medium text-sky-300">
                {Math.round(percentage)}% Completed
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Quick Log</h3>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => handleQuickAdd(250)} className="bg-slate-700 hover:bg-slate-600 active:scale-95 text-white py-3 rounded-2xl font-semibold text-sm transition-all shadow-md">
                  +250ml <span className="block text-[10px] text-slate-400 font-normal">Glass</span>
                </button>
                <button onClick={() => handleQuickAdd(500)} className="bg-slate-700 hover:bg-slate-600 active:scale-95 text-white py-3 rounded-2xl font-semibold text-sm transition-all shadow-md">
                  +500ml <span className="block text-[10px] text-slate-400 font-normal">Bottle</span>
                </button>
                <button onClick={() => handleQuickAdd(750)} className="bg-slate-700 hover:bg-slate-600 active:scale-95 text-white py-3 rounded-2xl font-semibold text-sm transition-all shadow-md">
                  +750ml <span className="block text-[10px] text-slate-400 font-normal">Flask</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Agent Chat</h3>
              <div className="bg-slate-900/60 rounded-2xl p-4 h-48 overflow-y-auto space-y-3 text-sm border border-slate-700/50">
                {chatHistory.map((msg: any, idx: number) => (
                  <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm leading-relaxed ${
                      msg.sender === 'user' ? 'bg-sky-600 text-white rounded-tr-none' : 'bg-slate-700 text-slate-200 rounded-tl-none'
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
            onChange={(e: any) => setChatMessage(e.target.value)}
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