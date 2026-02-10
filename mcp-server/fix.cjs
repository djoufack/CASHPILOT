const fs=require("fs");const f=__dirname+"/test-scte.ts";
let c=fs.readFileSync(f,"utf8");const B=String.fromCharCode(33);
c=c.replace(/XNEQX/g,B+"==");c=c.replace(/XBANGX/g,B);
fs.writeFileSync(f,c);console.log("Fixed "+c.length+" bytes");
