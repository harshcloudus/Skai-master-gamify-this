"""
Update ONLY menu items for an existing restaurant.
Does NOT touch users, orders, calls, settings, or any other data.

Usage:
    python update_menu.py                        # update menu for "Spicy House"
    python update_menu.py --restaurant "My Place" # update menu for a specific restaurant
    python update_menu.py --dry-run               # preview without writing
"""

import argparse
import sys
from supabase import create_client

from app.config import get_settings
from app.db import models

settings = get_settings()
db = create_client(settings.supabase_url, settings.supabase_service_key)

DEFAULT_RESTAURANT = "Spicy House"

MENU_ITEMS = [
    # ── 1. Cold Dish ──────────────────────────────────────
    {"pos_name": "Pork Stomach in Chilli Sauce",        "price": 16.00, "category": "Cold Dish"},
    {"pos_name": "Cucumber Salad",                      "price": 16.00, "category": "Cold Dish"},
    {"pos_name": "Sliced Beef & Tripe in Chilli Sauce", "price": 16.00, "category": "Cold Dish"},
    {"pos_name": "Pork Belly with Garlic Sauce",        "price": 16.00, "category": "Cold Dish"},
    {"pos_name": "Cold Tofu with Scallion in Sauce",    "price": 14.00, "category": "Cold Dish"},

    # ── 2. Chicken ────────────────────────────────────────
    {"pos_name": "Gong Bao Chicken",                    "price": 24.00, "category": "Chicken"},
    {"pos_name": "Hot & Spicy Chicken",                 "price": 24.00, "category": "Chicken"},
    {"pos_name": "Chicken with Spicy Sauce",            "price": 24.00, "category": "Chicken"},
    {"pos_name": "Chicken with Black Pepper",           "price": 25.00, "category": "Chicken"},
    {"pos_name": "Chilli Chicken (Boneless)",            "price": 24.00, "category": "Chicken"},
    {"pos_name": "Chicken with Black Bean Sauce",       "price": 24.00, "category": "Chicken"},
    {"pos_name": "Chicken with Fresh Chilli",           "price": 24.00, "category": "Chicken"},
    {"pos_name": "Sweet & Sour Chicken",                "price": 24.00, "category": "Chicken"},
    {"pos_name": "Salt & Pepper Chicken",               "price": 24.00, "category": "Chicken"},
    {"pos_name": "Salt & Pepper Chicken Gristle",       "price": 25.00, "category": "Chicken"},

    # ── 3. Pork ───────────────────────────────────────────
    {"pos_name": "Stomach with Pickled Vegetable",      "price": 23.00, "category": "Pork"},
    {"pos_name": "Hot & Spicy Pork Stomach",            "price": 23.00, "category": "Pork"},
    {"pos_name": "Salt & Pepper Pork",                  "price": 23.00, "category": "Pork"},
    {"pos_name": "Sweet & Sour Pork",                   "price": 23.00, "category": "Pork"},
    {"pos_name": "Deep-Fried Spare Rib",                "price": 25.00, "category": "Pork"},
    {"pos_name": "Spare Rib with Foil",                 "price": 25.00, "category": "Pork"},
    {"pos_name": "Spare Rib with Secret Sauce",         "price": 24.00, "category": "Pork"},
    {"pos_name": "Spare Rib with Hot Pot",              "price": 26.00, "category": "Pork"},
    {"pos_name": "Braised Pork Hock",                   "price": 27.00, "category": "Pork"},
    {"pos_name": "Spicy Pork Belly",                    "price": 23.00, "category": "Pork"},
    {"pos_name": "Pork Belly with Cabbage",             "price": 24.00, "category": "Pork"},
    {"pos_name": "Pork Belly with Hot Pot",             "price": 26.00, "category": "Pork"},
    {"pos_name": "Pork Belly with Sweet Sauce",         "price": 29.00, "category": "Pork"},
    {"pos_name": "Hot Spicy Intestine",                 "price": 33.00, "category": "Pork"},

    # ── 4. Beef ───────────────────────────────────────────
    {"pos_name": "Beef with Spicy Sauce",               "price": 25.00, "category": "Beef"},
    {"pos_name": "Beef with Spring Onion",              "price": 25.00, "category": "Beef"},
    {"pos_name": "Beef with Cumin",                     "price": 25.00, "category": "Beef"},
    {"pos_name": "Stir-Fried Spicy Beef",               "price": 25.00, "category": "Beef"},
    {"pos_name": "Beef with Oyster Sauce",              "price": 25.00, "category": "Beef"},
    {"pos_name": "Beef with Mushroom",                  "price": 25.00, "category": "Beef"},
    {"pos_name": "Beef with Black Pepper",              "price": 26.00, "category": "Beef"},
    {"pos_name": "Beef with Green Bean",                "price": 26.00, "category": "Beef"},
    {"pos_name": "Beef Brisket with Potato",            "price": 24.00, "category": "Beef"},
    {"pos_name": "Beef Brisket with Sweet Sauce",       "price": 25.00, "category": "Beef"},

    # ── 5. Seafood ────────────────────────────────────────
    {"pos_name": "Squid with Spicy Sauce",              "price": 24.00, "category": "Seafood"},
    {"pos_name": "Salt & Pepper Squid",                 "price": 24.00, "category": "Seafood"},
    {"pos_name": "Squid with Black Bean Sauce",         "price": 24.00, "category": "Seafood"},
    {"pos_name": "BBQ Flavoured Squid Leg",             "price": 24.00, "category": "Seafood"},
    {"pos_name": "Garlic Sprout with Squid Leg",        "price": 24.00, "category": "Seafood"},
    {"pos_name": "Fish Fillet with Pickled Vegetable",  "price": 25.00, "category": "Seafood"},
    {"pos_name": "Fish Fillet with Sweet & Sour Sauce", "price": 24.00, "category": "Seafood"},
    {"pos_name": "Chilli Fish Fillet",                  "price": 24.00, "category": "Seafood"},
    {"pos_name": "Salt & Pepper Fish Fillet",           "price": 24.00, "category": "Seafood"},
    {"pos_name": "Fish Fillet with Spicy Sauce",        "price": 24.00, "category": "Seafood"},
    {"pos_name": "Fish Fillet with Fresh Chilli",       "price": 24.00, "category": "Seafood"},
    {"pos_name": "Plum & Soy Glazed Fish",             "price": 24.00, "category": "Seafood"},
    {"pos_name": "Salt & Pepper Prawn with Shell",      "price": 29.00, "category": "Seafood"},
    {"pos_name": "Prawn with Spicy Sauce with Shell",   "price": 29.00, "category": "Seafood"},
    {"pos_name": "Chilli Soft Shell Crab",              "price": 34.00, "category": "Seafood"},
    {"pos_name": "Salt & Pepper Soft Shell Crab",       "price": 34.00, "category": "Seafood"},

    # ── 6. Lamb ───────────────────────────────────────────
    {"pos_name": "Lamb with Spicy Sauce",               "price": 26.00, "category": "Lamb"},
    {"pos_name": "Lamb with Cumin",                     "price": 25.00, "category": "Lamb"},
    {"pos_name": "Lamb with Spring Onion",              "price": 25.00, "category": "Lamb"},

    # ── 7. Soup ───────────────────────────────────────────
    {"pos_name": "Hot & Sour Soup",                     "price": 13.00, "category": "Soup"},
    {"pos_name": "Chicken Sweet Corn Soup",             "price": 13.00, "category": "Soup"},

    # ── 8. Fried Rice ─────────────────────────────────────
    {"pos_name": "Egg Fried Rice",                      "price": 14.00, "category": "Fried Rice"},
    {"pos_name": "Chicken Fried Rice",                  "price": 16.00, "category": "Fried Rice"},
    {"pos_name": "Beef Fried Rice",                     "price": 16.00, "category": "Fried Rice"},
    {"pos_name": "Shrimp Fried Rice",                   "price": 17.00, "category": "Fried Rice"},
    {"pos_name": "Yang Chow Fried Rice",                "price": 17.00, "category": "Fried Rice"},
    {"pos_name": "Combination Fried Rice",              "price": 17.00, "category": "Fried Rice"},
    {"pos_name": "Vegetable Fried Rice",                "price": 15.00, "category": "Fried Rice"},

    # ── 9. Fried Noodles ──────────────────────────────────
    {"pos_name": "Chicken Fried Noodle",                "price": 16.00, "category": "Fried Noodles"},
    {"pos_name": "Beef Fried Noodle",                   "price": 16.00, "category": "Fried Noodles"},
    {"pos_name": "Shrimp Fried Noodle",                 "price": 17.00, "category": "Fried Noodles"},
    {"pos_name": "Combination Fried Noodle",            "price": 17.00, "category": "Fried Noodles"},
    {"pos_name": "Vegetable Fried Noodle",              "price": 15.00, "category": "Fried Noodles"},

    # ── 10. Dumplings ─────────────────────────────────────
    {"pos_name": "Pork & Chive Dumpling",               "price": 17.00, "category": "Dumplings"},
    {"pos_name": "Chicken Dumpling",                    "price": 17.00, "category": "Dumplings"},
    {"pos_name": "Vegetarian Dumpling",                 "price": 17.00, "category": "Dumplings"},
    {"pos_name": "Steam Dumpling (20 pcs)",             "price": 20.00, "category": "Dumplings"},
    {"pos_name": "Pan-Fried Dumpling (15 pcs)",         "price": 15.00, "category": "Dumplings"},
    {"pos_name": "Sour & Spicy Soup Dumpling (10 pcs)", "price": 10.00, "category": "Dumplings"},

    # ── 11. Dish on Rice ──────────────────────────────────
    {"pos_name": "Sweet & Sour Pork on Rice",                "price": 16.00, "category": "Dish on Rice"},
    {"pos_name": "Sweet & Sour Chicken on Rice",             "price": 16.00, "category": "Dish on Rice"},
    {"pos_name": "Chicken with Black Bean Sauce on Rice",    "price": 16.00, "category": "Dish on Rice"},
    {"pos_name": "Gong Bao Chicken on Rice",                 "price": 16.00, "category": "Dish on Rice"},
    {"pos_name": "Hot & Spicy Chicken on Rice",              "price": 16.00, "category": "Dish on Rice"},
    {"pos_name": "Spicy Beef on Rice",                       "price": 16.00, "category": "Dish on Rice"},
    {"pos_name": "Beef with Oyster Sauce on Rice",           "price": 16.00, "category": "Dish on Rice"},
    {"pos_name": "Beef with Cumin on Rice",                  "price": 16.00, "category": "Dish on Rice"},
    {"pos_name": "Mapo Tofu on Rice",                        "price": 16.00, "category": "Dish on Rice"},
    {"pos_name": "Beef Brisket with Sweet Sauce on Rice",    "price": 16.00, "category": "Dish on Rice"},

    # ── 12. Tofu ──────────────────────────────────────────
    {"pos_name": "Mapo Tofu with Pork Mince",               "price": 20.00, "category": "Tofu"},
    {"pos_name": "Spicy Deep-Fried Tofu with Vegetable",     "price": 20.00, "category": "Tofu"},
    {"pos_name": "Tofu with Shrimp",                         "price": 20.00, "category": "Tofu"},
    {"pos_name": "Deep-Fried Tofu with Black Bean Sauce",    "price": 20.00, "category": "Tofu"},
    {"pos_name": "Deep-Fried Tofu with Spicy Sauce",         "price": 20.00, "category": "Tofu"},
    {"pos_name": "Salt & Pepper Tofu",                       "price": 20.00, "category": "Tofu"},
    {"pos_name": "Fried Tofu with Sweet & Sour Sauce",       "price": 20.00, "category": "Tofu"},
    {"pos_name": "Chilli Tofu",                              "price": 20.00, "category": "Tofu"},

    # ── 13. Vegetables ────────────────────────────────────
    {"pos_name": "Plain Okra",                          "price": 16.00, "category": "Vegetables"},
    {"pos_name": "Chilli Okra",                         "price": 16.00, "category": "Vegetables"},
    {"pos_name": "Sliced Potato",                       "price": 15.00, "category": "Vegetables"},
    {"pos_name": "Chilli Potato",                       "price": 15.00, "category": "Vegetables"},
    {"pos_name": "Chinese Cabbage with Garlic",         "price": 18.00, "category": "Vegetables"},
    {"pos_name": "Chinese Cabbage with Mushroom",       "price": 18.00, "category": "Vegetables"},  # price not listed in menu, assumed same as Garlic variant
    {"pos_name": "Green Bean with Pork Mince",          "price": 25.00, "category": "Vegetables"},
    {"pos_name": "Chinese Broccoli with Garlic",        "price": 23.00, "category": "Vegetables"},
    {"pos_name": "Mixed Vegetable",                     "price": 18.00, "category": "Vegetables"},
    {"pos_name": "Chilli Mushroom",                     "price": 17.00, "category": "Vegetables"},
    {"pos_name": "Eggplant with Spicy Sauce",           "price": 24.00, "category": "Vegetables"},
    {"pos_name": "Eggplant with Sweet Sauce",           "price": 24.00, "category": "Vegetables"},
    {"pos_name": "Chilli Eggplant",                     "price": 17.00, "category": "Vegetables"},
]


