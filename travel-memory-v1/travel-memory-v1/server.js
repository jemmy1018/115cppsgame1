const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const QRCode=require('qrcode');
const crypto=require('crypto');
const path=require('path');
const app=express(),server=http.createServer(app),io=new Server(server,{cors:{origin:false}});
app.use(express.static(path.join(__dirname,'public')));
app.get('/health',(req,res)=>res.json({ok:true}));
const groups=[
{name:'海灘',emoji:'🏖️',items:[['遮陽傘','⛱️'],['太陽眼鏡','🕶️'],['貝殼','🐚'],['泳圈','🛟'],['沙灘球','🏐'],['拖鞋','🩴'],['帆船','⛵']]},
{name:'露營',emoji:'🏕️',items:[['帳篷','⛺'],['手電筒','🔦'],['背包','🎒'],['營火','🔥'],['指南針','🧭'],['睡袋','🛌'],['水壺','🥤']]},
{name:'運動',emoji:'🚴',items:[['腳踏車','🚲'],['足球','⚽'],['羽毛球','🏸'],['籃球','🏀'],['滑板','🛹'],['網球','🎾'],['直排輪','🛼']]},
{name:'交通',emoji:'🚆',items:[['火車','🚆'],['飛機','✈️'],['公車','🚌'],['汽車','🚗'],['輪船','🚢'],['機車','🛵'],['直升機','🚁']]},
{name:'雪地',emoji:'⛷️',items:[['滑雪板','🎿'],['手套','🧤'],['圍巾','🧣'],['雪人','☃️'],['雪橇','🛷'],['毛帽','🧢'],['雪靴','🥾']]},
{name:'景點',emoji:'🏰',items:[['燈塔','🗼'],['城堡','🏰'],['教堂','⛪'],['噴泉','⛲'],['摩天輪','🎡'],['博物館','🏛️'],['橋梁','🌉']]},
{name:'行李',emoji:'🧳',items:[['行李箱','🧳'],['相機','📷'],['護照','📕'],['地圖','🗺️'],['牙刷','🪥'],['雨傘','☂️'],['耳機','🎧']]}
];
const rooms=new Map();
function code(){let s;do{s=String(Math.floor(100000+Math.random()*900000))}while(rooms.has(s));return s}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
function publicState(r){return {code:r.code,phase:r.phase,mode:r.mode,round:r.round,total:r.total,seconds:r.seconds,endsAt:r.endsAt,board:r.board,question:['question','result'].includes(r.phase)?r.question:null,answer:r.phase==='result'?r.answer:null,stats:r.phase==='result'?stats(r):null,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,team:p.team,score:p.score,connected:p.connected,answered:r.answers.has(p.id)})),teams:r.teams,hostOnline:!!r.hostId}}
function stats(r){const counts=[0,0,0,0];for(const a of r.answers.values())counts[a]++;return {counts,answered:r.answers.size,total:r.players.size}}
function emit(r){io.to(r.code).emit('state',publicState(r))}
function err(socket,message){socket.emit('errorMessage',message)}
function hostRoom(socket){const r=rooms.get(socket.data.room);if(!r||socket.id!==r.hostId)return null;return r}
function questionFor(r){const mode=r.mode==='mixed'?['memory','identify','missing','final'][(r.round-1)%4]:r.mode;
 const selected=shuffle(groups.flatMap((g,gi)=>g.items.map(([name,emoji],ii)=>({name,emoji,group:gi,id:`${gi}-${ii}`}))));
 let board=[],prompt='',correct='',choices=[],focus=null;
 if(mode==='memory'){
 const target=selected[0];board=selected.slice(0,7);prompt=`剛剛「${groups[target.group].name}」主題出現哪一件物品？`;correct=target.name;focus=target.id;
 choices=shuffle([correct,...shuffle(groups.filter((g,i)=>i!==target.group).flatMap(g=>g.items.map(x=>x[0]))).slice(0,3)]);
 }else if(mode==='identify'){
 const target=selected[0];board=[target];prompt=`這件神祕旅行物品叫什麼名稱？`;correct=target.name;focus=target.id;choices=shuffle([correct,...selected.slice(1).filter(x=>x.name!==correct).slice(0,3).map(x=>x.name)]);
 }else if(mode==='missing'){
 board=selected.slice(0,7);const target=board[crypto.randomInt(board.length)];focus=target.id;correct=target.name;prompt='剛剛消失的是哪一件旅行物品？';choices=shuffle([correct,...shuffle(board.filter(x=>x.id!==target.id)).slice(0,3).map(x=>x.name)]);
 }else{
 board=selected.slice(0,7);const target=board[crypto.randomInt(board.length)];focus=target.id;correct=String(board.findIndex(x=>x.id===target.id)+1);prompt=`「${target.name}」剛剛在第幾個位置？（從左到右）`;choices=shuffle([correct,...shuffle(['1','2','3','4','5','6','7'].filter(x=>x!==correct)).slice(0,3)]);
 }
 r.current={mode,board,prompt,choices,correct,focus};r.board=board;r.question=null;r.answer=null;r.answers.clear();r.phase='memorize';r.endsAt=null;
}
function reveal(r){if(r.phase!=='question')return;r.phase='result';r.endsAt=null;const idx=r.current.choices.indexOf(r.current.correct);r.answer={correctIndex:idx,correct:r.current.correct,focus:r.current.focus};for(const [id,a] of r.answers){if(a===idx){const p=r.players.get(id);if(p)p.score+=100}}emit(r)}
function beginQuestion(r){if(r.phase!=='memorize')return;r.phase='question';r.board=r.current.mode==='missing'?r.current.board.filter(x=>x.id!==r.current.focus):[];r.question={mode:r.current.mode,prompt:r.current.prompt,choices:r.current.choices,emoji:r.current.mode==='identify'?r.current.board[0].emoji:null};r.endsAt=Date.now()+r.seconds*1000;emit(r);clearTimeout(r.timer);r.timer=setTimeout(()=>reveal(r),r.seconds*1000+200)}
function next(r){if(r.round>=r.total){r.phase='finished';r.board=[];r.question=null;emit(r);return}r.round++;questionFor(r);emit(r)}
function findPlayer(r,token){return [...r.players.values()].find(p=>p.token===token)}
io.on('connection',socket=>{
 socket.on('create',({total=10,seconds=20,mode='mixed',teams=4}={},cb)=>{const c=code(),token=crypto.randomBytes(24).toString('hex');const r={code:c,hostToken:token,hostId:socket.id,phase:'lobby',mode:['mixed','memory','identify','missing','final'].includes(mode)?mode:'mixed',round:0,total:Math.max(1,Math.min(40,Number(total)||10)),seconds:Math.max(5,Math.min(90,Number(seconds)||20)),teams:Math.max(1,Math.min(10,Number(teams)||4)),players:new Map(),answers:new Map(),board:[],question:null,answer:null,endsAt:null,timer:null,created:Date.now()};rooms.set(c,r);socket.join(c);socket.data.room=c;cb?.({ok:true,code:c,token});setImmediate(()=>emit(r))});
 socket.on('hostJoin',({code:c,token},cb)=>{const r=rooms.get(String(c));if(!r||r.hostToken!==token)return cb?.({ok:false,error:'房間或主持憑證無效'});if(r.hostId&&r.hostId!==socket.id)io.to(r.hostId).emit('replaced');r.hostId=socket.id;socket.join(c);socket.data.room=c;cb?.({ok:true});setImmediate(()=>emit(r))});
 socket.on('join',({code:c,name,token},cb)=>{const r=rooms.get(String(c));if(!r)return cb?.({ok:false,error:'找不到房間，請確認代碼'});if(r.phase==='finished')return cb?.({ok:false,error:'遊戲已結束'});let p=token&&findPlayer(r,token);if(!p){if(r.phase!=='lobby')return cb?.({ok:false,error:'遊戲已開始，請老師重設後加入'});name=String(name||'').trim().slice(0,18);if(!name)return cb?.({ok:false,error:'請輸入姓名或座號'});if([...r.players.values()].some(x=>x.name===name))return cb?.({ok:false,error:'這個名稱已有人使用'});const id=crypto.randomUUID();p={id,name,token:crypto.randomBytes(24).toString('hex'),team:(r.players.size%r.teams)+1,score:0,connected:true};r.players.set(id,p)}p.connected=true;socket.join(c);socket.data.room=c;socket.data.playerId=p.id;cb?.({ok:true,token:p.token,id:p.id,team:p.team});setImmediate(()=>emit(r))});
 socket.on('hostAction',({action},cb)=>{const r=hostRoom(socket);if(!r)return cb?.({ok:false,error:'沒有主持權限'});if(action==='start'&&r.phase==='lobby'){if(!r.players.size)return cb?.({ok:false,error:'請先讓學生加入'});r.round=0;for(const p of r.players.values())p.score=0;next(r)}else if(action==='question')beginQuestion(r);else if(action==='reveal')reveal(r);else if(action==='next'&&r.phase==='result')next(r);else if(action==='reset'){clearTimeout(r.timer);r.phase='lobby';r.round=0;r.answers.clear();r.board=[];r.question=null;r.answer=null;r.endsAt=null;for(const p of r.players.values())p.score=0;emit(r)}else return cb?.({ok:false,error:'目前無法執行這項操作'});cb?.({ok:true})});
 socket.on('answer',({index},cb)=>{const r=rooms.get(socket.data.room),p=r?.players.get(socket.data.playerId);if(!r||!p||r.phase!=='question'||r.answers.has(p.id)||Date.now()>r.endsAt||!Number.isInteger(index)||index<0||index>3)return cb?.({ok:false,error:'無法送出答案'});r.answers.set(p.id,index);cb?.({ok:true});emit(r);if(r.answers.size===r.players.size){clearTimeout(r.timer);r.timer=setTimeout(()=>reveal(r),900)}});
 socket.on('disconnect',()=>{const r=rooms.get(socket.data.room);if(!r)return;if(r.hostId===socket.id)r.hostId=null;const p=r.players.get(socket.data.playerId);if(p)p.connected=false;emit(r)})
});
app.get('/qr/:code',async(req,res)=>{const r=rooms.get(req.params.code);if(!r)return res.sendStatus(404);const base=process.env.PUBLIC_URL||`${req.protocol}://${req.get('host')}`;res.type('png').send(await QRCode.toBuffer(`${base}/?room=${r.code}`,{width:300,margin:2}))});
setInterval(()=>{for(const [c,r] of rooms){if(Date.now()-r.created>12*3600*1000){clearTimeout(r.timer);rooms.delete(c)}}},3600000).unref();
server.listen(process.env.PORT||3000,()=>console.log('Travel Memory listening'));
