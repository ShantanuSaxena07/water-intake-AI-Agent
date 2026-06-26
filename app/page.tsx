'use client';
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase'; // Import our cloud database link

export default function Home() {
  const [waterIntake, setWaterIntake] = useState(0); 
  const dailyGoal = 2500; 
  const [chatMessage, setChatMessage] = useState(''); 
  const [isLoading, setIsLoading] = useState(false); 
  const [chatHistory, setChatHistory] = useState([
    { sender: 'agent', text: 'Hello! I am your AI Water Assistant. All entries are now securely saved to your permanent cloud database!' }
  ]);

  const percentage = Math.min((waterIntake / dailyGoal) * 100, 100);

  // --- 1. DATABASE FETCH: Read water entries from the cloud automatically on page load ---
  const fetchTodayWater = async () => {
    try {
      const { data, error } = await supabase
        .from('water_entries')
        .select('amount_ml');

      if (error) throw error;

      // Sum up all the amount_ml values in our table rows
      const total = data.reduce((sum, entry) => sum + entry.amount_ml, 0);
      setWaterIntake(total);
    } catch (err) {
      console.error("Error reading database:", err.message);
    }
  };

  // useEffect is a built-in sensor that runs our fetch function once when the website opens
  useEffect(() => {
    fetchTodayWater();
  }, []);


  // --- 2. DATABASE SAVE: Insert a new row into our cloud table ---
  const saveWaterEntry = async (amount) => {
    try {
      const { error } = await supabase
        .from('water_entries')
        .insert([{ amount_ml: amount }]);

      if (error) throw error;

      // Re-calculate local display total
      setWaterIntake((prev) => Math.max(0, prev + amount));
    } catch (err) {
      console.error("Database save error:", err.message);
    }
  };

  // --- 3. DATABASE RESET: Clear all entries from the cloud table ---
  const resetWaterEntries = async () => {
    try {
      const { error } = await supabase
        .from('water_entries')
        .delete()
        .neq('id', 0); // Deletes all rows where ID is not 0 (which is everything)

      if (error) throw error;
      setWaterIntake(0);
    } catch (err) {
      console.error("Database reset error:", err.message);
    }
  };

  const handleQuickAdd = async (amount) => {
    await saveWaterEntry(amount);
    setChatHistory((prev) => [...prev, { sender: 'agent', text: `Logged ${amount}ml directly to cloud memory!` }]);
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
        // To decrease water level, we save a negative row entry (e.g., -250ml)
        await saveWaterEntry(-data.amount_ml);
      } 
      else if (data.action === 'reset') {
        await resetWaterEntries();
      }

      setChatHistory((prev) => [...prev, { sender: 'agent', text: data.ai_reply }]);

    } catch (error) {
      console.error("AI Fetch Failure:", error);
      setChatHistory((prev) => [...prev, { sender: 'agent', text: "Sorry, I had trouble connecting to my server. Please try again!" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-slate-900 font-sans p-4">
      <div className="w-full max-w-md h-[850px] bg-slate-800 rounded-[40px] shadow-2xl border-8 border-slate-700 flex flex-col overflow-hidden relative">
        
        <div className="p-6 text-center text-white border-b border-slate-700 bg-slate-850">
          <h1 className="text-2xl font-bold tracking-wide">HydroAgent AI</h1>
          <p className="text-xs text-slate-400 mt-1">Smart Hydration Companion</p>
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