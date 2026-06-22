// ═══════════════════════════════════════════════════════════════════
// PureScan AI — Send Push Notifications Edge Function
// ═══════════════════════════════════════════════════════════════════
//
// TRIGGER:   Supabase Cron (pg_cron) or manual HTTP call from admin dashboard
// PURPOSE:   Reads pending admin_notifications, fetches target push_tokens,
//            and dispatches via Expo Push Notification API.
//
// DEPLOY:    supabase functions deploy send-push-notification
// INVOKE:    POST /functions/v1/send-push-notification
//            Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
//            Body: { "notification_id": "<uuid>" }  (optional — sends specific one)
//                  or empty body to process all 'scheduled' notifications
// ═══════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushMessage {
    to: string;
    title: string;
    body: string;
    sound?: string;
    data?: Record<string, unknown>;
    channelId?: string;
}

Deno.serve(async (req: Request) => {
    try {
        const supabaseUrl = Deno.env.get("MED_SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("MED_SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Parse optional notification_id from request body
        let targetNotificationId: string | null = null;
        try {
            const body = await req.json();
            targetNotificationId = body?.notification_id || null;
        } catch {
            // No body or invalid JSON — process all scheduled
        }

        // Fetch notifications to send
        let query = supabase
            .from("admin_notifications")
            .select("*")
            .in("status", ["scheduled", "draft"]);

        if (targetNotificationId) {
            query = query.eq("id", targetNotificationId);
        } else {
            // Only process scheduled notifications whose time has come
            query = query.lte("scheduled_at", new Date().toISOString());
        }

        const { data: notifications, error: fetchError } = await query;

        if (fetchError) {
            return new Response(JSON.stringify({ error: fetchError.message }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }

        if (!notifications || notifications.length === 0) {
            return new Response(
                JSON.stringify({ message: "No pending notifications to send." }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }

        const results = [];

        for (const notification of notifications) {
            // Mark as "sending"
            await supabase
                .from("admin_notifications")
                .update({ status: "sending", updated_at: new Date().toISOString() })
                .eq("id", notification.id);

            // Build the token query based on target audience
            let tokenQuery = supabase
                .from("push_tokens")
                .select("expo_push_token, user_id")
                .eq("is_active", true);

            if (notification.target_audience === "pro") {
                // Join with users to filter pro users
                const { data: proUsers } = await supabase
                    .from("users")
                    .select("id")
                    .eq("is_pro", true);
                const proIds = proUsers?.map((u: { id: string }) => u.id) || [];
                if (proIds.length > 0) {
                    tokenQuery = tokenQuery.in("user_id", proIds);
                } else {
                    tokenQuery = tokenQuery.eq("user_id", "00000000-0000-0000-0000-000000000000"); // No matches
                }
            } else if (notification.target_audience === "free") {
                const { data: freeUsers } = await supabase
                    .from("users")
                    .select("id")
                    .eq("is_pro", false);
                const freeIds = freeUsers?.map((u: { id: string }) => u.id) || [];
                if (freeIds.length > 0) {
                    tokenQuery = tokenQuery.in("user_id", freeIds);
                } else {
                    tokenQuery = tokenQuery.eq("user_id", "00000000-0000-0000-0000-000000000000");
                }
            } else if (
                notification.target_audience === "specific_users" &&
                notification.target_user_ids?.length > 0
            ) {
                tokenQuery = tokenQuery.in("user_id", notification.target_user_ids);
            }
            // 'all' — no filter needed, sends to everyone

            // Also filter: only users who have new_features notifications enabled
            // (for feature announcements). For other types, we send regardless.
            const { data: tokens, error: tokenError } = await tokenQuery;

            if (tokenError || !tokens || tokens.length === 0) {
                await supabase
                    .from("admin_notifications")
                    .update({
                        status: tokens?.length === 0 ? "sent" : "failed",
                        total_recipients: 0,
                        sent_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", notification.id);

                results.push({
                    id: notification.id,
                    status: "no_recipients",
                    error: tokenError?.message,
                });
                continue;
            }

            // Build Expo push messages (batch up to 100 per request)
            const messages: PushMessage[] = tokens.map(
                (t: { expo_push_token: string }) => ({
                    to: t.expo_push_token,
                    title: notification.title,
                    body: notification.body,
                    sound: "default",
                    data: notification.data || {},
                    channelId: "default",
                })
            );

            // Send in batches of 100
            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < messages.length; i += 100) {
                const batch = messages.slice(i, i + 100);
                try {
                    const response = await fetch(EXPO_PUSH_URL, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Accept: "application/json",
                        },
                        body: JSON.stringify(batch),
                    });

                    const result = await response.json();
                    if (result.data) {
                        for (const ticket of result.data) {
                            if (ticket.status === "ok") {
                                successCount++;
                            } else {
                                failCount++;
                                // If token is invalid, mark it as inactive
                                if (ticket.details?.error === "DeviceNotRegistered") {
                                    const failedToken = batch[result.data.indexOf(ticket)]?.to;
                                    if (failedToken) {
                                        await supabase
                                            .from("push_tokens")
                                            .update({ is_active: false })
                                            .eq("expo_push_token", failedToken);
                                    }
                                }
                            }
                        }
                    }
                } catch (batchError) {
                    failCount += batch.length;
                    console.error("Batch send error:", batchError);
                }
            }

            // Update the notification record
            await supabase
                .from("admin_notifications")
                .update({
                    status: "sent",
                    sent_at: new Date().toISOString(),
                    total_recipients: messages.length,
                    successful_sends: successCount,
                    failed_sends: failCount,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", notification.id);

            results.push({
                id: notification.id,
                status: "sent",
                total: messages.length,
                success: successCount,
                failed: failCount,
            });
        }

        return new Response(JSON.stringify({ results }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: (error as Error).message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});
