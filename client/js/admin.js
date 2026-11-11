const content = document.getElementById('adminContent'), statusLine = document.getElementById('adminStatus');
function clearAdminNotice() {
  statusLine.textContent = '';
  statusLine.dataset.state = '';
  statusLine.setAttribute('role', 'status');
  statusLine.setAttribute('aria-live', 'polite');
}
function notifyAdmin(message, type = 'success', title = '') {
  statusLine.setAttribute('role', type === 'error' ? 'alert' : 'status');
  statusLine.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  statusLine.textContent = message;
  statusLine.dataset.state = type;
  showToast(message, { type, title: title || (type === 'error' ? 'Action failed' : 'Done'), announce: false });
}
content.addEventListener('error', event => {
  const image = event.target;
  if (image.tagName !== 'IMG' || image.dataset.fallback) return;
  image.dataset.fallback = 'true';
  image.src = 'assets/images/logo.png';
}, true);
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(value)||0);
const date = value => {
  if (!value) return 'Not available';
  const text = String(value);
  const parsed = new Date(/T/.test(text) && !/(Z|[+-]\d\d:\d\d)$/.test(text) ? `${text}Z` : text);
  return Number.isNaN(parsed.getTime()) ? 'Not available' : parsed.toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Asia/Kolkata'});
};
const iconPaths = {
 overview:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
 orders:'M3 7h12v10H3z M15 10h3l3 4v3h-6 M6 7V4h7 M6 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4 M18 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
 products:'M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10',
 customers:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-4',
 messages:'M3 5h18v12H7l-4 3V5z M7 9h10 M7 13h7',
 activity:'M21 12a9 9 0 1 1-3-6 M21 3v6h-6 M12 7v5l3 2',
 sales:'M12 3v18 M17 6H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H6',
 check:'M5 12l4 4L19 6',
 clock:'M12 8v4l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0'
};
const icon = (name, className='nav-icon') => `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconPaths[name] || iconPaths.overview}"/></svg>`;
document.querySelectorAll('.sidebar [data-section]').forEach(button => button.insertAdjacentHTML('afterbegin',icon(button.dataset.section)));
function productThumb(product) {
  const local = product.sku ? `assets/images/products/${encodeURIComponent(String(product.sku).toLowerCase())}.jpg?v=catalog-20261111` : 'assets/images/logo.png';
  const source = /^https:\/\//.test(product.image_url || '') ? product.image_url : local;
  return `<img src="${esc(source)}" alt="" loading="lazy">`;
}

