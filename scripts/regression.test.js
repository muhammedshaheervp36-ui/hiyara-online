const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hiyara-test-'));
process.env.HIYARA_DATA_DIR = temp;
const Store = require('../database/store');
const { hashPassword } = require('../services/passwordService');
const Sessions = require('../services/sessionService');
const server = require('../server');
let base, cookie;
const testPassword = require('node:crypto').randomBytes(24).toString('hex');
before(async () => {
 Store.saveUser({id:'test-admin', name:'Test Admin', email:'admin@example.com', role:'admin', passwordHash:hashPassword(testPassword)});
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 base = `http://127.0.0.1:${server.address().port}`;
 const response = await fetch(base + '/api/admin/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:'admin@example.com',password:testPassword})});
 assert.equal(response.status,200);
 cookie=response.headers.get('set-cookie').split(';')[0];
});
after(async () => { await new Promise(resolve => server.close(resolve)); fs.rmSync(temp,{recursive:true,force:true}); });
const request = (url, method='GET', payload, headers={}) => fetch(base+url,{method, headers:{cookie,'Content-Type':'application/json',...headers}, ...(payload !== undefined ? {body:JSON.stringify(payload)} : {})});

test('private data, source, and debug pages are not served',async()=> {
 for (const route of ['/data/users.json','/data/sessions.json','/data/customers.json','/server.js','/database/store.js','/test.html','/scripts/test-admin-auth.js','/package.json','/scripts/../data/users.json']) assert.equal((await request(route)).status,404,route);
});
test('hard-coded token bypass is removed and admin route alias works',async()=> {
 assert.equal((await request('/api/admin/customers','GET',undefined,{cookie:'',Authorization:'Bearer admin-secret-token','X-Admin-Role':'admin'})).status,401);
 assert.equal((await fetch(base+'/admin',{redirect:'manual'})).status,302);
 assert.equal((await request('/admin')).status,200);
});
test('malformed URL and cookies do not crash the server',async()=> {
 assert.equal((await request('/api/admin/customers/%ZZ')).status,400);
 assert.equal((await request('/api/admin/me','GET',undefined,{cookie:'admin_session=%ZZ'})).status,401);
 assert.equal((await request('/')).status,200);
});
test('invalid request JSON returns 400, large body returns 413',async()=> {
 for(const body of ['{','null','[]','42']) {
  assert.equal((await fetch(base+'/api/admin/login',{method:'POST',body})).status,400);
 }
 assert.equal((await request('/api/admin/login','POST',{email:99,password:44})).status,400);
 assert.equal((await fetch(base+'/api/admin/login',{method:'POST',body:'x'.repeat(1000001)})).status,413);
});
test('customer CRUD, validation, duplicate email, and retained order count',async()=> {
 const payload={name:"O'Neil & Co",email:'customer@example.com',phone:'+91 9876543210',address:'12 Main Street',totalOrders:7,totalSpent:123.45};
 let response=await request('/api/admin/customers','POST',payload); assert.equal(response.status,201);
 const customer=(await response.json()).customer; assert.equal(customer.name,payload.name);
 assert.equal((await request('/api/admin/customers','POST',payload)).status,409);
 const {totalOrders,...edit}=payload;
 response=await request('/api/admin/customers/'+customer.id,'PUT',edit); assert.equal(response.status,200); assert.equal((await response.json()).customer.totalOrders,7);
 for(const extra of [{status:1},{totalOrders:1.5},{totalSpent:'Infinity'},{phone:'-------'}]) assert.equal((await request('/api/admin/customers/'+customer.id,'PUT',{...edit,...extra})).status,400);
 assert.equal((await request('/api/admin/customers/'+customer.id,'DELETE')).status,200);
 assert.equal((await request('/api/admin/customers/'+customer.id,'DELETE')).status,404);
});
test('revoked admin roles cannot continue using an old session',async()=> {
 Store.saveUser({id:'revoked',name:'Revoked',email:'revoked@example.com',role:'admin',passwordHash:hashPassword(testPassword)});
 const token=Sessions.createSession(Store.getUserById('revoked')).token;
 Store.saveUser({...Store.getUserById('revoked'),role:'staff'});
 assert.equal((await request('/api/admin/customers','GET',undefined,{cookie:'admin_session='+token})).status,403);
});
test('logout invalidates the session',async()=> {
 assert.equal((await request('/api/admin/logout','POST',{})).status,200);
 assert.equal((await request('/api/admin/me')).status,401);
});
