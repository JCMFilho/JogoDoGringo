const test=require('node:test');
const assert=require('node:assert/strict');
const {createServer}=require('../server.cjs');

test('local server serves the game at home and redirects help to its static directory',async t=>{
  const server=createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const home=await fetch(base+'/');
  assert.equal(home.status,200);assert.match(await home.text(),/id="game"/);
  const redirect=await fetch(base+'/help',{redirect:'manual'});
  assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),'/help/');
  const help=await fetch(base+'/help/');
  assert.equal(help.status,200);assert.match(await help.text(),/Um sobrenome/);
  const style=await fetch(base+'/help/help.css');
  assert.equal(style.status,200);assert.match(style.headers.get('content-type'),/text\/css/);
  assert.equal((await fetch(base+'/missing-page')).status,404);
});
