const user = JSON.parse(sessionStorage.getItem("user"));

const cart = JSON.parse(localStorage.getItem("cart_"+user.id)) || [];

const summary = document.getElementById("orderSummary");

let total = 0;

cart.forEach(item => {

summary.innerHTML += `<p>Product ID ${item.id} × ${item.qty}</p>`;

total += item.qty;

});

summary.innerHTML += `<h3>Total Items: ${total}</h3>`;


function placeOrder(){

let orders = JSON.parse(localStorage.getItem("orders_"+user.id)) || [];

orders.push({
date:new Date(),
items:cart
});

localStorage.setItem("orders_"+user.id, JSON.stringify(orders));

localStorage.removeItem("cart_"+user.id);

alert("Order placed successfully!");

window.location.href="orders.html";

}