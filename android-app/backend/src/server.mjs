import http from 'node:http';
import {handleNode} from './handler.mjs';
const server=http.createServer(handleNode);server.requestTimeout=15000;server.headersTimeout=10000;server.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>console.log('Books API listening'));
