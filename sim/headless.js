"use strict";
// Headless port of the three-sided football sim + experimental mechanics.

const CX=450, CY=405, R=340;
const V=[]; for(let k=0;k<6;k++){const a=(-90+60*k)*Math.PI/180; V.push({x:CX+R*Math.cos(a), y:CY+R*Math.sin(a)});}
const EDGES=[];
for(let k=0;k<6;k++){
  const p1=V[k], p2=V[(k+1)%6];
  const mx=(p1.x+p2.x)/2, my=(p1.y+p2.y)/2;
  const len=Math.hypot(p2.x-p1.x,p2.y-p1.y);
  const ux=(p2.x-p1.x)/len, uy=(p2.y-p1.y)/len;
  let nx=CX-mx, ny=CY-my; const nl=Math.hypot(nx,ny); nx/=nl; ny/=nl;
  EDGES.push({p1,p2,mx,my,len,ux,uy,nx,ny,goal:(k%2===0)});
}
const GOAL_EDGE=[0,2,4], GOAL_HALF=0.21;
const goalCenter=t=>{const e=EDGES[GOAL_EDGE[t]];return {x:e.mx,y:e.my};};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

function formation(t){
  const g=goalCenter(t), e=EDGES[GOAL_EDGE[t]];
  const ax=(CX-g.x), ay=(CY-g.y); const al=Math.hypot(ax,ay);
  const fx=ax/al, fy=ay/al, px=e.ux, py=e.uy;
  return [
    {role:"K", x:g.x+fx*16,       y:g.y+fy*16},
    {role:"D", x:g.x+fx*80+px*70, y:g.y+fy*80+py*70},
    {role:"D", x:g.x+fx*80-px*70, y:g.y+fy*80-py*70},
    {role:"M", x:g.x+fx*170+px*40,y:g.y+fy*170+py*40},
    {role:"F", x:g.x+fx*250-px*30,y:g.y+fy*250-py*30},
  ];
}

