import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Initialize web-push with your secure environment keys
webpush.setVapidDetails(
  'mailto:your-email@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

// Initialize a service-role Supabase client to read profiles securely on the server
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET() {
  try {
    // Fetch all user profiles that have a valid device push token registered
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, push_subscription') // Call select() first to initiate the filtering stream
      .not('push_subscription', 'is', null);

    if (profileError) throw profileError;

    let successCount = 0;

    // Loop through the active devices and transmit the payload
    for (const profile of profiles) {
      const subscription = profile.push_subscription;

      const payload = JSON.stringify({
        title: '💧 HydroAgent AI Reminder',
        body: 'Time to check your schedule timeline! Log your recent intake to hit your dynamic goal.',
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
    return NextResponse.json({ success: false, error: error?.message || 'Notification broadcast failed' }, { status: 500 });
  }
}