def get_restaurant_id(name: str) -> str:
    result = db.table(models.RESTAURANTS).select("id, name").eq("name", name).execute()
    if not result.data:
        print(f"ERROR: No restaurant found with name '{name}'")
        print("Available restaurants:")
        all_rest = db.table(models.RESTAURANTS).select("id, name").execute()
        for r in all_rest.data:
            print(f"  - {r['name']}  ({r['id']})")
        sys.exit(1)
    return result.data[0]["id"]


def update_menu(restaurant_id: str, dry_run: bool = False):
    existing = (
        db.table(models.MENU_ITEMS)
        .select("id, pos_name, price, category")
        .eq("restaurant_id", restaurant_id)
        .execute()
    )
    old_count = len(existing.data)

    print(f"\n  Current menu items in DB : {old_count}")
    print(f"  New menu items to insert : {len(MENU_ITEMS)}")

    if dry_run:
        print("\n  [DRY RUN] No changes written. New menu would be:\n")
        for item in MENU_ITEMS:
            print(f"    ${item['price']:>6.2f}  {item['category']:<18}  {item['pos_name']}")
        return

    print("\n  Step 1/2: Deleting old menu items...")
    db.table(models.MENU_ITEMS).delete().eq("restaurant_id", restaurant_id).execute()
    print(f"           Deleted {old_count} items.")

    print("  Step 2/2: Inserting new menu items...")
    rows = []
    for item in MENU_ITEMS:
        rows.append({
            "restaurant_id": restaurant_id,
            "pos_name": item["pos_name"],
            "price": item["price"],
            "category": item["category"],
            "is_active": True,
        })
    db.table(models.MENU_ITEMS).insert(rows).execute()
    print(f"           Inserted {len(rows)} items.")

    print("\n  New menu:\n")
    current_cat = None
    for item in MENU_ITEMS:
        if item["category"] != current_cat:
            current_cat = item["category"]
            print(f"    ── {current_cat} ──")
        print(f"      ${item['price']:>6.2f}  {item['pos_name']}")

    print(f"\n  Done! Menu updated to {len(rows)} items.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Update menu items only (no other data touched)")
    parser.add_argument("--restaurant", default=DEFAULT_RESTAURANT, help="Restaurant name to update")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing to DB")
    args = parser.parse_args()

    print("=" * 50)
    print("  SKAI Menu Updater")
    print("=" * 50)
    print(f"\n  Restaurant: {args.restaurant}")

    restaurant_id = get_restaurant_id(args.restaurant)
    print(f"  ID:         {restaurant_id}")

    update_menu(restaurant_id, dry_run=args.dry_run)
