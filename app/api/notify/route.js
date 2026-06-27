import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// 1. Initialize web-push with your secure environment keys
webpush.setVapidDetails(
  'mailto:your-email@example.com', // Replace with any valid email placeholder
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

// Initialize a service-role Supabase client to read profiles securely on the server
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' // Make sure this secret key is in your env file!
);

export async function GET() {
  try {
    // 2. Fetch all user profiles that have a valid device push token registered
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .not('push_subscription', 'is', null);

    if (profileError) throw profileError;

    let successCount = 0;

    // 3. Loop through the active devices and transmit the payload
    for (const profile of profiles) {
      const subscription = profile.push_subscription;

      const payload = JSON.stringify({
        title: '💧 HydroAgent AI Reminder',
        body: 'Time to check your schedule timeline! Log your recent intake to hit your dynamic 3000ml goal.',
        url: '/'
      });

      try {
        await webpush.sendNotification(subscription, payload);
        successCount++;
      } catch (pushErr) {
        console.error(`Failed push delivery for profile ${profile.id}:`, pushErr);
      }
    }

    return NextResponse.json({ success: true, delivered: successCount });
  } catch (error) {
    const errorObj = error as any;
    return NextResponse.json({ success: false, error: errorObj?.message }, { status: 500 });
  }
}