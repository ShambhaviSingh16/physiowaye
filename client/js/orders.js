console.log("Orders JS Loaded");

const user =
    JSON.parse(
        sessionStorage.getItem("user")
    );

const list =
    document.getElementById(
        "ordersList"
    );

async function loadOrders() {
    console.log("USER:", user);
    console.log("FETCHING ORDERS...");
    const res =
        await fetch(
            `https://physiowaye.onrender.com/api/orders/${user.id}`
        );

    const orders =
        await res.json();

    if (!orders.length) {

        list.innerHTML = `
      <div class="empty-orders">
        <h2>No Orders Yet</h2>
      </div>
    `;

        return;
    }

    list.innerHTML = "";

    orders.forEach(order => {

list.innerHTML += `
<div class="order-card">

    <div class="order-header">
        <h3>Order</h3>

        <span class="status-badge">
            ${order.status}
        </span>
    </div>

    <p>
        Order ID:
        #${order.id}
    </p>

    <p>
        Total:
        ₹${order.total_amount}
    </p>

    <p>
        Placed:
        ${new Date(order.created_at)
          .toLocaleString()}
    </p>

</div>
`;
    });

}

loadOrders();