const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const isSummer = (process.env.GITHUB_REF_NAME || '').includes('summer-theme');
const rgb = value => { const a = (value.match(/[0-9]+/g) || []).slice(0, 3).map(Number); assert.equal(a.length, 3, value); return a; };
const lum = value => { const c = rgb(value).map(x => x/255).map(x => x <= 0.04045 ? x/12.92 : ((x+0.055)/1.055)**2.4); return c[0]*0.2126+c[1]*0.7152+c[2]*0.0722; };
const contrast = (fg,bg) => { const [a,b] = [lum(fg),lum(bg)].sort((a,b)=>b-a); return (a+0.05)/(b+0.05); };
async function main() {
  const browser = await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
  const cases = isSummer ? [{name:'summer-light-OSdark',os:'dark',dark:false},{name:'summer-dark-OSlight',os:'light',dark:true}] : [{name:'spring-light-OSdark',os:'dark',dark:false},{name:'spring-light-OSlight',os:'light',dark:false}];
  for(const c of cases) {
    const ctx=await browser.newContext({colorScheme:c.os}); const page=await ctx.newPage();
    await page.setContent('<html class="'+(c.dark?'dark':'')+'"><body><div id="card" class="bg-white dark:bg-gray-900 p-6"><p id="copy">Inherited text</p><p id="explicit" class="text-gray-900 dark:text-gray-100">Explicit text</p><input id="field" class="input-style" value="Test value"/></div></body></html>');
    await page.addStyleTag({path:'/tmp/profsidekick-theme.css'});
    const s=await page.evaluate(() => {const get=sel=>{const c=getComputedStyle(document.querySelector(sel)); return {fg:c.color,bg:c.backgroundColor};}; return {body:get('body'),card:get('#card'),copy:get('#copy'),explicit:get('#explicit'),field:get('#field')};});
    for(const name of ['copy','explicit','field']) {
      const bg = name==='field' ? s.field.bg : s.card.bg;
      const ratio=contrast(s[name].fg,bg); console.log(c.name,name,ratio.toFixed(2)+':1');
      assert(ratio>=4.5,c.name+' '+name+' is below WCAG AA contrast: '+ratio.toFixed(2));
    }
    const bodyContrast=contrast(s.body.fg,s.body.bg);console.log(c.name,'body',bodyContrast.toFixed(2)+':1');assert(bodyContrast>=4.5,'Body contrast too low');
    await page.screenshot({path:'/tmp/'+c.name+'.png'}); await ctx.close();
  }
  await browser.close();
}
main().catch(err=>{console.error(err);process.exit(1);});