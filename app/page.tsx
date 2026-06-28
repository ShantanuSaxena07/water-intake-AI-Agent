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
    { sender: 'agent', text: 'Hello! I am your AI Water Assistant. Tell me if you went to the gym or if it is boiling hot today!' }
  ]);

  // --- Advanced Gamification & Personalization States ---
  const [currentStreak, setCurrentStreak] = useState(0);
  const [customButtonMl, setCustomButtonMl] = useState(600);
  const [isEditingCustomButton, setIsEditingCustomButton] = useState(false);
  const [isSloshing, setIsSloshing] = useState(false);
  
  // --- FAB & Modal Control Trackers ---
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'about' | 'instructions' | null>(null);

  // --- View & Notification State Controls ---
  const [currentTab, setCurrentTab] = useState<'main' | 'history' | 'schedule'>('main');
  const [weeklyHistory, setWeeklyHistory] = useState<Array<{ date: string; total: number }>>([]);
  const [showPushModal, setShowPushModal] = useState(false); 

  const percentage = Math.min((waterIntake / dailyGoal) * 100, 100);
  const isTargetAchieved = percentage >= 100;

  // --- NATIVE PROCEDURAL AUDIO DROP ENGINE ---
  const playSplashSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.12);
      
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.warn('Audio context blocked by browser gesture permissions.');
    }
  };

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
      setCurrentStreak(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // --- 2. DYNAMIC PROFILE SYNC & PROMPT TRIGGER ---
  const fetchOrCreateProfile = async () => {
    try {
      if (!user?.id) return;
      let { data, error } = await supabase
        .from('user_profiles')
        .select('daily_goal_ml, push_subscription, notifications_enabled, timezone, custom_button_ml')
        .eq('id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const { data: newProfile, error: insertError } = await supabase
          .from('user_profiles')
          .insert([{ id: user.id, daily_goal_ml: 2500, notifications_enabled: true, timezone: clientTz, custom_button_ml: 600 }])
          .select()
          .single();
        
        if (insertError) throw insertError;
        if (newProfile) {
          setDailyGoal(newProfile.daily_goal_ml);
          setNotificationsEnabled(true);
          setCustomButtonMl(600);
          setShowPushModal(true);
        }
      } else if (error) {
        throw error;
      } else if (data) {
        setDailyGoal(data.daily_goal_ml);
        if (data.custom_button_ml) setCustomButtonMl(data.custom_button_ml);
        
        let existingNotifState = true;
        if (data.notifications_enabled !== undefined && data.notifications_enabled !== null) {
          setNotificationsEnabled(data.notifications_enabled);
          existingNotifState = data.notifications_enabled;
        }
        
        const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (data.timezone !== clientTz) {
          await supabase
            .from('user_profiles')
            .update({ timezone: clientTz })
            .eq('id', user.id);
        }

        // RE-CALIBRATED VERIFICATION PIPELINE TO ENSURE BROWSER HANDSHAKE TRIGGER MAPS PROPERLY
        if (!data.push_subscription && typeof window !== 'undefined' && window.Notification && Notification.permission !== 'denied' && existingNotifState) {
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

  const updateCustomButtonValue = async (val: number) => {
    try {
      if (!user?.id) return;
      const cleanVal = Math.max(50, Math.min(2000, val));
      await supabase
        .from('user_profiles')
        .update({ custom_button_ml: cleanVal })
        .eq('id', user.id);
      setCustomButtonMl(cleanVal);
      setIsEditingCustomButton(false);
    } catch (err) {
      console.error(err);
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
        
        if (data?.user) {
          setUser(data.user);
          setDisplayName(fullName.trim() || 'Hydrator');
        }
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

      const { data, error = null } = await supabase
        .from('water_entries')
        .select('amount_ml')
        .gte('created_at', todayStart.toISOString()); 

      if (error) throw error;

      const total = (data || []).reduce((sum: number, entry: any) => sum + entry.amount_ml, 0);
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
      
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dKey = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        groups[dKey] = 0;
      }

      (data || []).forEach((entry: any) => {
        const dateKey = new Date(entry.created_at).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        });
        if (groups[dateKey] !== undefined) {
          groups[dateKey] += entry.amount_ml;
        }
      });

      const formattedHistory = Object.keys(groups).map(dateStr => ({
        date: dateStr,
        total: groups[dateStr]
      }));

      setWeeklyHistory(formattedHistory);

      let streak = 0;
      let checkDate = new Date();
      
      while (true) {
        const matchKey = checkDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        if (groups[matchKey] !== undefined && groups[matchKey] >= dailyGoal) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          if (streak === 0) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yKey = yesterday.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            if (groups[yKey] !== undefined && groups[yKey] >= dailyGoal) {
              streak = 1;
              checkDate = yesterday;
              checkDate.setDate(checkDate.getDate() - 1);
              continue;
            }
          }
          break;
        }
      }
      setCurrentStreak(streak);

    } catch (err) {
      console.error("History analytics failure:", err);
    }
  };

  const saveWaterEntry = async (amount: number) => {
    try {
      const { error } = await supabase
        .from('water_entries')
        .insert([{ amount_ml: amount }]); 

      if (error) throw error;
      
      playSplashSound();
      setIsSloshing(true);
      setTimeout(() => setIsSloshing(false), 800);

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

      const lowercaseMsg = currentMessage.toLowerCase();
      if (lowercaseMsg.includes('gym') || lowercaseMsg.includes('workout') || lowercaseMsg.includes('exercise')) {
        const advancedGoal = dailyGoal + 400;
        setDailyGoal(advancedGoal);
        data.ai_reply += " 🏋️‍♂️ I noticed your high-performance gym log! I have boosted your pacing timeline target by 400ml.";
      } else if (lowercaseMsg.includes('hot') || lowercaseMsg.includes('boiling') || lowercaseMsg.includes('sun')) {
        const advancedGoal = dailyGoal + 350;
        setDailyGoal(advancedGoal);
        data.ai_reply += " ☀️ Ambient climate surge detected! I expanded your tracking scale threshold by 350ml.";
      }

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
    <div className="flex justify-center items-center min-h-screen bg-slate-900 font-sans p-4 relative">
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
          @keyframes visual-slosh {
            0%, 100% { transform: scale(1); }
            30% { transform: scale(1.04) skewX(3deg); }
            60% { transform: scale(0.97) skewX(-2deg); }
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
          .animate-slosh {
            animation: visual-slosh 0.8s ease-in-out;
          }
        `}</style>

        {showPushModal && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-slate-800 border border-slate-700 w-full max-w-xs rounded-3xl p-6 text-center shadow-2xl animate-fade-in">
              <div className="w-12 h-12 bg-sky-500/10 text-sky-400 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">🔔</div>
              <h3 className="text-base font-bold text-white tracking-wide">Enable Reminders?</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Receive advanced smart alerts when timeline intervals trigger to keep your hydration targets on track.
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

        {/* --- DYNAMIC GLASSMORPHISM MODAL OVERLAYS --- */}
        {activeModal === 'about' && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-50 p-6 flex flex-col justify-center items-center">
            <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 w-full max-w-sm text-left shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-700 pb-2.5">
                <h3 className="text-base font-black text-white tracking-wide">ℹ️ System Architecture</h3>
                <button onClick={() => setActiveModal(null)} className="text-xs font-bold text-slate-400 bg-slate-900/60 hover:bg-slate-900 px-2.5 py-1 rounded-xl">Close</button>
              </div>
              <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
                <p>
                  <span className="text-sky-400 font-bold">HydroAgent AI</span> is a progressive, full-stack deployment engineered to optimize biological fluid distribution layers using real-time predictive computation bounds.
                </p>
                <p>
                  <span className="text-white font-bold block mb-0.5">Core System Lead:</span>
                  <span className="bg-sky-500/10 border border-sky-500/20 text-sky-300 font-black px-2 py-0.5 rounded text-[11px]">Shantanu Saxena</span>
                </p>
                <p>
                  <span className="text-white font-bold block mb-0.5">Key Mechanics Matrix:</span>
                  • Medical Pacing Timeline Core<br/>
                  • Supabase Isolation Protocol<br/>
                  • Secure Heterogeneous Cron Handshake<br/>
                  • Interactive Neural Linguistic Parsing
                </p>
              </div>
            </div>
          </div>
        )}

        {activeModal === 'instructions' && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-50 p-6 flex flex-col justify-center items-center">
            <div className="bg