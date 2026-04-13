-- Enable Supabase Realtime for tables the frontend subscribes to.
-- Run this in the Supabase SQL Editor or via migration tooling.

ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE calls;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE business_hours;
ALTER PUBLICATION supabase_realtime ADD TABLE restaurants;