class Match {
  constructor(opts){
    this.opts=opts; // {fatigue:bool, momentum:bool, minutes:number}
    this.players=[]; this.score=[0,0,0]; this.conceded=[0,0,0];
    this.clock=0; this.retarget=0;
    this.boostUntil=[0,0,0];
    for(let t=0;t<3;t++) formation(t).forEach(f=>this.players.push(
      {team:t,role:f.role,x:f.x,y:f.y,vx:0,vy:0,stamina:1}));
    this.ball={x:CX,y:CY,vx:0,vy:0,owner:null,lastTouch:null,noClaim:null,noClaimF:0};
    this.computeTargets();
    this.kickoff(Math.floor(Math.random()*3));
    // metrics
    this.goals=[]; // {t, scorer, conceder, own}
    this.leadChanges=0; this.lastLeader=null;
    this.pincerSteps=0; this.steps=0;
    this.possessSteps=[0,0,0];
    this.lastGoalTime=0; this.maxDrought=0;
    this.leaderAt5=null; this.lastAt5=null;
    this.targetOfLast=[0,0]; // [stepsTargetingLeader, stepsTargetingSecond] for last-place team
  }
  speedMult(p){
    let m=1;
    if(this.opts.fatigue) m*= 0.55+0.45*p.stamina;
    if(this.opts.momentum && this.clock<this.boostUntil[p.team]) m*=1.15;
    return m;
  }
  kickoff(toTeam){
    let i=0;
    for(let t=0;t<3;t++) formation(t).forEach(f=>{
      const p=this.players[i++]; p.x=f.x;p.y=f.y;p.vx=0;p.vy=0;});
    const b=this.ball;
    b.x=CX;b.y=CY;b.vx=0;b.vy=0;b.owner=null;b.noClaim=null;
    const fwd=this.players.find(p=>p.team===toTeam&&p.role==="F");
    fwd.x=CX-8;fwd.y=CY;b.owner=fwd;b.lastTouch=toTeam;
  }
  computeTargets(){
    this.targets=[];
    const pols=this.opts.policies||["leader","leader","leader"];
    for(let t=0;t<3;t++){
      const others=[0,1,2].filter(o=>o!==t);
      const byScore=[...others].sort((a,b)=>(this.score[b]-this.score[a])||(this.conceded[a]-this.conceded[b]));
      const pol=pols[t];
      if(pol==="leader"){
        this.targets[t]=byScore[0];
      } else if(pol==="rival"){
        // hunt the catchable team: lowest-scoring opponent that is >= me; if I'm on top, hunt 2nd place
        const above=others.filter(o=>this.score[o]>=this.score[t])
          .sort((a,b)=>this.score[a]-this.score[b]);
        this.targets[t]=above.length?above[0]:byScore[0];
      } else { // "nearest": attack whichever enemy goal is closer to the ball right now
        const d0=dist(this.ball,goalCenter(others[0])), d1=dist(this.ball,goalCenter(others[1]));
        this.targets[t]=d0<d1?others[0]:others[1];
      }
    }
  }
  clampInside(p,margin){
    for(const e of EDGES){
      const d=(p.x-e.p1.x)*e.nx+(p.y-e.p1.y)*e.ny;
      if(d<margin){p.x+=e.nx*(margin-d);p.y+=e.ny*(margin-d);}
    }
  }
  steer(p,tx,ty,maxV){
    maxV*=this.speedMult(p);
    let dx=tx-p.x,dy=ty-p.y;const d=Math.hypot(dx,dy)||1;
    const sp=Math.min(maxV,d*0.15);
    p.vx=p.vx*0.7+(dx/d)*sp*0.9;
    p.vy=p.vy*0.7+(dy/d)*sp*0.9;
    const v=Math.hypot(p.vx,p.vy);
    if(v>maxV){p.vx*=maxV/v;p.vy*=maxV/v;}
  }
  kick(tx,ty,power){
    const b=this.ball,o=b.owner;
    const dx=tx-b.x,dy=ty-b.y,d=Math.hypot(dx,dy)||1;
    b.vx=dx/d*power;b.vy=dy/d*power;
    b.lastTouch=o.team;b.noClaim=o;b.noClaimF=14;b.owner=null;
  }
  think(){
    const b=this.ball,owner=b.owner;
    const oppOf=t=>this.players.filter(p=>p.team!==t);
    const chaser=[];
    for(let t=0;t<3;t++){
      let best=null,bd=1e9;
      this.players.forEach(p=>{if(p.team===t&&p.role!=="K"){const d=dist(p,b);if(d<bd){bd=d;best=p;}}});
      chaser[t]=best;
    }
    this.players.forEach(p=>{
      const own=goalCenter(p.team),tgt=goalCenter(this.targets[p.team]);
      if(p===owner){
        let near=null,nd=1e9;
        oppOf(p.team).forEach(o=>{const d=dist(o,p);if(d<nd){nd=d;near=o;}});
        let dx=tgt.x-p.x,dy=tgt.y-p.y;let dl=Math.hypot(dx,dy)||1;dx/=dl;dy/=dl;
        if(near&&nd<60){dx+=(p.x-near.x)/nd*0.9;dy+=(p.y-near.y)/nd*0.9;}
        this.steer(p,p.x+dx*80,p.y+dy*80,2.05);
      } else if(p.role==="K"){
        const e=EDGES[GOAL_EDGE[p.team]];
        let along=(b.x-e.mx)*e.ux+(b.y-e.my)*e.uy;
        const lim=e.len*GOAL_HALF*0.9;along=Math.max(-lim,Math.min(lim,along));
        this.steer(p,e.mx+e.ux*along+e.nx*20,e.my+e.uy*along+e.ny*20,1.9);
        if(dist(p,b)<55&&(!owner||owner.team!==p.team)) this.steer(p,b.x,b.y,2.3);
      } else if(p===chaser[p.team]&&(!owner||owner.team!==p.team)){
        this.steer(p,b.x+b.vx*6,b.y+b.vy*6,2.35);
      } else if(p.role==="D"){
        const ds=this.players.filter(q=>q.team===p.team&&q.role==="D");
        const idx=ds.indexOf(p),f=idx===0?0.38:0.62;
        const bx=own.x+(b.x-own.x)*f,by=own.y+(b.y-own.y)*f;
        const e=EDGES[GOAL_EDGE[p.team]];
        this.steer(p,bx+e.ux*(idx===0?26:-26),by+e.uy*(idx===0?26:-26),2.0);
      } else {
        const f=p.role==="M"?0.45:0.72;
        let sx=b.x+(tgt.x-b.x)*f,sy=b.y+(tgt.y-b.y)*f;
        const side=(p.role==="M"?1:-1);
        const ang=Math.atan2(tgt.y-b.y,tgt.x-b.x)+Math.PI/2;
        sx+=Math.cos(ang)*55*side;sy+=Math.sin(ang)*55*side;
        this.steer(p,sx,sy,2.0);
      }
    });
    // separation
    const P=this.players;
    for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){
      const a=P[i],bb=P[j],d=dist(a,bb);
      if(d<26&&d>0.01){const push=(26-d)/26*0.6,dx=(a.x-bb.x)/d,dy=(a.y-bb.y)/d;
        a.vx+=dx*push;a.vy+=dy*push;bb.vx-=dx*push;bb.vy-=dy*push;}
    }
    if(owner){
      if(owner.role==="K"){
        const og=goalCenter(owner.team);
        let best=null,bd=1e9;
        P.forEach(m=>{if(m.team===owner.team&&(m.role==="M"||m.role==="F")){
          const d=dist(m,owner);if(d<bd){bd=d;best=m;}}});
        if(best){
          let tx=best.x+best.vx*10, ty=best.y+best.vy*10;
          // never clear toward our own goal: if aim point is goal-side of the keeper, punt to center
          if(Math.hypot(tx-og.x,ty-og.y)<dist(owner,og)+30){tx=CX;ty=CY;}
          this.kick(tx,ty,Math.min(9,bd*0.05+4));
        } else this.kick(CX,CY,8);
        return;
      }
      const tgt=goalCenter(this.targets[owner.team]);
      const e=EDGES[GOAL_EDGE[this.targets[owner.team]]];
      const dGoal=dist(owner,tgt);
      let pressure=1e9;oppOf(owner.team).forEach(o=>pressure=Math.min(pressure,dist(o,owner)));
      if(dGoal<175&&Math.random()<0.025){
        const off=(Math.random()*2-1)*e.len*GOAL_HALF*1.0; // more scatter: some shots miss
        this.kick(tgt.x+e.ux*off,tgt.y+e.uy*off,9.5+Math.random()*1.5);
        return;
      }
      if(pressure<48&&Math.random()<0.10){
        let best=null,bs=-1e9;
        P.forEach(m=>{
          if(m.team!==owner.team||m===owner||m.role==="K")return;
          const d=dist(m,owner);if(d<60||d>270)return;
          const gain=dist(owner,tgt)-dist(m,tgt);
          let laneOk=true;
          oppOf(owner.team).forEach(o=>{
            const t=((o.x-owner.x)*(m.x-owner.x)+(o.y-owner.y)*(m.y-owner.y))/(d*d);
            if(t>0.1&&t<0.9){const lx=owner.x+(m.x-owner.x)*t,ly=owner.y+(m.y-owner.y)*t;
              if(Math.hypot(o.x-lx,o.y-ly)<24)laneOk=false;}
          });
          const s=gain+(laneOk?0:-500)+Math.random()*30;
          if(s>bs){bs=s;best=m;}
        });
        if(best&&bs>-100){this.kick(best.x+best.vx*8,best.y+best.vy*8,Math.min(9,dist(best,owner)*0.045+4));return;}
      }
      oppOf(owner.team).forEach(o=>{
        let tc=0.035;
        if(this.opts.momentum&&this.clock<this.boostUntil[o.team]) tc*=1.3;
        if(this.opts.fatigue) tc*=(0.55+0.45*o.stamina);
        if(dist(o,owner)<15&&Math.random()<tc){b.owner=o;b.lastTouch=o.team;}
      });
    }
  }
  physics(){
    const b=this.ball;
    this.players.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;this.clampInside(p,p.role==="K"?12:14);
      if(this.opts.fatigue){
        const v=Math.hypot(p.vx,p.vy);
        const effort=v/2.35;
        p.stamina-= effort*effort*0.0012;      // full sprint: ~ -0.072/s
        p.stamina+= 0.0004;                    // baseline recovery ~ +0.024/s
        p.stamina=Math.max(0,Math.min(1,p.stamina));
      }
    });
    if(b.owner){
      const o=b.owner,v=Math.hypot(o.vx,o.vy)||1;
      b.x=o.x+o.vx/v*13;b.y=o.y+o.vy/v*13;b.vx=o.vx;b.vy=o.vy;
    }else{
      const px0=b.x,py0=b.y;
      b.x+=b.vx;b.y+=b.vy;b.vx*=0.985;b.vy*=0.985;
      if(b.noClaimF>0)b.noClaimF--;else b.noClaim=null;
      let best=null,bd=1e9;
      this.players.forEach(p=>{if(p===b.noClaim&&b.noClaimF>0)return;
        // swept distance: closest approach of p to the segment (px0,py0)->(b.x,b.y)
        const sx=b.x-px0,sy=b.y-py0,sl=sx*sx+sy*sy;
        let t=sl>0?((p.x-px0)*sx+(p.y-py0)*sy)/sl:0;
        t=Math.max(0,Math.min(1,t));
        const d=Math.hypot(p.x-(px0+sx*t),p.y-(py0+sy*t));
        const reach=p.role==="K"?17:13;
        if(d<reach&&d<bd){bd=d;best=p;}});
      if(best){b.owner=best;b.lastTouch=best.team;b.x=best.x;b.y=best.y;}
    }
    for(let k=0;k<6;k++){
      const e=EDGES[k];
      const d=(b.x-e.p1.x)*e.nx+(b.y-e.p1.y)*e.ny;
      if(d<7){
        const along=(b.x-e.mx)*e.ux+(b.y-e.my)*e.uy;
        const inMouth=e.goal&&Math.abs(along)<e.len*GOAL_HALF;
        if(inMouth){
          if(d<-6){this.goalScored(GOAL_EDGE.indexOf(k));return;}
        }else{
          b.x+=e.nx*(7-d);b.y+=e.ny*(7-d);
          const vn=b.vx*e.nx+b.vy*e.ny;
          if(vn<0){b.vx-=2*vn*e.nx*0.82;b.vy-=2*vn*e.ny*0.82;}
        }
      }
    }
  }
  goalScored(conceder){
    const scorer=this.ball.lastTouch;
    const own=(scorer===null||scorer===conceder);
    this.conceded[conceder]++;this.score[conceder]--;
    if(!own)this.score[scorer]++;
    this.goals.push({t:this.clock,scorer:own?null:scorer,conceder,own});
    const drought=this.clock-this.lastGoalTime;
    if(drought>this.maxDrought)this.maxDrought=drought;
    this.lastGoalTime=this.clock;
    if(this.opts.momentum&&!own)this.boostUntil[scorer]=this.clock+20;
    this.computeTargets();
    this.kickoff(conceder);
  }
  leaderIdx(){
    let best=0;
    for(let t=1;t<3;t++)if(this.score[t]>this.score[best]||
      (this.score[t]===this.score[best]&&this.conceded[t]<this.conceded[best]))best=t;
    return best;
  }
  lastIdx(){
    let worst=0;
    for(let t=1;t<3;t++)if(this.score[t]<this.score[worst]||
      (this.score[t]===this.score[worst]&&this.conceded[t]>this.conceded[worst]))worst=t;
    return worst;
  }
  step(){
    const dt=1/60;
    this.clock+=dt;this.retarget+=dt;this.steps++;
    if(this.retarget>6){this.retarget=0;this.computeTargets();}
    this.think();this.physics();
    // metrics (sampled every step)
    if(this.ball.owner)this.possessSteps[this.ball.owner.team]++;
    const L=this.leaderIdx();
    const others=[0,1,2].filter(t=>t!==L);
    if(this.targets[others[0]]===L&&this.targets[others[1]]===L)this.pincerSteps++;
    if(this.lastLeader===null)this.lastLeader=L;
    else if(L!==this.lastLeader&&(this.score[L]!==this.score[this.lastLeader])){
      this.leadChanges++;this.lastLeader=L;
    }
    const last=this.lastIdx();
    if(last!==L){
      if(this.targets[last]===L)this.targetOfLast[0]++;else this.targetOfLast[1]++;
    }
    if(Math.abs(this.clock-300)<dt/2){ // at 5:00
      this.leaderAt5=this.leaderIdx();this.lastAt5=this.lastIdx();
    }
  }
  run(){
    const total=Math.round(this.opts.minutes*60*60);
    for(let i=0;i<total;i++)this.step();
    const finalDrought=this.clock-this.lastGoalTime;
    if(finalDrought>this.maxDrought)this.maxDrought=finalDrought;
    return this.summary();
  }
  summary(){
    const sorted=[...this.score].sort((a,b)=>b-a);
    return {
      goals:this.goals.length,
      ownGoals:this.goals.filter(g=>g.own).length,
      spread:sorted[0]-sorted[2],
      margin:sorted[0]-sorted[1],
      leadChanges:this.leadChanges,
      pincerPct:100*this.pincerSteps/this.steps,
      maxDroughtSec:this.maxDrought,
      possess:this.possessSteps.map(s=>100*s/this.steps),
      firstHalfGoals:this.goals.filter(g=>g.t<this.opts.minutes*30).length,
      secondHalfGoals:this.goals.filter(g=>g.t>=this.opts.minutes*30).length,
      comeback:(this.lastAt5!==null&&this.lastAt5!==this.lastIdx()),
      leaderHeld:(this.leaderAt5!==null&&this.leaderAt5===this.leaderIdx()),
      lastHuntsLeaderPct:100*this.targetOfLast[0]/(this.targetOfLast[0]+this.targetOfLast[1]||1),
      finalScore:[...this.score],
      avgStamina:this.opts.fatigue?this.players.reduce((s,p)=>s+p.stamina,0)/this.players.length:null,
    };
  }
}

