import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'
const require = createRequire('C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')
const { chromium } = require('playwright')
const browser = await chromium.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true })
const context = await browser.newContext({ viewport:{width:1440,height:900} })
const base='http://127.0.0.1:5173', output='H:/AITrading/specs/DELIVERY-A/test-evidence'
await mkdir(output,{recursive:true})
const results=[]
async function account(ctx, suffix) {
 const email=`library-${Date.now()}-${suffix}@example.test`,password=`Synthetic!${randomBytes(18).toString('hex')}`
 let token=await (await ctx.request.get(`${base}/api/auth/csrf`)).json()
 const reg=await ctx.request.post(`${base}/api/auth/register`,{headers:{'X-CSRF-TOKEN':token.token,Origin:base},data:{email,password,displayName:'Library QA'}})
 assert.equal(reg.status(),202,`register: ${reg.status()}`)
 token=await (await ctx.request.get(`${base}/api/auth/csrf`)).json()
 const login=await ctx.request.post(`${base}/api/auth/login`,{headers:{'X-CSRF-TOKEN':token.token,Origin:base},form:{email,password}})
 assert.equal(login.status(),204)
 return (await (await ctx.request.get(`${base}/api/auth/me`)).json()).id
}
const owner=await account(context,'a'),page=await context.newPage()
page.setDefaultTimeout(15000)
const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message))
async function library() {
 await page.goto(base)
 const mode=await page.locator('[data-layout]').getAttribute('data-layout')
 if(mode==='desktop') {await page.getByRole('button',{name:'Open Quant navigation',exact:true}).click();await page.getByRole('button',{name:'Library',exact:true}).click()}
 else if(mode==='tablet') {await page.getByRole('button',{name:'Workspace',exact:true}).click();await page.getByRole('button',{name:'Library & Documents',exact:true}).click()}
 else {await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.getByRole('button',{name:'Library',exact:true}).click()}
 await page.getByRole('heading',{name:'Library',exact:true}).waitFor()
}
async function capture(name) {
 const metrics=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,panes:getComputedStyle(document.querySelector('.research-panes')).gridTemplateColumns,dialog:!!document.querySelector('dialog[open]')}))
 assert.ok(metrics.documentWidth<=metrics.width&&metrics.bodyWidth<=metrics.width,JSON.stringify(metrics))
 await page.screenshot({path:`${output}/${name}.png`});results.push({name,...metrics})
}
try {
 await library();await page.getByText(/No private documents yet/).waitFor();await capture('empty-1440')
 await page.getByRole('button',{name:'+ Upload',exact:true}).click()
 await page.getByLabel('Document title',{exact:true}).fill('Breakout research')
 await page.getByLabel('Document file',{exact:true}).setInputFiles({name:'breakout.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic research: Confirm breakout only after candle close above resistance. Risk must be explicitly bounded. <script>inert</script>')})
 await page.getByRole('button',{name:'Upload document',exact:true}).click()
 await page.getByLabel('Document preview',{exact:true}).getByText(/Synthetic research/).waitFor()
 assert.equal(await page.locator('.research-preview script').count(),0)
 await capture('library-1440')
 await page.getByLabel('Research scope').selectOption('selected')
 await page.getByLabel('Document question').fill('What confirms a breakout?')
 await page.getByRole('button',{name:'Retrieve and answer'}).click()
 await page.getByRole('button',{name:'Retrieve and answer'}).waitFor({state:'visible',timeout:45000})
 const ragText=await page.locator('.research-ask').innerText()
 results.push({name:'selected-rag',answer:ragText.includes('Private-source research answer'),providerFailure:ragText.includes('RAG request failed')})
 await capture('selected-rag-1440')
 await page.getByLabel('Research scope').selectOption('all');await page.getByLabel('Document question').fill('zzzznomatchevidence')
 await page.getByRole('button',{name:'Retrieve and answer'}).click();await page.getByText('No matching sources.',{exact:true}).waitFor();results.push({name:'global-insufficient',pass:true})
 await page.getByRole('button',{name:'Upload new version'}).click()
 await page.getByLabel('Document file',{exact:true}).setInputFiles({name:'breakout-v2.txt',mimeType:'text/plain',buffer:Buffer.from('Version two: Confirm breakout and retest after the closed candle; require a documented invalidation price.')})
 await page.getByRole('button',{name:'Upload next version'}).click()
 await page.getByLabel('Preview version').selectOption('1');await page.getByLabel('Document preview').getByText(/Synthetic research/).waitFor()
 await page.getByLabel('Preview version').selectOption('2');await page.getByLabel('Document preview').getByText(/Version two/).waitFor();results.push({name:'immutable-v1-v2',pass:true})
 await page.getByLabel('Search library').fill('breakout-v2.txt');assert.equal(await page.locator('.research-row').count(),1)
 await page.getByLabel('Search library').fill('unknown');assert.equal(await page.locator('.research-row').count(),0)
 await page.getByLabel('Search library').fill('');await capture('versions-1440')
 // A minimal valid one-page PDF with a built-in Helvetica font, synthetic only.
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];const stream='BT /F1 12 Tf 50 700 Td (Synthetic PDF: volatility research evidence.) Tj ET';objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
 let pdf='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`}const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
 await page.getByRole('button',{name:'+ Upload',exact:true}).click();await page.getByLabel('Document title',{exact:true}).fill('Volatility PDF');await page.getByLabel('Document file',{exact:true}).setInputFiles({name:'volatility.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf)});await page.getByRole('button',{name:'Upload document',exact:true}).click();await page.getByLabel('Document preview').getByText(/Synthetic PDF/).waitFor();results.push({name:'pdf-upload-preview',pass:true})
 for(const width of [1024,390]) {
  await page.setViewportSize({width,height:900});await library();await page.getByRole('button',{name:/PDF Volatility PDF/}).click();await page.getByRole('dialog',{name:'Research source details'}).waitFor();await capture(`detail-${width}`)
  await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0)
  assert.ok(await page.getByRole('button',{name:/PDF Volatility PDF/}).evaluate(el=>el===document.activeElement))
  await page.getByRole('button',{name:'+ Upload',exact:true}).click();await capture(`upload-${width}`)
  for(let n=0;n<9;n++){await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>!!document.activeElement.closest('dialog[open]')))}
  await page.keyboard.press('Escape');assert.ok(await page.getByRole('button',{name:'+ Upload',exact:true}).evaluate(el=>el===document.activeElement));await capture(`library-${width}`)
 }
 await page.setViewportSize({width:1440,height:900});await library();await page.getByRole('button',{name:/PDF Volatility PDF/}).click();await page.getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('button',{name:'Cancel delete'}).click();assert.equal(await page.getByRole('button',{name:/PDF Volatility PDF/}).count(),1)
 await page.getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('button',{name:'Confirm delete'}).click();await page.getByRole('dialog',{name:'Confirm document deletion'}).waitFor({state:'hidden'});assert.equal(await page.getByRole('button',{name:/PDF Volatility PDF/}).count(),0)
 await page.getByRole('tab',{name:'Images',exact:true}).click();await page.getByText(/No image analyses yet/).waitFor();await capture('images-empty-1440')
 const catalog=await (await context.request.get(`${base}/api/documents/catalog`,{headers:{'X-Workspace-User':owner}})).json();assert.equal(catalog.length,1)
 const foreign=await browser.newContext(),other=await account(foreign,'b')
 const list=await foreign.request.get(`${base}/api/documents/catalog`,{headers:{'X-Workspace-User':other}});assert.deepEqual(await list.json(),[])
 const denied=await foreign.request.get(`${base}/api/documents/${catalog[0].document.id}/versions/1/preview`,{headers:{'X-Workspace-User':other}});assert.equal(denied.status(),404);await foreign.close()
 results.push({name:'delete-reload-owner-isolation',pass:true});assert.deepEqual(pageErrors,[])
} finally {
 await writeFile(`${output}/browser-results.json`,JSON.stringify({results,pageErrors},null,2));await context.close();await browser.close()
}
console.log(JSON.stringify(results,null,2))
