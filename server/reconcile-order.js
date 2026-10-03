// Staff-only tool for orders created before payment references were stored.
// Preview first: node reconcile-order.js 15 pay_ACTUAL_REFERENCE
// After checking customer/amount: node reconcile-order.js 15 pay_ACTUAL_REFERENCE --apply
require('dotenv').config();
const supabase = require('./supabase');
const Razorpay = require('razorpay');
const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
async function main() {
  const [orderId, paymentId, flag] = process.argv.slice(2);
  if (!/^\d+$/.test(orderId || '') || !/^pay_[a-zA-Z0-9]+$/.test(paymentId || '')) throw new Error('Usage: node reconcile-order.js ORDER_DATABASE_ID PAYMENT_ID [--apply]');
  const { data: order, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (error) throw error;
  if (!order.public_reference) throw new Error('Run the order migration first.');
  if (order.details?.payment?.id && order.details.payment.id !== paymentId) throw new Error('This order already has a different payment reference.');
  const payment = await razorpay.payments.fetch(paymentId);
  if (payment.status !== 'captured' || payment.currency !== 'INR' || Number(payment.amount) !== Math.round(Number(order.total_amount) * 100)) throw new Error('Payment must be captured and match the exact order amount/currency.');
  const { data: used, error: usedError } = await supabase.from('orders').select('id').contains('details', { payment: { id: paymentId } });
  if (usedError) throw usedError;
  if (used.some(row => String(row.id) !== String(order.id))) throw new Error('Payment is already associated with another order.');
  console.log({ reference: order.public_reference, order_user: order.user_id, amount: Number(payment.amount) / 100, payment_email: payment.email, payment_contact: payment.contact, payment_status: payment.status, method: payment.method });
  if (flag !== '--apply') { console.log('Preview only. Confirm this payment belongs to this customer/order, then repeat with --apply.'); return; }
  const details = { ...order.details, razorpay_order_id: payment.order_id,
    test_mode: process.env.RAZORPAY_KEY_ID.startsWith('rzp_test_'),
    payment: { id: payment.id, status: 'Paid', method: payment.method, bank: payment.bank || null, wallet: payment.wallet || null, card_last4: payment.card?.last4 || null, card_network: payment.card?.network || null, verified_at: new Date().toISOString() },
    tracking: order.details?.tracking?.length ? order.details.tracking : [{ status: 'Confirmed', at: new Date().toISOString(), note: 'Earlier payment reconciled and verified by our team.' }]
  };
  const { error: updateError } = await supabase.from('orders').update({ details, status: order.status === 'Pending' ? 'Confirmed' : order.status }).eq('id', order.id);
  if (updateError) throw updateError;
  console.log('Payment reconciled. Refresh the orders page.');
}
main().catch(error => { console.error(error.message || 'Reconciliation failed'); process.exitCode = 1; });
