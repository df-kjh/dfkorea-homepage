import { writeFile } from 'node:fs/promises'
const site = 'https://dfkorealed.com'
const api = 'https://dfkorea-production.up.railway.app'
const cases = [
  ['login',site+'/admin/login',{},200],
  ['dashboard-anonymous',site+'/admin/dashboard',{},302],
  ['bff-session-anonymous',site+'/api/admin/auth/session',{},401],
  ['bff-csrf',site+'/api/admin/auth/logout',{method:'POST',headers:{Origin:'https://untrusted-example.vercel.app','Content-Type':'application/json'},body:'{}'},403],
  ['products',site+'/products',{},200],
  ['about',site+'/about',{},200],
  ['backend-health',api+'/',{},200],
  ['backend-session',api+'/auth/session',{},401],
  ['tenders-anonymous',api+'/tenders',{},401],
  ['quotes-anonymous',api+'/quotes/admin',{},401],
  // Empty payloads cannot create an upload or name an object to delete, even on an old release.
  ['upload-image-anonymous',api+'/upload/image',{method:'POST'},401],
  ['upload-file-anonymous',api+'/upload/file',{method:'POST'},401],
  ['upload-delete-anonymous',api+'/upload/image',{method:'DELETE',headers:{'Content-Type':'application/json'},body:'{}'},401],
  ['cors-hostile',api+'/products',{headers:{Origin:'https://untrusted-example.vercel.app'}},200],
  ['cors-legitimate',api+'/products',{headers:{Origin:site}},200],
]
const results=[]
for (const [name,url,options,expected] of cases) {
 try {
  const response=await fetch(url,{...options,redirect:'manual',signal:AbortSignal.timeout(25000)})
  const body=await response.text()
  const headers=Object.fromEntries(['cache-control','x-robots-tag','x-content-type-options','x-frame-options','content-security-policy','strict-transport-security','referrer-policy','access-control-allow-origin','location'].map(key=>[key,response.headers.get(key)]))
  const passed=response.status===expected && (name!=='cors-hostile'||!headers['access-control-allow-origin']) && (name!=='cors-legitimate'||headers['access-control-allow-origin']===site)
  results.push({name,url,status:response.status,expected,passed,headers,bytes:Buffer.byteLength(body)})
 } catch(error){results.push({name,url,passed:false,error:error.name})}
}
await writeFile(new URL('./production-after.json',import.meta.url),JSON.stringify({checkedAt:new Date().toISOString(),results},null,2)+'\n')
console.log(JSON.stringify(results.map(({name,status,passed})=>({name,status,passed})),null,2))
if(results.some(r=>!r.passed))process.exitCode=1
