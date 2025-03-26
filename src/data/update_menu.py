import json  # Import JSON module

print("✅ update_menu.py is running...")  # Confirm script is executing

# Step 1: Load menu.json
with open("src/data/menu.json", "r", encoding="utf-8") as file:
    menu = json.load(file)  # Convert JSON into Python list

# Step 2: Add "image": "default.jpg" to each item if it's missing
for item in menu:
    if "image" not in item:  # Check if "image" key exists
        item["image"] = "default.jpg"  # Set default image

# Step 3: Save the updated data back to menu.json
with open("src/data/menu.json", "w", encoding="utf-8") as file:
    json.dump(menu, file, indent=4)  # Write back to JSON file

print("✅ menu.json updated successfully!")  # Confirm success
