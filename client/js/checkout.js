const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    alert("Please login first");
    window.location.href = "login.html";
}



const summary =
document.getElementById("orderSummary");

let totalItems = 0;



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

  } catch(err) {

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

    const cartRes = await fetch(
      `https://physiowaye.onrender.com/api/cart/${user.id}`
    );

    const cartItems = await cartRes.json();

    if (!cartItems.length) {

      alert("Cart is empty");

      return;
    }

    let total = 0;

    const items = cartItems.map(item => {

      total +=
        item.products.selling_price *
        item.quantity;

      return {
        id: item.products.id,
        qty: item.quantity,
        price: item.products.selling_price
      };

    });

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
          total_amount: total,
          customer: {
            name,
            email,
            phone,
            address
          }
        })
      }
    );

    const result =
      await orderRes.json();

    if (!result.success) {

      alert("Order failed");

      return;
    }

    for (const item of cartItems) {

      await fetch(
        `https://physiowaye.onrender.com/api/cart/${item.id}`,
        {
          method: "DELETE"
        }
      );

    }

   showOrderSuccess(result.order_id);

    // window.location.href =
    //   "orders.html";

  } catch (err) {

    console.error(err);

    alert(
      "Something went wrong"
    );

  }

};

function showOrderSuccess(orderId) {

    document.getElementById("orderMessage").textContent =
        `Your order #${orderId} has been placed successfully.`;

    document.getElementById("successModal").style.display = "flex";
}

function goToOrders() {

    window.location.href = "orders.html";
}