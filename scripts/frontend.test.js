const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const root=require('node:path').join(__dirname, '..') + require('node:path').sep;
function environment(file, stored=null) {
 const storage=new Map(stored!==null?[['hiyara_state_v1',stored]]:[]),nodes=new Map(),events={},messages=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',innerText:'',textContent:'',value:'',style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},appendChild(){},querySelector(){return node(id+'-child')},querySelectorAll(){return []},addEventListener(){},scrollIntoView(){}});return nodes.get(id)};
 const context={console,structuredClone,crypto:require('node:crypto').webcrypto,URL,URLSearchParams,TextEncoder,JSON,Date,Math,Number,Array,String,Object,RegExp,encodeURIComponent,decodeURIComponent,escape,unescape,btoa:s=>Buffer.from(s,'binary').toString('base64'),setTimeout:fn=>fn(),clearTimeout(){},alert:m=>messages.push(m),confirm:()=>true,
 localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},
 document:{getElementById:node,querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(n,fn)=>events[n]=fn,createElement:()=>node('created'),body:node('body'),documentElement:node('html')},
 addEventListener(){},location:{href:'',origin:'http://localhost:3001'},fetch:async()=>({ok:true,json:async()=>({success:true,user:{name:'Admin',role:'admin'},customers:[]})})};
 context.window=context;vm.createContext(context);
 vm.runInContext(fs.readFileSync(root+'scripts/state-utils.js','utf8'),context);
 const html=fs.readFileSync(root+file,'utf8');
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))vm.runInContext(m[1],context,{filename:file});
 const run=code=>vm.runInContext(code,context);
 if(file==='index.html')run('initApp()');
 return{context,run,node,storage,messages};
}
let e=environment('index.html');
assert.equal(e.run('state.cart.length'),0);assert.match(e.node('app').innerHTML,/Timeless Elegance/);console.log('PASS: storefront initializes with empty cart');
e.run("state.bestSellers[0].price='₹100.50'; state.bestSellers[0].stock=2; cartAPI.addItem(state.bestSellers[0]); cartAPI.addItem(state.bestSellers[0]);");
assert.equal(e.run('cartAPI.getSummary().subtotal'),201);assert.equal(e.run('cartAPI.getSummary().tax'),16.08);assert.equal(e.run('cartAPI.addItem(state.bestSellers[0])'),false);
e.run('cartAPI.updateQty(0,3)');assert.equal(e.run('state.cart[0].quantity'),2);console.log('PASS: quantities, decimal prices, and stock limits');
e.run("cartAPI.applyPromo('discount10')");assert.equal(e.run('cartAPI.getSummary().total'),196.98);
e.run('proceedToCheckout()');assert.equal(e.node('checkoutTotal').innerText,'₹196.98');console.log('PASS: promo and checkout totals match');
e.node('checkoutName').value='Test Customer';e.node('checkoutAddress').value='123 Test Street';e.node('checkoutPayment').value='Cash on Delivery';e.run('handlePlaceOrder({preventDefault(){}})');assert.equal(e.run('state.cart.length'),0);assert.equal(e.run('state.orders.length'),1);assert.equal(e.run('state.orders[0].paymentStatus'),'Unpaid');assert.equal(e.run('state.bestSellers[0].stock'),0);
e=environment('index.html',e.storage.get('hiyara_state_v1'));assert.equal(e.run('state.cart.length'),0);console.log('PASS: preview order, inventory, and empty cart persist after reload');
for(const value of ['{','null','[]','42',JSON.stringify({cart:[{id:1,price:10}],orders:[]})]){const t=environment('index.html',value);assert.match(t.node('app').innerHTML,/Timeless/)}console.log('PASS: corrupt storage and legacy cart migration');
e=environment('index.html');e.run("state.bestSellers[0].name='<img src=x onerror=alert(1)>';initApp()");assert.match(e.node('app').innerHTML,/&lt;img/);console.log('PASS: product text escaped');
e=environment('admin.html');assert.equal(e.run('state.orders.length'),0);e.run("state.collections=[{name:'A'},{name:'B'}];deleteItem('collection',0)");assert.equal(e.run('state.collections[0].name'),'B');console.log('PASS: admin empty orders and collection delete action');
for(const value of ['{','null','[]',JSON.stringify({orders:[]})]) environment('admin.html',value);
console.log('PASS: admin initializes with damaged or partial storage');
