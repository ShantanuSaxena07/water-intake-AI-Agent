import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function GET(request) {
  try {
    // 1. Fetch only users who have notifications turned ON and have a push token
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, push_subscription, daily_goal_ml, timezone')
      .eq('notifications_enabled', true)
      .not('push_subscription', 'is', null);

    if (profileError) throw profileError;
    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ success: true, message: 'No active notification tracks.' });
    }

    let deliveredCount = 0;

    for (const profile of profiles) {
      // 2. Get local time for the user's specific timezone
      const userLocalTime = new Date(new Date().toLocaleString('en-US', { timeZone: profile.timezone }));
      const currentHour = userLocalTime.getHours();
      const currentMinutes = userLocalTime.getMinutes();
      const currentDecimalTime = currentHour + currentMinutes / 60;

      // 3. Rebuild the Dynamic Healthcare Timeline for this specific user's target
      let slotsCount = 4;
      if (profile.daily_goal_ml > 1800 && profile.daily_goal_ml <= 3000) slotsCount = 6;
      if (profile.daily_goal_ml > 3000) slotsCount = 8;

      const morningStart = 8; // 08:00 AM
      const eveningEnd = 21.5; // 09:30 PM
      const totalAvailableHours = eveningEnd - morningStart;
      const intervalDelta = totalAvailableHours / (slotsCount - 1);

      let matchingSlot = null;

      for (let i = 0; i < slotsCount; i++) {
        const slotHourDecimal = morningStart + (i * intervalDelta);
        
        // If the current background clock is within 30 minutes of this calculated slot
        if (Math.abs(currentDecimalTime - slotHourDecimal) <= 0.26) {
          matchingSlot = {
            targetPct: (i + 1) / slotsCount,
            slotIndex: i + 1,
            totalSlots: slotsCount
          };
          break;
        }
      }

      // If the current time doesn't match any of their personal timeline intervals, skip checking
      if (!matchingSlot) continue;

      // 4. Gather today's water data for this user
      const todayStart = new Date(userLocalTime);
      todayStart.setHours(0, 0, 0, 0);

      const { data: entries, error: entriesError } = await supabaseAdmin
        .from('water_entries')
        .select('amount_ml')
        .eq('user_id', profile.id)
        .gte('created_at', todayStart.toISOString());

      if (entriesError) continue;

      const totalIntake = entries?.reduce((sum, entry) => sum + entry.amount_ml, 0) || 0;
      const requiredIntakeForSlot = Math.round(profile.daily_goal_ml * matchingSlot.targetPct);

      // 5. If they are behind their personal timeline milestone, alert them!
      if (totalIntake < requiredIntakeForSlot) {
        const payload = JSON.stringify({
          title: '🌊 Timeline Checkpoint!',
          body: `Slot ${matchingSlot.slotIndex}/${matchingSlot.totalSlots}. You should be at ${requiredIntakeForSlot}ml by now, but you are at ${totalIntake}ml. Take a drink!`,
          icon: '/icon-192x192.png',
        });

        try {
          await webpush.sendNotification(profile.push_subscription, payload);
          deliveredCount++;
        } catch (pushError) {
          if (pushError.statusCode === 410 || pushError.statusCode === 404) {
            await supabaseAdmin
              .from('user_profiles')
              .update({ push_subscription: null })
              .eq('id', profile.id);
          }
        }
      }
    }

    return NextResponse.json({ success: true, delivered: deliveredCount });

  } catch (error) {
    console.error('Dynamic notification engine error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 