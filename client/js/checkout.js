const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    alert("Please login first");
    window.location.href = "login.html";
}

const summary =
    document.getElementById("orderSummary");

async function renderSummary() {

    try {

        const res = await fetch(
            `https://physiowaye.onrender.com/api/cart/${user.id}`
        );

        const cart = await res.json();

        if (!cart.length) {

            summary.innerHTML = `
            <div class="empty-checkout">
                <h2>Your Cart is Empty</h2>
                <p>Add products before checkout.</p>
            </div>
            `;

            document.querySelector(
                ".place-order-btn"
            ).style.display = "none";

            return;
        }

        let totalItems = 0;
        let totalPrice = 0;

        let html = "";

        cart.forEach(item => {

            totalItems += item.quantity;

            totalPrice +=
                item.products.selling_price *
                item.quantity;

            html += `
            <div class="order-item">

                <div>

                    <div class="order-name">
                        ${item.products.product_name}
                    </div>

                    <div class="order-qty">
                        Quantity: ${item.quantity}
                    </div>

                </div>

                <div>
                    ₹${item.products.selling_price * item.quantity}
                </div>

            </div>
            `;

        });

        html += `
        <div class="summary-box">
            <h3>Total Items: ${totalItems}</h3>
            <h3>Total Amount: ₹${totalPrice}</h3>
        </div>
        `;

        summary.innerHTML = html;

    } catch (err) {

        console.error(err);

    }

}

renderSummary();

window.placeOrder = async function () {

    const name =
        document.getElementById("name").value.trim();

    const email =
        document.getElementById("email").value.trim();

    const phone =
        document.getElementById("phone").value.trim();

    const address =
        document.getElementById("address").value.trim();

    if (!name || !email || !phone || !address) {

        alert("Please fill all details");

        return;
    }

    try {

        // Fetch cart

        const cartRes = await fetch(
            `https://physiowaye.onrender.com/api/cart/${user.id}`
        );

        const cart = await cartRes.json();

        let total = 0;

        const items = cart.map(item => {

            total +=
                item.products.selling_price *
                item.quantity;

            return {
                id: item.products.id,
                qty: item.quantity,
                price: item.products.selling_price
            };

        });

        // Create Razorpay Order

        const razorpayRes = await fetch(
            "https://physiowaye.onrender.com/api/create-razorpay-order",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    amount: total
                })
            }
        );

        const razorpayOrder =
            await razorpayRes.json();

        const options = {

            key: "rzp_test_T51j3XaiQx5sos",

            amount: razorpayOrder.amount,

            currency: "INR",

            name: "PhysioWaye",

            description: "Order Payment",

            order_id: razorpayOrder.id,

            handler: async function (response) {

                const orderRes = await fetch(
                    "https://physiowaye.onrender.com/api/orders",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body: JSON.stringify({
                            user_id: user.id,
                            items,
                            total_amount: total
                        })
                    }
                );

                const result =
                    await orderRes.json();

                if (!result.success) {

                    alert("Order failed");

                    return;
                }

                // Clear cart

                for (const item of cart) {

                    await fetch(
                        `https://physiowaye.onrender.com/api/cart/${item.id}`,
                        {
                            method: "DELETE"
                        }
                    );

                }

                showOrderSuccess(
                    result.order_id
                );

            },

            prefill: {
                name,
                email,
                contact: phone
            },

            theme: {
                color: "#0077b6"
            }

        };

        const rzp =
            new Razorpay(options);

        rzp.open();

    } catch (err) {

        console.error(err);

        alert(
            "Something went wrong"
        );

    }

};

function showOrderSuccess(orderId) {

    document.getElementById(
        "orderMessage"
    ).textContent =
        `🎉 Your order has been placed successfully.`;

    document.getElementById(
        "successModal"
    ).style.display = "flex";

}

function goToOrders() {

    window.location.href =
        "orders.html";

}