function runSuite(name,opts,n){
  const rs=[];
  for(let i=0;i<n;i++)rs.push(new Match(opts).run());
  const avg=k=>rs.reduce((s,r)=>s+r[k],0)/n;
  const pct=k=>100*rs.filter(r=>r[k]).length/n;
  return {
    name,
    matches:n,
    goalsPerMatch:+avg("goals").toFixed(2),
    ownGoalsPerMatch:+avg("ownGoals").toFixed(2),
    spread:+avg("spread").toFixed(2),
    winMargin:+avg("margin").toFixed(2),
    leadChanges:+avg("leadChanges").toFixed(2),
    pincerPct:+avg("pincerPct").toFixed(1),
    maxDrought:+avg("maxDroughtSec").toFixed(1),
    firstHalf:+avg("firstHalfGoals").toFixed(2),
    secondHalf:+avg("secondHalfGoals").toFixed(2),
    comebackPct:+pct("comeback").toFixed(0),
    leaderHeldPct:+pct("leaderHeld").toFixed(0),
    lastHuntsLeader:+avg("lastHuntsLeaderPct").toFixed(1),
    endStamina:opts.fatigue?+avg("avgStamina").toFixed(2):null,
  };
}

const N=25, MIN=10;
const suites=[
  runSuite("baseline",{fatigue:false,momentum:false,minutes:MIN},N),
  runSuite("fatigue",{fatigue:true,momentum:false,minutes:MIN},N),
  runSuite("momentum",{fatigue:false,momentum:true,minutes:MIN},N),
  runSuite("both",{fatigue:true,momentum:true,minutes:MIN},N),
];
console.log(JSON.stringify(suites,null,2));

