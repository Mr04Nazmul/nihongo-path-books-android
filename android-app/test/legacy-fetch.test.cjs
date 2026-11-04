const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('Android 7 fetch compatibility keeps byte-range and no-store request headers',async()=>{
 let sent;class XHR{constructor(){this.headers={};sent=this}open(method,url){this.method=method;this.url=url}setRequestHeader(k,v){this.headers[k]=v}getResponseHeader(k){return k==='Content-Range'?'bytes 0-31/100':null}send(){this.status=206;this.response=new ArrayBuffer(32);this.onload()}}
 const context={Promise,Array,Object,String,TypeError,ArrayBuffer,Uint8Array,TextDecoder,navigator:{userAgent:'Android Chrome/51.0.0.0'},XMLHttpRequest:XHR};context.window=context;
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../reader/compat.js'),'utf8'),context);
 const result=await context.fetch('listening/n5/2012/g1/audio.mp3',{headers:{Range:'bytes=0-31'},cache:'no-store'});
 assert.equal(sent.headers.Range,'bytes=0-31');assert.equal(sent.headers['Cache-Control'],'no-store');assert.equal(result.status,206);assert.equal((await result.arrayBuffer()).byteLength,32);assert.equal(result.headers.get('Content-Range'),'bytes 0-31/100');
});
