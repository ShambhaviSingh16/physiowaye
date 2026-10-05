const express = require('express');
const crypto = require('crypto');
const supabase = require('./supabase');
const requireAuth = require('./middleware/auth');
const { syncOrderTracking } = require('./delhivery-sync');
const router = express.Router();
router.use(requireAuth);
router.use(async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try {
    const { data, error } = await supabase.from('store_admins').select('user_id').eq('user_id', req.user.id).maybeSingle();
    if (error) return res.status(503).json({ error: 'Admin setup is unavailable. Contact your developer.' });
    if (!data) return res.status(403).json({ error: 'This account does not have admin access.' });
    next();
  } catch (_) { res.status(503).json({ error: 'Admin access could not be verified.' }); }
});
const page = req => Math.max(1, Math.min(100000, parseInt(req.query.page, 10) || 1));
const size = 25;
const range = req => [(page(req)-1)*size, page(req)*size-1];
const safeText = value => String(value || '').trim();
const cleanSearch = value => safeText(value).replace(/[%_]/g, '').slice(0,100);
const wrap = handler => async (req,res) => {
  try { await handler(req,res); } catch (_) { res.status(500).json({ error: 'This action could not be completed. Please try again or contact your developer.' }); }
};
router.get('/me', (req,res) => res.json({ email: req.user.email }));
router.get('/overview', wrap(async (req,res) => {
  const { data,error } = await supabase.rpc('admin_store_metrics');
  if (error) throw error;
  res.json(data);
}));
router.get('/orders', wrap(async (req,res) => {
  let query = supabase.from('orders').select('public_reference,created_at,total_amount,status,user_id,details', { count:'exact' });
  if (req.query.q) query = query.ilike('public_reference', `%${cleanSearch(req.query.q)}%`);
  const allowed = ['Pending','Confirmed','Packed','Shipped','Out for delivery','Delivered','Cancelled','Refunded'];
  if (allowed.includes(req.query.status)) query = query.eq('status',req.query.status);
  const { data,error,count } = await query.order('created_at',{ascending:false}).range(...range(req));
  if (error) throw error;
  res.json({ rows:data,total:count,page:page(req),size });
}));
router.get('/orders/:reference', wrap(async (req,res) => {
  const { data,error } = await supabase.from('orders').select('*,order_items(*,products(id,sku,product_name,description,image_url))')
    .eq('public_reference',req.params.reference).maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({error:'Order not found.'});
  res.json(data);
}));
router.post('/orders/:reference/tracking', wrap(async (req,res) => {
  const { data,error } = await supabase.from('orders').select('*').eq('public_reference',req.params.reference).maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({error:'Order not found.'});
  try { res.json({ linked: await syncOrderTracking(supabase,data) }); }
  catch (_) { res.status(503).json({error:'Delhivery could not be reached. Saved tracking remains available.'}); }
}));
router.get('/products', wrap(async (req,res) => {
  let query = supabase.from('products').select('*',{count:'exact'});
  if (req.query.q) query = query.ilike('product_name',`%${cleanSearch(req.query.q)}%`);
  const { data,error,count } = await query.order('id').range(...range(req));
  if(error) throw error;
  res.json({rows:data,total:count,page:page(req),size});
}));
router.post('/products', wrap(async (req,res) => {
  const input = req.body || {};
  const product = { sku:safeText(input.sku), product_name:safeText(input.product_name), description:safeText(input.description),
    mrp:Number(input.mrp),selling_price:Number(input.selling_price),stock:Number(input.stock),
    image_url:safeText(input.image_url),is_active:input.is_active };
  const id = input.id == null ? null : Number(input.id);
  const revision = Number(input.admin_revision || 0);
  if (product.sku.length < 2 || product.sku.length > 60 || !/^[a-zA-Z0-9_-]+$/.test(product.sku)
    || product.product_name.length < 2 || product.product_name.length > 250 || product.description.length > 10000
    || !Number.isFinite(product.mrp) || !Number.isFinite(product.selling_price) || product.selling_price <= 0
    || product.mrp < product.selling_price || product.mrp > 100000000
    || !Number.isInteger(product.stock) || product.stock < 0 || product.stock > 1000000
    || typeof product.is_active !== 'boolean' || (id !== null && (!Number.isSafeInteger(id) || id < 1))
    || !Number.isInteger(revision) || revision < 0) return res.status(400).json({error:'Check the product fields, price and stock.'});
  if (product.image_url) {
    try { if (new URL(product.image_url).protocol !== 'https:') throw new Error(); }
    catch (_) { return res.status(400).json({error:'Use an HTTPS image URL or upload an image.'}); }
  }
  const { data,error } = await supabase.rpc('admin_save_product',{p_actor:req.user.id,p_id:id,p_revision:revision,p_data:product});
  if (error) return res.status(409).json({error: error.code === '23505' ? 'That SKU already exists.' : 'The product could not be saved. Reload it in case another edit changed it.'});
  res.json(data);
}));
router.post('/images', express.raw({ type:['image/jpeg','image/png','image/webp'],limit:'5mb' }), wrap(async (req,res) => {
  const bytes=req.body, type=req.get('content-type');
  const valid = Buffer.isBuffer(bytes) && bytes.length > 12 && (
    (type==='image/jpeg' && bytes[0]===255 && bytes[1]===216 && bytes[2]===255) ||
    (type==='image/png' && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ||
    (type==='image/webp' && bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP'));
  if (!valid) return res.status(400).json({error:'Choose a JPEG, PNG or WebP image up to 5 MB.'});
  const name=`${crypto.randomUUID()}.${{'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[type]}`;
  const {error}=await supabase.storage.from('product-images').upload(name,bytes,{contentType:type,upsert:false});
  if(error) throw error;
  const {error:auditError}=await supabase.from('admin_activity').insert({actor_id:req.user.id,action:'image_uploaded',summary:'Product image uploaded'});
  if(auditError) { await supabase.storage.from('product-images').remove([name]); throw auditError; }
  res.json({url:supabase.storage.from('product-images').getPublicUrl(name).data.publicUrl});
}));
function customer(user) {
  return {id:user.id,email:user.email,name:user.user_metadata?.full_name || user.user_metadata?.name || '',
    phone:user.phone || user.user_metadata?.phone || '',created_at:user.created_at,last_sign_in_at:user.last_sign_in_at,
    providers:(user.identities || []).map(identity=>identity.provider),email_confirmed:!!user.email_confirmed_at};
}
router.get('/customers', wrap(async(req,res)=>{
  const {data,error}=await supabase.auth.admin.listUsers({page:page(req),perPage:size});
  if(error) throw error;
  res.json({rows:data.users.map(customer),total:data.total || data.users.length,page:page(req),size});
}));
router.get('/customers/:id', wrap(async(req,res)=>{
  const {data,error}=await supabase.auth.admin.getUserById(req.params.id);
  if(error || !data.user) return res.status(404).json({error:'Customer not found.'});
  const {data:orders,error:orderError,count}=await supabase.from('orders').select('public_reference,created_at,total_amount,status,details',{count:'exact'})
    .eq('user_id',req.params.id).order('created_at',{ascending:false}).range(...range(req));
  if(orderError) throw orderError;
  res.json({customer:customer(data.user),rows:orders,total:count,page:page(req),size});
}));
router.get('/activity',wrap(async(req,res)=>{
  const {data,error,count}=await supabase.from('admin_activity').select('*',{count:'exact'}).order('id',{ascending:false}).range(...range(req));
  if(error) throw error;
  res.json({rows:data,total:count,page:page(req),size});
}));
router.use((error,req,res,next)=>res.status(error.type==='entity.too.large'?413:400).json({error:'The upload is invalid or larger than 5 MB.'}));
module.exports=router;
