"""
Database seed script for SKAI backend.

Seeds a demo restaurant with a test user, business hours, settings,
menu items, sample calls, and orders into the Supabase database.

Usage:
    python seed.py          # seed with defaults
    python seed.py --clean  # wipe all data then re-seed
"""

import argparse
import sys
from datetime import datetime, timedelta, timezone
from supabase import create_client

from app.config import get_settings
from app.db import models

settings = get_settings()
db = create_client(settings.supabase_url, settings.supabase_service_key)

TEST_EMAIL = "demo@skai.dev"
TEST_PASSWORD = "Demo1234!"

# ── Helpers ───────────────────────────────────────────────

def utc_now():
    return datetime.now(timezone.utc)


def hours_ago(n):
    return (utc_now() - timedelta(hours=n)).isoformat()


def days_ago(n):
    return (utc_now() - timedelta(days=n)).isoformat()


def upsert(table, data, on_conflict="id"):
    return db.table(table).upsert(data, on_conflict=on_conflict).execute()


# ── Clean ─────────────────────────────────────────────────

TABLES_IN_DELETE_ORDER = [
    models.ORDER_ITEMS,
    models.ORDERS,
    models.CALLS,
    models.MENU_ITEMS,
    models.RESTAURANT_SETTINGS,
    models.BUSINESS_HOURS,
    models.USERS,
    models.RESTAURANTS,
]


def clean():
    print("Cleaning all tables...")
    for table in TABLES_IN_DELETE_ORDER:
        db.table(table).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        print(f"  Cleared {table}")

    print("Removing Supabase Auth user if exists...")
    try:
        users = db.auth.admin.list_users()
        for u in users:
            if getattr(u, "email", None) == TEST_EMAIL:
                db.auth.admin.delete_user(u.id)
                print(f"  Deleted auth user {u.id}")
    except Exception as e:
        print(f"  Could not clean auth users: {e}")

    print("Clean complete.\n")


# ── Seed ──────────────────────────────────────────────────