// ---- Policy tournament: which targeting strategy wins? ----
const POLS=["leader","rival","nearest"];
const wins={leader:0,rival:0,nearest:0};
const pts={leader:[],rival:[],nearest:[]};
const ROT=[[0,1,2],[1,2,0],[2,0,1]]; // rotate policy->team assignment to cancel pitch asymmetry
let games=0;
for(const rot of ROT){
  for(let i=0;i<12;i++){
    const policies=[null,null,null];
    rot.forEach((team,pi)=>policies[team]=POLS[pi]);
    const m=new Match({fatigue:false,momentum:false,minutes:MIN,policies});
    m.run();
    const L=m.leaderIdx();
    wins[policies[L]]++;games++;
    for(let t=0;t<3;t++)pts[policies[t]].push(m.score[t]);
  }
}
const avgP=k=>+(pts[k].reduce((a,b)=>a+b,0)/pts[k].length).toFixed(2);
console.log("POLICY TOURNAMENT", JSON.stringify({
  games,
  winPct:{
    leader:+(100*wins.leader/games).toFixed(1),
    rival:+(100*wins.rival/games).toFixed(1),
    nearest:+(100*wins.nearest/games).toFixed(1)},
  avgPoints:{leader:avgP("leader"),rival:avgP("rival"),nearest:avgP("nearest")}
},null,2));
