const user =
JSON.parse(
sessionStorage.getItem("user")
);

const list =
document.getElementById(
"ordersList"
);

async function loadOrders() {

  const res =
  await fetch(
    `https://physiowaye.onrender.com/api/orders/${user.id}`
  );

  const orders =
  await res.json();

  if(!orders.length){

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

        <h3>
          Order #${order.id}
        </h3>

        <p>
          Status:
          ${order.status}
        </p>

        <p>
          Total:
          ₹${order.total_amount}
        </p>

        <p>
          ${new Date(
            order.created_at
          ).toLocaleString()}
        </p>

      </div>
    `;
  });

}

loadOrders();