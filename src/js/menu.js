document.addEventListener("DOMContentLoaded", function () {
    console.log("✅ menu.js is loaded and running!");  // Confirm script is running

    fetch("../data/menu.json")  // Fetch menu data
        .then(response => {
            console.log("✅ Fetch Response:", response);  // Log the response for debugging

            if (!response.ok) {
                throw new Error(`❌ HTTP error! Status: ${response.status}`);
            }

            return response.json();  // Convert response to JSON
        })
        .then(data => {
            console.log("✅ Menu JSON Loaded Successfully:", data);  // Log the loaded JSON data

            // Map categories to the corresponding tab containers in menu.html
            const categories = {
                "Appetizers & Sides": document.getElementById("appetizersList"),
                "Desserts & Others": document.getElementById("dessertsList"),
                "Entrées & Curries": document.getElementById("entreesList"),
                "Noodle & Rice Dishes": document.getElementById("noodlesList"),
                "Soups & Salads": document.getElementById("soupsList"),
                "Specials": document.getElementById("specialsList"),
            };

            // Clear old content before inserting new data
            Object.values(categories).forEach(container => {
                if (container) container.innerHTML = "";
            });

            // Populate each category with menu items
            data.forEach(item => {
                if (categories[item.category]) {
                    const menuItem = document.createElement("div");
                    menuItem.classList.add("col-12", "col-md-6");

                    menuItem.innerHTML = `
                        <div class="py-3 border-bottom">
                            <div class="row">
                                <div class="col-3 align-self-center">
                                    <!-- Image -->
                                    <div class="ratio ratio-1x1">
                                        <img class="object-fit-cover" src="../assets/img/default.jpg" alt="${item.dish}" />
                                    </div>
                                </div>
                                <div class="col-7">
                                    <!-- Dish Name -->
                                    <h5 class="mb-2">${item.dish}</h5>
                                    <!-- Description -->
                                    <p class="mb-0">${item.description ? item.description : "No description available."}</p>
                                </div>
                                <div class="col-2">
                                    <!-- Price -->
                                    <div class="fs-4 font-serif text-center text-body-emphasis">$${item.price ? item.price.toFixed(2) : "N/A"}</div>
                                </div>
                            </div>
                        </div>
                    `;

                    categories[item.category].appendChild(menuItem);
                }
            });
        })
        .catch(error => console.error("❌ Error loading menu.json:", error));
});
