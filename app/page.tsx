'use client';
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

export default function Home() {
  // --- Auth State Variables ---
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [authError, setAuthError] = useState('');

  // --- App Tracker State Variables ---
  const [waterIntake, setWaterIntake] = useState(0); 
  const dailyGoal = 2500; // We will make this adjustable in the next step!
  const [chatMessage, setChatMessage] = useState(''); 
  const [isLoading, setIsLoading] = useState(false); 
  const [chatHistory, setChatHistory] = useState([
    { sender: 'agent', text: 'Hello! I am your AI Water Assistant. Your entries are safely secured to your private account!' }
  ]);

  const percentage = Math.min((waterIntake / dailyGoal) * 100, 100);

  // --- 1. AUTH MONITOR: Check if a user is logged in automatically ---
  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen live for sign-in or sign-out changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Run database fetch only when a user successfully authenticates
  useEffect(() => {
    if (user) {
      fetchTodayWater();
    } else {
      setWaterIntake(0);
    }
  }, [user]);

  // --- 2. AUTH HANDLERS: Sign Up & Sign In functions ---
  const handleAuth = async (e) => {
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

  // --- 3. DATABASE FETCH: Read entries belonging ONLY to the logged in user ---
  const fetchTodayWater = async () => {
    try {
      const { data, error } = await supabase
        .from('water_entries')
        .select('amount_ml');

      if (error) throw error;

      const total = data.reduce((sum, entry) => sum + entry.amount_ml, 0);
      setWaterIntake(total);
    } catch (err) {
      const errorObj = err as any;
      console.error("Error reading data:", errorObj?.message);
    }
  };

  // --- 4. DATABASE SAVE: Stamp entries with owner data ---
  const saveWaterEntry = async (amount) => {
    try {
      const { error } = await supabase
        .from('water_entries')
        .insert([{ amount_ml: amount }]); // user_id is stamped automatically by auth.uid() now!

      if (error) throw error;
      setWaterIntake((prev) => Math.max(0, prev + amount));
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
    } catch (err) {
      const errorObj = err as any;
      console.error("Database reset error:", errorObj?.message);
    }
  };

  const handleQuickAdd = async (amount) => {
    await saveWaterEntry(amount);
    setChatHistory((prev) => [...prev, { sender: 'agent', text: `Logged ${amount}ml to your private account!` }]);
  };

  const handleSendMessage = async (e) => {
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

  // --- SCREEN CONDITIONAL: If user is not logged in, show Auth Portal ---
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Password</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

  // --- MAIN TRACKING APP COMPONENT (Only accessible once signed in) ---
  return (
    <div className="flex justify-center items-center min-h-screen bg-slate-900 font-sans p-4">
      <div className="w-full max-w-md h-[850px] bg-slate-800 rounded-[40px] shadow-2xl border-8 border-slate-700 flex flex-col overflow-hidden relative">
        
        {/* Header Dashboard with Logout Action */}
        <div className="p-5 text-center text-white border-b border-slate-700 bg-slate-850 flex justify-between items-center px-6">
          <div className="w-6"></div> {/* Spacer balance element */}
          <div>
            <h1 className="text-xl font-bold tracking-wide">HydroAgent AI</h1>
            <p className="text-[10px] text-slate-400">Private Account Dashboard</p>
          </div>
          <button onClick={handleSignOut} className="text-xs font-semibold text-slate-400 bg-slate-700/60 hover:bg-slate-600 px-3 py-1.5 rounded-xl border border-slate-600 transition-all">
            Exit
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
          
          <div className="flex flex-col items-center justify-center relative my-4">
            <div className="relative w-48 h-48 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-[12px] border-slate-700"></div>
              <div className="text-center z-10">
                <span className="text-4xl font-extrabold text-sky-400 block">{waterIntake}</span>
                <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold">of {dailyGoal} ml</span>
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
              {chatHistory.map((msg, idx) => (
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

        <form onSubmit={handleSendMessage} className="absolute bottom-0 left-0 right-0 p-4 bg-slate-800 border-t border-slate-700 flex gap-2 items-center backdrop-blur-md">
          <input 
            type="text" 
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
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