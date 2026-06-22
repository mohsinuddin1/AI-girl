import requests
import json
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)

# Configuration — Try to load from .env
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
# SERVICE_ROLE_KEY is required for admin tasks like sending notifications
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

def send_broadcast(title, body):
    if not SERVICE_ROLE_KEY or not SUPABASE_URL:
        print("❌ Error: Missing credentials in .env file.")
        print(f"URL: {SUPABASE_URL or 'Missing'}")
        print(f"Key: {'Found' if SERVICE_ROLE_KEY else 'Missing'}")
        return

    # 1. Insert the notification campaign into admin_notifications
    print(f"🚀 Creating notification campaign: \"{title}\"...")
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    payload = {
        "title": title,
        "body": body,
        "target_audience": "all",
        "status": "scheduled",
        "scheduled_at": datetime.utcnow().isoformat()
    }
    
    try:
        response = requests.post(f"{SUPABASE_URL}/rest/v1/admin_notifications", headers=headers, json=payload)
        response.raise_for_status()
    except Exception as e:
        print(f"❌ Failed to create campaign: {e}")
        if 'response' in locals(): print(response.text)
        return

    notification_id = response.json()[0]['id']
    print(f"✅ Campaign created! ID: {notification_id}")

    # 2. Trigger the Edge Function to send it immediately
    print("📡 Triggering push notification delivery via Edge Function...")
    trigger_url = f"{SUPABASE_URL}/functions/v1/send-push-notification"
    trigger_payload = { "notification_id": notification_id }
    
    try:
        trigger_response = requests.post(trigger_url, headers=headers, json=trigger_payload)
        # Note: 404 here means the function isn't deployed
        if trigger_response.status_code == 404:
            print("❌ Error: Edge Function 'send-push-notification' not found on server.")
            print("Please run: supabase functions deploy send-push-notification")
            return
        trigger_response.raise_for_status()
    except Exception as e:
        print(f"❌ Trigger failed: {e}")
        if 'trigger_response' in locals(): print(trigger_response.text)
        return
    
    print("🎉 Success! Notification is being delivered by the server.")
    print(json.dumps(trigger_response.json(), indent=2))

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python scripts/broadcast_notif.py \"Title\" \"Body\"")
        sys.exit(1)
    
    send_broadcast(sys.argv[1], sys.argv[2])
