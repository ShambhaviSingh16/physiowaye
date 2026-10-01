const list = document.getElementById("ordersList");
const ordersStatus = document.getElementById("ordersStatus");
const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

function renderOrder(order) {
  const card = document.createElement("article");
  card.className = "order-card";

  const top = document.createElement("div");
  top.className = "order-card-top";
  const title = document.createElement("h2");
  title.textContent = `Order #${order.id}`;
  const status = document.createElement("span");
  status.className = `status-pill status-${String(order.status || "pending").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  status.textContent = order.status || "Pending";
  top.append(title, status);

  const date = document.createElement("p");
  date.className = "order-date";
  const parsedDate = new Date(order.created_at);
  date.textContent = Number.isNaN(parsedDate.getTime())
    ? "Date unavailable"
    : `Placed ${parsedDate.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}`;

  const total = document.createElement("p");
  total.className = "order-total";
  total.textContent = currency.format(Number(order.total_amount) || 0);

  card.append(top, date, total);
  return card;
}

async function loadOrders() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }

  try {
    const response = await apiFetch(`/orders/${encodeURIComponent(session.user.id)}`);
    if (!response.ok) throw new Error("Order request failed");
    const orders = await response.json();
    list.replaceChildren();

    if (!Array.isArray(orders) || orders.length === 0) {
      ordersStatus.textContent = "You haven’t placed an order yet.";
      const link = document.createElement("a");
      link.href = "products.html";
      link.className = "btn-primary";
      link.textContent = "Explore products";
      list.append(link);
      return;
    }

    ordersStatus.textContent = `${orders.length} ${orders.length === 1 ? "order" : "orders"}`;
    orders.forEach(order => list.append(renderOrder(order)));
  } catch (error) {
    console.error("Unable to load orders:", error);
    ordersStatus.textContent = "We couldn’t load your orders. Please refresh and try again.";
  }
}

loadOrders();