def seed():
    print("=" * 50)
    print("  SKAI Database Seed")
    print("=" * 50)

    # 1. Create Supabase Auth user
    print("\n1. Creating Supabase Auth user...")
    try:
        auth_user = db.auth.admin.create_user({
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "email_confirm": True,
        })
        user_id = auth_user.user.id
        print(f"   Created auth user: {user_id}")
    except Exception as e:
        err = str(e)
        if "already been registered" in err or "already exists" in err:
            users = db.auth.admin.list_users()
            user_id = next(u.id for u in users if getattr(u, "email", None) == TEST_EMAIL)
            print(f"   Auth user already exists: {user_id}")
        else:
            print(f"   ERROR: {e}")
            sys.exit(1)

    # 2. Create restaurant
    print("\n2. Creating restaurant...")
    restaurant = {
        "name": "Spicy House",
        "timezone": "America/New_York",
        "elevenlabs_agent_id": "agent_demo_001",
        "twilio_phone_number": "+15559876543",
        "agent_enabled": True,
    }
    result = db.table(models.RESTAURANTS).insert(restaurant).execute()
    rest = result.data[0]
    restaurant_id = rest["id"]
    print(f"   Restaurant: {rest['name']} ({restaurant_id})")

    # 3. Create user record linked to restaurant
    print("\n3. Creating user profile...")
    user_row = {
        "id": user_id,
        "restaurant_id": restaurant_id,
        "email": TEST_EMAIL,
        "full_name": "Skai Solutions",
        "role": "owner",
    }
    db.table(models.USERS).insert(user_row).execute()
    print(f"   User: {user_row['full_name']} ({user_row['email']})")

    # 4. Business hours (Mon-Sun, 11am-10pm, closed Tuesday)
    print("\n4. Creating business hours...")
    hours = []
    for day in range(7):
        if day == 1:  # Tuesday closed
            hours.append({
                "restaurant_id": restaurant_id,
                "day_of_week": day,
                "open_time": None,
                "close_time": None,
            })
        else:
            hours.append({
                "restaurant_id": restaurant_id,
                "day_of_week": day,
                "open_time": "11:00:00",
                "close_time": "22:00:00",
            })
    db.table(models.BUSINESS_HOURS).insert(hours).execute()
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    for h in hours:
        d = days[h["day_of_week"]]
        t = f"{h['open_time']} - {h['close_time']}" if h["open_time"] else "Closed"
        print(f"   {d}: {t}")

    # 5. Restaurant settings
    print("\n5. Creating restaurant settings...")
    settings_row = {
        "restaurant_id": restaurant_id,
        "dinein_transfer_enabled": False,
        "dinein_max_hourly_capacity": 40,
        "takeaway_stop_minutes_before_close": 30,
        "divert_enabled": False,
        "divert_threshold_amount": 50.00,
        "sms_order_ready_enabled": False,
    }
    db.table(models.RESTAURANT_SETTINGS).insert(settings_row).execute()
    print("   Settings saved.")

    # 6. Menu items
    print("\n6. Creating menu items...")
    menu_items = [
        # Cold Dish
        {"pos_name": "Pork Stomach in Chilli Sauce", "price": 16.00, "category": "Cold Dish"},
        {"pos_name": "Cucumber Salad", "price": 16.00, "category": "Cold Dish"},
        {"pos_name": "Sliced Beef & Tripe in Chilli Sauce", "price": 16.00, "category": "Cold Dish"},
        {"pos_name": "Pork Belly with Garlic Sauce", "price": 16.00, "category": "Cold Dish"},
        {"pos_name": "Cold Tofu with Scallion Sauce", "price": 14.00, "category": "Cold Dish"},
        # Chicken
        {"pos_name": "Gong Bao Chicken", "price": 24.00, "category": "Chicken"},
        {"pos_name": "Hot & Spicy Chicken", "price": 24.00, "category": "Chicken"},
        {"pos_name": "Chicken with Spicy Sauce", "price": 24.00, "category": "Chicken"},
        {"pos_name": "Chicken with Black Pepper", "price": 25.00, "category": "Chicken"},
        {"pos_name": "Chilli Chicken Boneless", "price": 24.00, "category": "Chicken"},
        {"pos_name": "Chicken with Black Bean Sauce", "price": 24.00, "category": "Chicken"},
        {"pos_name": "Chicken with Fresh Chilli", "price": 24.00, "category": "Chicken"},
        {"pos_name": "Sweet & Sour Chicken", "price": 24.00, "category": "Chicken"},
        {"pos_name": "Salt & Pepper Chicken", "price": 24.00, "category": "Chicken"},
        {"pos_name": "Salt & Pepper Chicken Gristle", "price": 25.00, "category": "Chicken"},
        # Pork
        {"pos_name": "Salt & Pepper Pork", "price": 23.00, "category": "Pork"},
        {"pos_name": "Sweet & Sour Pork", "price": 23.00, "category": "Pork"},
        {"pos_name": "Deep Fried Spare Rib", "price": 25.00, "category": "Pork"},
        {"pos_name": "Spare Rib with Secret Sauce", "price": 24.00, "category": "Pork"},
        {"pos_name": "Braised Pork Hock", "price": 27.00, "category": "Pork"},
        {"pos_name": "Spicy Pork Belly", "price": 23.00, "category": "Pork"},
        {"pos_name": "Pork Belly with Cabbage", "price": 24.00, "category": "Pork"},
        # Beef
        {"pos_name": "Beef with Spicy Sauce", "price": 25.00, "category": "Beef"},
        {"pos_name": "Beef with Spring Onion", "price": 25.00, "category": "Beef"},
        {"pos_name": "Beef with Cumin", "price": 25.00, "category": "Beef"},
        {"pos_name": "Stir Fried Spicy Beef", "price": 25.00, "category": "Beef"},
        {"pos_name": "Beef with Oyster Sauce", "price": 25.00, "category": "Beef"},
        {"pos_name": "Beef with Mushroom", "price": 25.00, "category": "Beef"},
        {"pos_name": "Beef with Black Pepper", "price": 26.00, "category": "Beef"},
        # Seafood
        {"pos_name": "Squid with Spicy Sauce", "price": 24.00, "category": "Seafood"},
        {"pos_name": "Salt & Pepper Squid", "price": 24.00, "category": "Seafood"},
        {"pos_name": "Fish Fillet with Sweet & Sour Sauce", "price": 24.00, "category": "Seafood"},
        {"pos_name": "Chilli Fish Fillet", "price": 24.00, "category": "Seafood"},
        {"pos_name": "Salt & Pepper Fish Fillet", "price": 24.00, "category": "Seafood"},
        {"pos_name": "Salt & Pepper Prawn", "price": 29.00, "category": "Seafood"},
        {"pos_name": "Chilli Soft Shell Crab", "price": 34.00, "category": "Seafood"},
        # Fried Rice
        {"pos_name": "Egg Fried Rice", "price": 14.00, "category": "Fried Rice"},
        {"pos_name": "Chicken Fried Rice", "price": 16.00, "category": "Fried Rice"},
        {"pos_name": "Beef Fried Rice", "price": 16.00, "category": "Fried Rice"},
        {"pos_name": "Shrimp Fried Rice", "price": 17.00, "category": "Fried Rice"},
        {"pos_name": "Yang Chow Fried Rice", "price": 17.00, "category": "Fried Rice"},
        {"pos_name": "Combination Fried Rice", "price": 17.00, "category": "Fried Rice"},
        {"pos_name": "Vegetable Fried Rice", "price": 15.00, "category": "Fried Rice"},
        # Fried Noodles
        {"pos_name": "Chicken Fried Noodle", "price": 16.00, "category": "Fried Noodles"},
        {"pos_name": "Beef Fried Noodle", "price": 16.00, "category": "Fried Noodles"},
        {"pos_name": "Shrimp Fried Noodle", "price": 17.00, "category": "Fried Noodles"},
        {"pos_name": "Combination Fried Noodle", "price": 17.00, "category": "Fried Noodles"},
        {"pos_name": "Vegetable Fried Noodle", "price": 15.00, "category": "Fried Noodles"},
        # Dumplings
        {"pos_name": "Pork & Chive Dumpling", "price": 17.00, "category": "Dumplings"},
        {"pos_name": "Chicken Dumpling", "price": 17.00, "category": "Dumplings"},
        {"pos_name": "Vegetarian Dumpling", "price": 17.00, "category": "Dumplings"},
        # Soup
        {"pos_name": "Hot & Sour Soup", "price": 13.00, "category": "Soup"},
        {"pos_name": "Chicken Sweet Corn Soup", "price": 13.00, "category": "Soup"},
        # Vegetables
        {"pos_name": "Plain Okra", "price": 16.00, "category": "Vegetables"},
        {"pos_name": "Chilli Okra", "price": 16.00, "category": "Vegetables"},
        {"pos_name": "Chinese Cabbage with Garlic", "price": 18.00, "category": "Vegetables"},
        {"pos_name": "Chinese Broccoli with Garlic", "price": 23.00, "category": "Vegetables"},
        {"pos_name": "Mixed Vegetable", "price": 18.00, "category": "Vegetables"},
        {"pos_name": "Eggplant with Spicy Sauce", "price": 24.00, "category": "Vegetables"},
    ]
    for item in menu_items:
        item["restaurant_id"] = restaurant_id
        item["is_active"] = True
    db.table(models.MENU_ITEMS).insert(menu_items).execute()
    for item in menu_items:
        print(f"   ${item['price']:>6.2f}  {item['pos_name']}")

    # 7. Sample calls
    print("\n7. Creating sample calls...")
    sample_calls = [
        {
            "restaurant_id": restaurant_id,
            "twilio_call_sid": f"CA_seed_{i}",
            "elevenlabs_conversation_id": f"conv_seed_{i}",
            "phone_number": phone,
            "customer_name": name,
            "call_status": "completed",
            "call_duration_seconds": dur,
            "transcript": [
                {"role": "agent", "message": "Hello, thank you for calling! How can I help you today?"},
                {"role": "user", "message": transcript},
                {"role": "agent", "message": "Sure thing! Is that for pickup or delivery?"},
                {"role": "user", "message": "Pickup please."},
            ],
            "summary": summary,
            "has_order": has_order,
            "call_started_at": hours_ago(offset),
            "call_ended_at": hours_ago(offset - 0.1),
        }
        for i, (phone, name, dur, transcript, summary, has_order, offset) in enumerate([
            ("+15551001001", "Maria Garcia", 145, "I'd like the Gong Bao Chicken and an Egg Fried Rice", "Customer ordered Gong Bao Chicken and Egg Fried Rice for pickup.", True, 2),
            ("+15551002002", "James Wilson", 92, "Can I get two Pork & Chive Dumplings and a Hot & Sour Soup?", "Customer ordered two Pork & Chive Dumplings and Hot & Sour Soup.", True, 5),
            ("+15551003003", "Sarah Chen", 38, "What are your hours?", "Customer inquired about business hours. No order placed.", False, 8),
            ("+15551004004", "Michael Brown", 210, "I need the Salt & Pepper Prawn, Chicken Fried Rice, and a Cucumber Salad", "Customer placed a large order: Salt & Pepper Prawn, Chicken Fried Rice, and Cucumber Salad.", True, 26),
            ("+15551005005", "Emily Davis", 125, "Sweet & Sour Chicken and Beef Fried Noodle please", "Customer ordered Sweet & Sour Chicken and Beef Fried Noodle.", True, 30),
            ("+15551006006", "Robert Taylor", 55, "Do you deliver to downtown?", "Customer asked about delivery area. No order placed.", False, 48),
            ("+15551007007", "Lisa Anderson", 175, "I'll have the Beef with Cumin, Chinese Broccoli with Garlic, Chicken Fried Noodle, and a Chicken Sweet Corn Soup", "Customer placed a multi-item order for pickup.", True, 52),
            ("+15551008008", "David Martinez", 110, "Two Deep Fried Spare Ribs and two Egg Fried Rice", "Customer ordered two Deep Fried Spare Ribs and two Egg Fried Rice for a group.", True, 72),
        ], start=1)
    ]
    call_result = db.table(models.CALLS).insert(sample_calls).execute()
    saved_calls = call_result.data
    for c in saved_calls:
        status = "w/ order" if c["has_order"] else "inquiry"
        print(f"   {c['phone_number']}  {c['customer_name'] or 'Unknown':<18} {c['call_duration_seconds']:>3}s  ({status})")

    # 8. Sample orders
    print("\n8. Creating sample orders...")
    menu_map = {}
    menu_result = db.table(models.MENU_ITEMS).select("id, pos_name, price").eq("restaurant_id", restaurant_id).execute()
    for m in menu_result.data:
        menu_map[m["pos_name"]] = m

    order_data = [
        (0, "takeaway", [("Gong Bao Chicken", 1), ("Egg Fried Rice", 1)]),
        (1, "takeaway", [("Pork & Chive Dumpling", 2), ("Hot & Sour Soup", 1)]),
        (3, "takeaway", [("Salt & Pepper Prawn", 1), ("Chicken Fried Rice", 1), ("Cucumber Salad", 1)]),
        (4, "takeaway", [("Sweet & Sour Chicken", 1), ("Beef Fried Noodle", 1)]),
        (6, "takeaway", [("Beef with Cumin", 1), ("Chinese Broccoli with Garlic", 1), ("Chicken Fried Noodle", 1), ("Chicken Sweet Corn Soup", 1)]),
        (7, "takeaway", [("Deep Fried Spare Rib", 2), ("Egg Fried Rice", 2)]),
    ]

    for call_idx, order_type, items_list in order_data:
        call = saved_calls[call_idx]

        total = sum(float(menu_map[name]["price"]) * qty for name, qty in items_list)
        order_row = {
            "restaurant_id": restaurant_id,
            "call_id": call["id"],
            "phone_number": call["phone_number"],
            "customer_name": call.get("customer_name"),
            "order_type": order_type,
            "total_amount": round(total, 2),
            "items_count": sum(qty for _, qty in items_list),
        }
        order_result = db.table(models.ORDERS).insert(order_row).execute()
        order = order_result.data[0]

        order_items = []
        for name, qty in items_list:
            mi = menu_map[name]
            order_items.append({
                "order_id": order["id"],
                "menu_item_id": mi["id"],
                "item_name": name,
                "quantity": qty,
                "unit_price": float(mi["price"]),
                "subtotal": round(float(mi["price"]) * qty, 2),
            })
        db.table(models.ORDER_ITEMS).insert(order_items).execute()

        # Mark call as having an order
        db.table(models.CALLS).update({"has_order": True}).eq("id", call["id"]).execute()

        items_str = ", ".join(f"{qty}x {name}" for name, qty in items_list)
        print(f"   ${total:>7.2f}  {items_str}")

    # ── Summary ────────────────────────────────────────────
    print("\n" + "=" * 50)
    print("  Seed complete!")
    print("=" * 50)
    print(f"\n  Restaurant:  {rest['name']}")
    print(f"  User email:  {TEST_EMAIL}")
    print(f"  Password:    {TEST_PASSWORD}")
    print(f"  Menu items:  {len(menu_items)}")
    print(f"  Calls:       {len(sample_calls)}")
    print(f"  Orders:      {len(order_data)}")
    print(f"\n  To get a JWT token, sign in via Supabase Auth:")
    print(f"    Email:    {TEST_EMAIL}")
    print(f"    Password: {TEST_PASSWORD}")
    print()


# ── Main ──────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed the SKAI database")
    parser.add_argument("--clean", action="store_true", help="Wipe all data before seeding")
    args = parser.parse_args()

    if args.clean:
        clean()

    seed()