let section='overview', currentPage=1, query='', orderStatus='', products=[], selectedProduct=null, customerId=null, requestRevision=0, galleryDraft=[], galleryUploading=false;
const catalogPhotoCounts = {'pw-001':5,'pw-002':6,'pw-003':4,'pw-004':5,'pw-005':4,'pw-006':6,'pw-007':5,'pw-008':5,'pw-009':5,'pw-0010':5,'pw-0011':4};
function existingProductImages(product) {
  if (!product) return [];
  if (Array.isArray(product.image_urls) && product.image_urls.length) return product.image_urls.slice(0,6);
  const sku=String(product.sku||'').toLowerCase();
  const images=[product.image_url || (catalogPhotoCounts[sku] ? new URL(`assets/images/products/${sku}.jpg`,document.baseURI).href : '')].filter(Boolean);
  for(let number=2;number<=(catalogPhotoCounts[sku]||1);number++) {
    images.push(new URL(`assets/images/products/${sku}-${number}.jpg`,document.baseURI).href);
  }
  return images;
}
function renderImageEditor() {
  const list=document.getElementById('productImageList');
  if(!list)return;
  list.innerHTML=galleryDraft.map((url,index)=>`<div class="admin-image-row">
    <div class="admin-image-preview">${url?`<img src="${esc(url)}" alt="Product image ${index+1} preview">`:'<span>Choose a photo</span>'}</div>
    <div class="admin-image-fields">
      <label>Image ${index+1}${index===0?' · Cover':''}<input type="url" data-image-url="${index}" value="${esc(url)}" placeholder="https://..." aria-label="Image ${index+1} URL"></label>
      <label>Upload JPEG, PNG or WebP (up to 5 MB)<input type="file" data-image-file="${index}" accept="image/jpeg,image/png,image/webp"></label>
      <div class="admin-image-actions"><button type="button" class="secondary" data-image-up="${index}" ${index===0?'disabled':''}>Move up</button><button type="button" class="secondary" data-image-remove="${index}">Remove</button></div>
    </div>
  </div>`).join('');
  document.getElementById('imageCount').textContent=`${galleryDraft.length} of 6 images`;
  document.getElementById('addProductImage').disabled=galleryDraft.length>=6;
  document.getElementById('productImageBatch').disabled=galleryDraft.length>=6;
}
const titles={overview:'Your store at a glance',orders:'Orders & shipments',products:'Your product catalog',customers:'Your customers',messages:'Customer messages',activity:'Activity history'};
async function request(path,options={}) {
  const response=await apiFetch(`/admin${path}`,options);
  const data=await response.json().catch(()=>({error:'The server could not complete this request.'}));
  if(response.status===401 || response.status===403) { showGate(data.error || 'Please sign in again.'); throw new Error(data.error || 'Sign-in required'); }
  if(!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}
function showGate(message='') {
  requestRevision++;
  document.getElementById('adminApp').hidden=true;
  document.getElementById('adminGate').hidden=false;
  document.getElementById('gateStatus').dataset.state=message?'error':'idle';
  document.getElementById('gateStatus').textContent=message;
  if(message)showToast(message,{type:'error',title:'Owner access unavailable',announce:false});
  content.replaceChildren(); products=[];
}
async function initialise() {
  try {
    const {data:{session}}=await supabaseClient.auth.getSession();
    document.getElementById('gateSignOut').hidden=!session;
    if(!session) return showGate();
    const me=await request('/me');
    document.getElementById('adminIdentity').textContent=me.email;
    document.getElementById('adminGate').hidden=true;
    document.getElementById('adminApp').hidden=false;
    loadSection();
  } catch(error) { showGate(error.message); }
}
document.getElementById('adminLogin').addEventListener('submit',async event=>{
  event.preventDefault(); const button=event.target.querySelector('button');button.disabled=true;
  document.getElementById('gateStatus').dataset.state='pending';
  document.getElementById('gateStatus').textContent='Signing in…';
  try {
    const {error}=await supabaseClient.auth.signInWithPassword({email:document.getElementById('adminEmail').value.trim(),password:document.getElementById('adminPassword').value});
    if(error) throw error;
    document.getElementById('adminPassword').value='';await initialise();
  } catch(error) { document.getElementById('gateStatus').dataset.state='error';document.getElementById('gateStatus').textContent=error.message;showToast(error.message,{type:'error',title:'Could not sign in',announce:false}); }
  finally {button.disabled=false;}
});
document.getElementById('adminGoogleLogin').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  document.getElementById('gateStatus').dataset.state = 'pending';
  document.getElementById('gateStatus').textContent = 'Opening Google sign-in…';
  try {
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: new URL('admin.html', window.location.href).href,
        queryParams: { prompt: 'select_account' }
      }
    });
    if (error) throw error;
    if (!data?.url) throw new Error('Google sign-in could not be opened. Please try again.');
  } catch (error) {
    document.getElementById('gateStatus').dataset.state = 'error';
    document.getElementById('gateStatus').textContent = error.message;
    showToast(error.message,{type:'error',title:'Google sign-in unavailable',announce:false});
    button.disabled = false;
  }
});
async function signOut() {
  const {error}=await supabaseClient.auth.signOut();
  if(error) {notifyAdmin('Sign out failed. Please try again.','error','Could not sign out');return;}
  sessionStorage.removeItem('user');showGate();document.getElementById('gateSignOut').hidden=true;
}
document.getElementById('adminSignOut').onclick=signOut;document.getElementById('gateSignOut').onclick=signOut;
document.querySelector('nav').addEventListener('click',event=>{
  const button=event.target.closest('[data-section]');if(!button)return;
  section=button.dataset.section;currentPage=1;query='';orderStatus='';customerId=null;loadSection();
});
function pager(data) {
  return `<div class="pager"><span>${data.total} records · Page ${data.page}</span><button class="secondary" data-page="${data.page-1}" ${data.page<=1?'disabled':''}>Previous</button><button class="secondary" data-page="${data.page+1}" ${data.page*data.size>=data.total?'disabled':''}>Next</button></div>`;
}
function table(headers,rows) {return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')||`<tr><td colspan="${headers.length}" class="empty">No records to show.</td></tr>`}</tbody></table></div>`;}
function badge(text){
  const label=text || 'Pending';
  const style=/^(paid|delivered|active)$/i.test(label)?'success':/pending|unverified|awaiting|low/i.test(label)?'warning':/cancel|refund|archived/i.test(label)?'closed':/test/i.test(label)?'test':'info';
  return `<span class="badge ${style}">${esc(label)}</span>`;
}
function ordersTable(rows) {
  return table(['Order reference','Customer','Placed','Total','Status',''],rows.map(order=>`<tr><td class="reference">${esc(order.public_reference)}</td><td>${esc(order.details?.delivery?.name || 'Earlier order')}<br>${esc(order.details?.delivery?.email || '')}</td><td>${esc(date(order.created_at))}</td><td>${money(order.total_amount)}<br>${order.details?.test_mode?'Test order':''}</td><td>${badge(order.status)}<br>${esc(order.details?.payment?.status || 'Unverified')}</td><td><button class="secondary" data-order="${esc(order.public_reference)}">Open order</button></td></tr>`));
}
async function loadSection() {
  delete content.dataset.reference;
  const revision=++requestRevision;clearAdminNotice();content.setAttribute('aria-busy','true');content.innerHTML='<div class="panel loading-panel">Loading your store information…</div>';
  document.getElementById('sectionTitle').textContent=titles[section];
  document.querySelectorAll('[data-section]').forEach(button=>{button.classList.toggle('active',button.dataset.section===section);button.setAttribute('aria-current',button.dataset.section===section?'page':'false');});
  try {
    const params=new URLSearchParams({page:currentPage,q:query,status:orderStatus});
    const data=await request(section==='overview'?'/overview':customerId?`/customers/${encodeURIComponent(customerId)}?${params}`:`/${section}?${params}`);
    if(revision!==requestRevision)return;
    if(section==='overview') {
      const metrics=[['Live paid sales',money(data.live_sales)],['All orders',data.orders],['Paid orders',data.paid_orders],['Awaiting shipment',data.awaiting_shipment],['Linked shipments',data.shipments],['In transit',data.in_transit],['Delivered orders',data.delivered],['Customers',data.customers],['Low-stock products',data.low_stock],['Test orders',data.test_orders]];
      content.innerHTML=`<div class="cards">${metrics.map(([label,value],i)=>`<article class="metric">${icon(['sales','orders','check','clock','products','orders','check','customers','products','activity'][i],'metric-icon')}<span>${label}</span><strong>${esc(value)}</strong><small>${['Captured live order value','Across your store','Payment verified','Ready for your next step','Connected to a courier','On their way','Delivery completed','Registered accounts','Five units or fewer','Separate from live sales'][i]}</small></article>`).join('')}</div><div class="notice">Live paid sales exclude Razorpay test orders. This is captured order value, not net revenue after refunds, tax or shipping expenses.</div><section class="panel"><h2>Your daily workflow</h2><p>Open a paid order, copy its order reference and use it as the Order ID when creating the shipment in Delhivery One. Shipment updates then connect automatically.</p><button data-section-shortcut="orders">View orders →</button></section>`;
    } else if(section==='orders') {
      content.innerHTML=`<form id="adminSearch" class="toolbar"><input name="q" aria-label="Search order reference" placeholder="Search PW order reference" value="${esc(query)}"><select name="status" aria-label="Order status"><option value="">All statuses</option>${['Pending','Confirmed','Packed','Shipped','Out for delivery','Delivered','Cancelled','Refunded'].map(value=>`<option ${value===orderStatus?'selected':''}>${value}</option>`).join('')}</select><button>Search</button></form>${ordersTable(data.rows)}${pager(data)}`;
    } else if(section==='products') {
      products=data.rows;
      content.innerHTML=`<form id="adminSearch" class="toolbar"><input name="q" aria-label="Search products" placeholder="Search product name" value="${esc(query)}"><button>Search</button><button type="button" class="secondary" data-new-product>Add product +</button></form>${table(['Product','SKU','Price','Stock','Availability',''],data.rows.map(product=>`<tr><td><div class="product-cell">${productThumb(product)}<strong>${esc(product.product_name)}</strong></div></td><td>${esc(product.sku)}</td><td>${money(product.selling_price)}</td><td>${esc(product.stock)}</td><td>${badge(product.is_active?'Active':'Archived')}</td><td><button class="secondary" data-product="${product.id}">Edit</button></td></tr>`))}${pager(data)}`;
    } else if(section==='customers' && customerId) {
      content.innerHTML=`<button class="secondary" data-back>← All customers</button><section class="panel" style="margin-top:20px"><h2>${esc(data.customer.name || data.customer.email)}</h2>${customerDetails(data.customer)}<p>Addresses and delivery phone numbers are shown in each order below.</p></section>${ordersTable(data.rows)}${pager(data)}`;
    } else if(section==='messages') {
      content.innerHTML=`<p>Messages sent through the website contact form appear here. Reply using the customer email shown with each message.</p>${table(['Received','Name','Email','Message'],data.rows.map(item=>`<tr><td>${esc(date(item.created_at))}</td><td>${esc(item.name)}</td><td>${esc(item.email)}</td><td class="message-copy">${esc(item.message)}</td></tr>`))}${pager(data)}`;
    } else if(section==='customers') {
      content.innerHTML=`<p>Contact details reflect information actually provided. Open a customer to view their order addresses.</p>${table(['Customer','Email / phone','Sign-in provider','Account created','Last sign-in',''],data.rows.map(user=>`<tr><td>${esc(user.name||'Name not provided')}</td><td>${esc(user.email)}<br>${esc(user.phone||'Phone not provided')}</td><td>${esc(user.providers.join(', ') || 'Not available')}</td><td>${esc(date(user.created_at))}</td><td>${esc(date(user.last_sign_in_at))}</td><td><button class="secondary" data-customer="${esc(user.id)}">View customer</button></td></tr>`))}${pager(data)}`;
    } else {
      content.innerHTML=table(['When','Action','Details','Admin account ID'],data.rows.map(item=>`<tr><td>${esc(date(item.created_at))}</td><td>${esc(item.action.replaceAll('_',' '))}</td><td>${esc(item.summary)}</td><td>${esc(item.actor_id)}</td></tr>`))+pager(data);
    }
    return true;
  } catch(error) { if(revision===requestRevision){notifyAdmin(error.message,'error','Store information unavailable');content.innerHTML='<button data-retry>Try again</button>';}return false;}
  finally {content.setAttribute('aria-busy','false');}
}
function customerDetails(user){return `<dl class="customer-summary"><dt>Email</dt><dd>${esc(user.email)}</dd><dt>Account phone</dt><dd>${esc(user.phone||'Not provided')}</dd><dt>Sign-in providers</dt><dd>${esc(user.providers.join(', ') || 'Not available')}</dd><dt>Created</dt><dd>${esc(date(user.created_at))}</dd><dt>Last sign-in</dt><dd>${esc(date(user.last_sign_in_at))}</dd></dl>`;}
async function openOrder(reference) {
  const revision=++requestRevision;clearAdminNotice();content.innerHTML='<div class="panel loading-panel">Loading order details…</div>';
  try {
    const order=await request(`/orders/${encodeURIComponent(reference)}`);if(revision!==requestRevision)return;
    const details=order.details||{}, delivery=details.delivery||{}, payment=details.payment||{}, shipment=details.shipment||{};
    const items=details.items || (order.order_items||[]).map(line=>({name:line.products?.product_name,qty:line.quantity,price:line.price,description:line.products?.description}));
    const subtotal=items.reduce((sum,item)=>sum+Number(item.price||0)*Number(item.qty||0),0);
    const events=[...(details.tracking||[]),...(shipment.events||[])].sort((a,b)=>String(b.at).localeCompare(String(a.at)));
    content.innerHTML=`<div class="toolbar"><button class="secondary" data-back>← Back to ${customerId?'customer':'orders'}</button></div><section class="panel"><span class="kicker">ORDER REFERENCE</span><h2 class="reference">${esc(order.public_reference)}</h2><div class="actions"><button data-copy="${esc(order.public_reference)}">Copy order reference</button>${badge(order.status)}${badge(payment.status||'Payment unverified')}${details.test_mode?badge('Test order'):''}</div><p>Placed ${esc(date(order.created_at))}</p><div class="notice">Use this exact reference as the Order ID in Delhivery One. Create the shipment there as usual.</div></section><div class="detail-grid"><section class="panel"><h3>Delivery & contact</h3>${delivery.name?`<strong>${esc(delivery.name)}</strong><p>${esc(delivery.address)}<br>${esc(delivery.city)}, ${esc(delivery.state)} ${esc(delivery.pincode)}</p><p>${esc(delivery.phone)}<br>${esc(delivery.email)}</p>`:'<p>No delivery snapshot was saved for this earlier order.</p>'}</section><section class="panel"><h3>Payment</h3><p>${esc(payment.status||'Unverified')}<br>${esc(payment.method||'Method unavailable')}${payment.bank?` · ${esc(payment.bank)}`:''}${payment.card_last4?` · Card ending ${esc(payment.card_last4)}`:''}</p><dl><dt>Payment reference</dt><dd>${esc(payment.id||'Not recorded')}</dd><dt>Verified</dt><dd>${esc(date(payment.verified_at))}</dd></dl></section><section class="panel"><h3>Price breakdown</h3><p>Items: ${money(subtotal)}<br>Delivery: ${money(details.shipping||0)}<br>Other recorded charges: ${money(Number(order.total_amount)-subtotal-Number(details.shipping||0))}</p><strong>Total ${money(order.total_amount)}</strong></section></div><section class="panel"><h2>Purchased products</h2>${table(['Product','Quantity','Unit price','Total'],items.map(item=>`<tr><td><strong>${esc(item.name||'Equipment')}</strong>${esc(item.description||'')}</td><td>${esc(item.qty)}</td><td>${money(item.price)}</td><td>${money(Number(item.qty)*Number(item.price))}</td></tr>`))}</section><section class="panel"><h2>Shipment updates</h2><p>${esc(shipment.carrier||'Awaiting shipment')} · ${esc(shipment.status||order.status)}<br>AWB: ${esc(shipment.tracking_number||'Not assigned')}<br>Last checked: ${esc(date(shipment.synced_at))}</p><button class="secondary" data-sync="${esc(order.public_reference)}">Check Delhivery updates</button><ul class="timeline">${events.map(item=>`<li><strong>${esc(item.status)}</strong><time>${esc(date(item.at))}</time><p>${esc(item.note||'')}<br>${esc(item.location||'')}</p></li>`).join('')}</ul></section>`;
    content.dataset.reference=reference;
    return true;
  } catch(error){if(revision===requestRevision)notifyAdmin(error.message,'error','Order unavailable');return false;}
}
function productForm(product=null) {
  requestRevision++; selectedProduct=product;galleryDraft=existingProductImages(product);clearAdminNotice();const p=product||{};
  content.innerHTML=`<div class="toolbar"><button class="secondary" data-back>← Back to catalog</button></div><section class="panel"><h2>${product?'Edit product':'Add a product'}</h2><form id="productForm" class="form-grid">
    <label>Product name<input name="product_name" required minlength="2" maxlength="250" value="${esc(p.product_name)}"></label>
    <label>SKU<input name="sku" required pattern="[A-Za-z0-9_-]{2,60}" value="${esc(p.sku)}"><small>Unique code, e.g. PW-012</small></label>
    <label class="wide">Description<textarea name="description" maxlength="10000">${esc(p.description)}</textarea></label>
    <label>MRP (₹)<input name="mrp" type="number" min="0.01" step="0.01" required value="${esc(p.mrp)}"></label>
    <label>Selling price (₹)<input name="selling_price" type="number" min="0.01" step="0.01" required value="${esc(p.selling_price)}"></label>
    <label>Stock quantity<input name="stock" type="number" min="0" step="1" required value="${esc(p.stock??0)}"></label>
    <div class="wide"><div class="admin-image-heading"><div><strong>Product photos</strong><small>The first image is the cover photo shown in product cards. Add up to 6 images.</small></div><span id="imageCount"></span></div><div id="productImageList" class="admin-image-list"></div><div class="admin-image-add"><label>Upload photos together<input id="productImageBatch" type="file" accept="image/jpeg,image/png,image/webp" multiple><small>Choose up to 6 JPEG, PNG or WebP files, 5 MB each.</small></label><button type="button" id="addProductImage" class="secondary" data-image-add>Or add an image URL +</button></div></div>
    <label class="checkbox wide"><input name="is_active" type="checkbox" ${p.is_active!==false?'checked':''}>Available in the store (uncheck to archive)</label>
    <div class="actions wide"><button type="submit">Save product</button><button class="secondary" type="button" data-back>Cancel</button></div>
  </form></section>`;
  renderImageEditor();
}
content.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;clearAdminNotice();
  if(button.hasAttribute('data-image-add')){if(galleryDraft.length<6){galleryDraft.push('');renderImageEditor();}return;}
  if(button.hasAttribute('data-image-remove')){galleryDraft.splice(Number(button.dataset.imageRemove),1);renderImageEditor();return;}
  if(button.hasAttribute('data-image-up')){const index=Number(button.dataset.imageUp);if(index>0){[galleryDraft[index-1],galleryDraft[index]]=[galleryDraft[index],galleryDraft[index-1]];renderImageEditor();}return;}
  if(button.hasAttribute('data-page')){currentPage=Number(button.dataset.page);return loadSection();}
  if(button.hasAttribute('data-order'))return openOrder(button.dataset.order);
  if(button.hasAttribute('data-customer')){customerId=button.dataset.customer;currentPage=1;return loadSection();}
  if(button.hasAttribute('data-product'))return productForm(products.find(product=>String(product.id)===button.dataset.product));
  if(button.hasAttribute('data-new-product'))return productForm();
  if(button.hasAttribute('data-section-shortcut')){section=button.dataset.sectionShortcut;return loadSection();}
  if(button.hasAttribute('data-retry'))return loadSection();
  if(button.hasAttribute('data-back')){if(section==='customers' && !content.dataset.reference)customerId=null;delete content.dataset.reference;return loadSection();}
  try {
    if(button.hasAttribute('data-copy')){await navigator.clipboard.writeText(button.dataset.copy);notifyAdmin('Order reference copied.','success','Copied');const previous=button.textContent;button.textContent='Copied!';setTimeout(()=>{button.textContent=previous;},1800);}
    if(button.hasAttribute('data-sync')){button.disabled=true;const result=await request(`/orders/${encodeURIComponent(button.dataset.sync)}/tracking`,{method:'POST'});if(await openOrder(button.dataset.sync))notifyAdmin(result.linked?'The latest shipment details are shown.':'No matching shipment yet. Use this order reference in Delhivery One.',result.linked?'success':'info',result.linked?'Tracking updated':'Shipment not linked yet');}
  } catch(error){notifyAdmin(error.message,'error','Action failed');}finally{button.disabled=false;}
});
content.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target;
  if(form.id==='adminSearch'){query=form.elements.q.value;orderStatus=form.elements.status?.value||'';currentPage=1;return loadSection();}
  if(form.id!=='productForm')return;
  if(galleryUploading)return;
  form.querySelectorAll('[data-image-url]').forEach(input=>{galleryDraft[Number(input.dataset.imageUrl)]=input.value.trim();});
  const data=Object.fromEntries(new FormData(form));data.is_active=form.elements.is_active.checked;
  data.image_urls=galleryDraft.map(url=>String(url).trim()).filter(Boolean);
  data.image_url=data.image_urls[0]||'';
  if(selectedProduct){data.id=selectedProduct.id;data.admin_revision=selectedProduct.admin_revision;}
  if(Number(data.selling_price)>Number(data.mrp)){notifyAdmin('Selling price cannot exceed MRP.','error','Check the price');return;}
  if(!confirm(data.is_active?'Save these product details?':'Archive this product? It will disappear from sale, but past orders will remain.'))return;
  const button=form.querySelector('[type=submit]');button.disabled=true;
  try {await request('/products',{method:'POST',body:JSON.stringify(data)});if(await loadSection())notifyAdmin(data.is_active?'Product details are now saved.':'This product is no longer available in the store.','success',data.is_active?'Product saved':'Product archived');}
  catch(error){notifyAdmin(error.message,'error','Product not saved');}finally{button.disabled=false;}
});
content.addEventListener('change',async event=>{
  if(event.target.hasAttribute('data-image-url')) {
    const index=Number(event.target.dataset.imageUrl);
    galleryDraft[index]=event.target.value.trim();
    const preview=event.target.closest('.admin-image-row').querySelector('.admin-image-preview');
    preview.replaceChildren();
    if(galleryDraft[index]){
      const image=document.createElement('img');
      image.src=galleryDraft[index];
      image.alt=`Product image ${index+1} preview`;
      preview.append(image);
    } else preview.textContent='Choose a photo';
    return;
  }
  if(event.target.id==='productImageBatch' && !galleryUploading) {
    const files=[...event.target.files];
    if(!files.length)return;
    if(files.length>6-galleryDraft.length){notifyAdmin('Remove existing images or choose fewer files. A product can have up to 6 photos.','error','Too many photos');return;}
    if(files.some(file=>file.size>5242880 || !['image/jpeg','image/png','image/webp'].includes(file.type))){notifyAdmin('Each photo must be a JPEG, PNG or WebP image up to 5 MB.','error','Photo not accepted');return;}
    const form=event.target.closest('#productForm');
    const button=form.querySelector('[type=submit]');galleryUploading=true;button.disabled=true;clearAdminNotice();
    try {
      for(const file of files) {
        statusLine.textContent=`Uploading image ${files.indexOf(file)+1} of ${files.length}…`;
        const result=await request('/images',{method:'POST',headers:{'Content-Type':file.type},body:await file.arrayBuffer()});
        if(document.getElementById('productForm')!==form)return;
        galleryDraft.push(result.url);
        renderImageEditor();
      }
      notifyAdmin('Save the product to publish the uploaded photos.','info','Photos uploaded');
    } catch(error){notifyAdmin(`${error.message} Any uploaded photos are shown below; save the product to keep them.`,'error','Upload interrupted');}
    finally{galleryUploading=false;button.disabled=false;}
    return;
  }
  if(!event.target.hasAttribute('data-image-file') || galleryUploading)return;
  const file=event.target.files[0];if(!file)return;
  if(file.size>5242880 || !['image/jpeg','image/png','image/webp'].includes(file.type)){notifyAdmin('Choose a JPEG, PNG or WebP image up to 5 MB.','error','Photo not accepted');return;}
  const form=event.target.closest('#productForm');
  const index=Number(event.target.dataset.imageFile);
  const button=form.querySelector('[type=submit]');galleryUploading=true;button.disabled=true;clearAdminNotice();statusLine.textContent='Uploading image…';
  try {
    const result=await request('/images',{method:'POST',headers:{'Content-Type':file.type},body:await file.arrayBuffer()});
    if(document.getElementById('productForm')===form){galleryDraft[index]=result.url;renderImageEditor();notifyAdmin('Save the product to publish this photo.','info','Photo uploaded');}
  }
  catch(error){notifyAdmin(error.message,'error','Photo not uploaded');}finally{galleryUploading=false;button.disabled=false;}
});
supabaseClient.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')showGate();});
initialise();
