// Compile app-owned reader scripts for Android 6's factory WebView.
import {createRequire} from 'node:module';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const babel=require('@babel/core');
let input='';for await(const chunk of process.stdin)input+=chunk;
const result=JSON.parse(input).map(source=>babel.transformSync(source,{babelrc:false,configFile:false,sourceType:'script',presets:[[require.resolve('@babel/preset-env'),{targets:{ie:'11'},modules:false,bugfixes:true}]],comments:false,compact:false}).code);
process.stdout.write(JSON.stringify(result));
