const user = JSON.parse(sessionStorage.getItem("user"));

const orders = JSON.parse(localStorage.getItem("orders_"+user.id)) || [];

const list = document.getElementById("ordersList");

if(orders.length === 0){

list.innerHTML = "<p>No orders yet.</p>";

}

orders.forEach(order => {

list.innerHTML += `
<div class="order-card">
<p>Date: ${new Date(order.date).toLocaleString()}</p>
<p>Items: ${order.items.length}</p>
</div>
`;

});