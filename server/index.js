import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });
const rooms = {};
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({length:4},()=>alphabet[Math.random()*alphabet.length|0]).join('');
const publicRoom = (room) => JSON.parse(JSON.stringify(room));
function publish(room) { io.to(room.roomCode).emit('room-update', publicRoom(room)); }
function makeRoom(code, id, nickname) { return {roomCode:code,hostId:id,gameState:'lobby',balloonSize:0,maxSize:80,players:{[id]:{nickname:nickname.slice(0,16),score:0,isImpostor:false,isHost:true,isAlive:true,joinedAt:Date.now()}},lastPumperId:'',winnerId:'',votes:{},roundNumber:0}; }
function startRound(room) { const ids=Object.keys(room.players), imp=ids[Math.random()*ids.length|0]; for(const [id,p] of Object.entries(room.players)) room.players[id]={...p,isImpostor:id===imp,isAlive:true}; room.gameState='playing';room.balloonSize=0;room.maxSize=60+(Math.random()*51|0);room.lastPumperId='';room.poppedById=null;room.secretPopped=false;room.winnerId='';room.votes={};room.roundNumber=(room.roundNumber||0)+1;room.roundEndsAt=Date.now()+90000;room.voteEndsAt=null; }
function enterVoting(room, poppedById=null, secret=false) { if(room.gameState!=='playing')return;room.gameState='voting';room.poppedById=poppedById;room.secretPopped=secret;room.voteEndsAt=Date.now()+15000;publish(room);setTimeout(()=>{if(room.gameState==='voting'&&Date.now()>=room.voteEndsAt)resolve(room)},15020); }
function pump(room,id) { if(!room||room.gameState!=='playing'||!room.players[id]?.isAlive)return;room.balloonSize++;room.lastPumperId=id;if(room.balloonSize>=room.maxSize){room.players[id].score=(room.players[id].score||0)-50;enterVoting(room,id,false);return;}room.players[id].score=(room.players[id].score||0)+10;publish(room); }
function resolve(room) { if(!room||room.gameState!=='voting')return;const impostor=Object.keys(room.players).find(id=>room.players[id].isImpostor);const counts={};Object.values(room.votes||{}).forEach(id=>counts[id]=(counts[id]||0)+1);const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]);const caught=sorted[0]?.[0]===impostor&&!!impostor;if(caught){room.players[impostor].score=(room.players[impostor].score||0)-50;for(const [id,p] of Object.entries(room.players))if(id!==impostor)p.score=(p.score||0)+25;}else{room.players[impostor].score=(room.players[impostor].score||0)+Object.entries(room.players).reduce((sum,[id,p])=>sum+(id===impostor?0:Math.max(0,p.score||0)),0);}room.gameState='results';room.revealedImpostorId=impostor;room.impostorCaught=!!caught;room.winnerId=Object.entries(room.players).filter(([,p])=>!p.isBot&&p.score>=300).sort((a,b)=>b[1].score-a[1].score)[0]?.[0]||'';publish(room); }
function botLoop(code) { const room=rooms[code];if(!room||room.gameState!=='playing')return;const bots=Object.keys(room.players).filter(id=>room.players[id].isBot);for(const id of bots)pump(room,id);if(room.gameState==='playing')setTimeout(()=>botLoop(code),1000+Math.random()*2000); }
setInterval(()=>{for(const room of Object.values(rooms)){if(room.gameState==='playing'&&Date.now()>=room.roundEndsAt)enterVoting(room,null,false);}},500);
io.on('connection',socket=>{
 socket.on('create-room',({playerId,nickname}={},ack=()=>{})=>{if(!playerId||!nickname)return ack({error:'Nickname required.'});let code=newCode();while(rooms[code])code=newCode();rooms[code]=makeRoom(code,playerId,String(nickname));socket.join(code);ack({roomCode:code,room:publicRoom(rooms[code])});publish(rooms[code]);});
 socket.on('join-room',({roomCode,playerId,nickname}={},ack=()=>{})=>{const code=String(roomCode||'').toUpperCase(),room=rooms[code];if(!room)return ack({error:'Room not found. Check the code.'});if(room.gameState!=='lobby'&&!room.players[playerId])return ack({error:'Round has started. Join the next one.'});if(!room.players[playerId]&&Object.keys(room.players).length>=8)return ack({error:'Room is full (8 players).'});room.players[playerId]??={nickname:String(nickname||'Player').slice(0,16),score:0,isHost:false,isImpostor:false,isAlive:true,joinedAt:Date.now()};socket.join(code);ack({room:publicRoom(room)});publish(room);});
 socket.on('start-game',({roomCode,playerId}={},ack=()=>{})=>{const room=rooms[roomCode];if(!room||room.hostId!==playerId)return ack({error:'Only the host can start.'});if(room.gameState!=='lobby'&&room.gameState!=='results')return ack({error:'Round is already in progress.'});if(Object.values(room.players).filter(p=>!p.isBot).length===1)for(let i=1;i<=3;i++){const id=`bot-${roomCode}-${i}`;room.players[id]??={nickname:['Pip','Bubbles','Poppy'][i-1],score:0,isHost:false,isImpostor:false,isAlive:true,isBot:true,joinedAt:Date.now()+i};}if(Object.keys(room.players).length<3)return ack({error:'Invite at least two friends to start.'});startRound(room);ack({});publish(room);botLoop(roomCode);});
 socket.on('pump',({roomCode,playerId}={})=>pump(rooms[roomCode],playerId));
 socket.on('secret-pop',({roomCode,playerId}={})=>{const room=rooms[roomCode];if(room?.gameState==='playing'&&room.players[playerId]?.isImpostor)enterVoting(room,null,true);});
 socket.on('vote',({roomCode,playerId,targetId}={})=>{const room=rooms[roomCode];if(!room||room.gameState!=='voting'||!room.players[playerId]||room.players[playerId].isBot||!room.players[targetId])return;room.votes[playerId]=targetId;publish(room);if(Object.keys(room.votes).length>=Object.values(room.players).filter(p=>!p.isBot).length)resolve(room);});
 socket.on('next-round',({roomCode,playerId}={},ack=()=>{})=>{const room=rooms[roomCode];if(!room||room.hostId!==playerId)return ack({error:'Only the host can start the next round.'});if(room.winnerId)return ack({error:'The match is over.'});startRound(room);ack({});publish(room);botLoop(roomCode);});
 socket.on('disconnect',()=>{});
});
const dist=path.resolve(__dirname,'../dist');app.use(express.static(dist));app.get('*',(req,res)=>res.sendFile(path.join(dist,'index.html')));
const port=process.env.PORT||3000;server.listen(port,'0.0.0.0',()=>console.log(`BLUFF BALLOON listening on http://localhost:${port}`));
