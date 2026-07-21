"use strict";
// Headless port of the CURRENT shipped engine (index.html as of POTM rebalance),
// with three experimental features behind flags:
//   aware   — pincer response, space-scored support positioning, vulture forwards
//   plays   — give-and-go contracts on pressured passes
//   dribble — hybrid touch dribbling: spring-carried ball, touch impulses, spatial dispossession

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
  // opts: {minutes, teamFlags:[{aware,plays},...], dribble:bool}
  constructor(opts){
    this.o=opts;
    this.players=[]; this.score=[0,0,0]; this.conceded=[0,0,0]; this.scored=[0,0,0];
    this.clock=0; this.retarget=0; this.boostUntil=[0,0,0];
    for(let t=0;t<3;t++) formation(t).forEach(f=>this.players.push(
      {team:t,role:f.role,x:f.x,y:f.y,vx:0,vy:0,stamina:1,
       k1:0.64+RNG()*0.10,k2:0.82+RNG()*0.16,hx:1,hy:0}));
    this.ball={x:CX,y:CY,vx:0,vy:0,owner:null,lastTouch:null,lastKicker:null,isShot:false,
      noClaim:null,noClaimF:0,touchT:0,z:0,zv:0};
    this.m2={headers:0,crosses:0,fouls:0,pens:0,penGoals:0};
    this.suppress=null;   // {team, until}: fouling team stands off during the free kick
    this.play=null; // give-and-go contract {passer,receiver,until}
    this.offSeed=[RNG()*9,RNG()*9,RNG()*9];
    this.computeTargets();
    this.kickoff(Math.floor(RNG()*3));
    // metrics
    this.m={goals:0,own:0,shots:0,saves:0,tackles:0,turnovers:0,passOk:0,passTry:0,
      spells:[],curSpell:0,curTeam:null,dispossessSpatial:0};
  }
  tac(t){ return this.o.teamFlags[t].tac||{tempo:.5,risk:.5,line:.5,press:.5,direct:.5,bunker:0}; }
  rating(t){return this.score[t];}
  rankCmp(a,b){return (this.rating(b)-this.rating(a))||(this.scored[b]-this.scored[a]);}
  wasTrailing(t){return [0,1,2].some(o=>o!==t&&this.rankCmp(o,t)<0);}
  computeTargets(){
    this.targets=[];
    for(let t=0;t<3;t++){
      const others=[0,1,2].filter(o=>o!==t);
      others.sort((a,b)=>(this.score[b]-this.score[a])||(this.conceded[a]-this.conceded[b]));
      this.targets[t]=others[0];
    }
  }
  pincered(t){ const o=[0,1,2].filter(x=>x!==t); return this.targets[o[0]]===t&&this.targets[o[1]]===t; }
  offense(t){
    // scheme selection — in the coach simulator this becomes a player choice
    if(!this.o.teamFlags[t].offense)return null;
    const tgt=this.targets[t];
    const bunkered=this.o.teamFlags[tgt].aware&&this.pincered(tgt);
    if(bunkered){
      // alternate bunker-breakers on a slow clock: pull it apart, then hit the far side
      return (Math.floor((this.clock+this.offSeed[t])/9)%2===0)?"overload":"switch";
    }
    return "direct";
  }
  applyOuts(){
    const outs=this.o.outs||[0,0,0];
    for(let t=0;t<3;t++){
      let need=outs[t];
      for(const p of this.players){
        if(need<=0)break;
        if(p.team===t&&(p.role==="D"||p.role==="M")&&!p.out){ p.out=true; need--; }
      }
    }
  }
  kickoff(toTeam){
    let i=0;
    for(let t=0;t<3;t++) formation(t).forEach(f=>{const p=this.players[i++];p.x=f.x;p.y=f.y;p.vx=0;p.vy=0;});
    const b=this.ball;
    b.x=CX;b.y=CY;b.vx=0;b.vy=0;b.owner=null;b.noClaim=null;b.isShot=false;b.touchT=0;
    const fwd=this.players.find(p=>p.team===toTeam&&p.role==="F");
    fwd.x=CX-8;fwd.y=CY;b.owner=fwd;b.lastTouch=toTeam;
    this.play=null;
  }
  stam(p,d){p.stamina=Math.max(0,Math.min(1,p.stamina+d));}
  speedMult(p){
    let m=0.55+0.45*p.stamina;
    if(this.clock<this.boostUntil[p.team])m*=1.15;
    return m;
  }
  clampIn(p,margin){
    for(const e of EDGES){
      const d=(p.x-e.p1.x)*e.nx+(p.y-e.p1.y)*e.ny;
      if(d<margin){p.x+=e.nx*(margin-d);p.y+=e.ny*(margin-d);}
    }
  }
  steer(p,tx,ty,maxV){
    maxV*=this.speedMult(p);
    let dx=tx-p.x,dy=ty-p.y;const d=Math.hypot(dx,dy)||1;
    if(d<8){p.vx*=0.78;p.vy*=0.78;return;}
    const sp=Math.min(maxV,d*0.15);
    p.vx=p.vx*p.k1+(dx/d)*sp*p.k2;
    p.vy=p.vy*p.k1+(dy/d)*sp*p.k2;
    const v=Math.hypot(p.vx,p.vy);
    if(v>maxV){p.vx*=maxV/v;p.vy*=maxV/v;}
  }
  kick(tx,ty,power,isShot){
    const b=this.ball,o=b.owner;
    b.ev=isShot?"shot":"pass";
    if(this.o.disc&&!isShot){
      for(const e of EDGES){                       // clamp the aim point inside the lines
        const d=(tx-e.p1.x)*e.nx+(ty-e.p1.y)*e.ny;
        if(d<26){tx+=e.nx*(26-d);ty+=e.ny*(26-d);}
      }
      let dxn=tx-b.x,dyn=ty-b.y;const dl=Math.hypot(dxn,dyn)||1;dxn/=dl;dyn/=dl;
      let ahead=1e9;                                // cap power by room along the pass
      for(const e of EDGES){
        const den=-(dxn*e.nx+dyn*e.ny);
        if(den>0.05){const db=(b.x-e.p1.x)*e.nx+(b.y-e.p1.y)*e.ny;
          ahead=Math.min(ahead,(db-8)/den);}
      }
      power=Math.min(power,4+ahead*0.035);
    }
    const dx=tx-b.x,dy=ty-b.y,d=Math.hypot(dx,dy)||1;
    b.vx=dx/d*power;b.vy=dy/d*power;
    b.lastTouch=o.team;b.lastKicker=o;b.isShot=!!isShot;
    b.noClaim=o;b.noClaimF=14;b.owner=null;
    b.z=0;b.zv=0;
    if(this.o.aerial&&!isShot&&d>235){ b.zv=3.0; this.m2.crosses++; }
    if(isShot)this.m.shots++;
  }
  wallDist(p){
    let wd=1e9,we=null;
    for(const e of EDGES){const d=(p.x-e.p1.x)*e.nx+(p.y-e.p1.y)*e.ny;if(d<wd){wd=d;we=e;}}
    return {wd,we};
  }
  spaceScore(t,x,y,tgt){
    // higher = more open + more progressive; used by aware support positioning
    let nearOpp=1e9;
    this.players.forEach(o=>{if(o.team!==t){const d=Math.hypot(o.x-x,o.y-y);if(d<nearOpp)nearOpp=d;}});
    const prog=-Math.hypot(tgt.x-x,tgt.y-y);
    return Math.min(nearOpp,90)+prog*0.25;
  }
  think(dt){
    const b=this.ball,owner=b.owner;
    const P=this.players;
    this.HA=[0,1,2].map(a=>[0,1,2].some(b2=>b2!==a&&this.targets[a]!==null
      &&this.targets[a]===this.targets[b2]&&this.targets[a]!==b2&&this.targets[b2]!==a));
    const oppOf=t=>P.filter(p=>p.team!==t);
    const chaser=[];
    for(let t=0;t<3;t++){
      let best=null,bd=1e9;
      P.forEach(p=>{if(p.team===t&&p.role!=="K"){const d=dist(p,b);if(d<bd){bd=d;best=p;}}});
      chaser[t]=best;
    }
    const F=this.o.teamFlags;
    P.forEach(p=>{
      const own=goalCenter(p.team), tgt=goalCenter(this.targets[p.team]);
      const aware=F[p.team].aware;
      const pinc=(aware&&this.pincered(p.team))||this.tac(p.team).bunker>0.5;
      // give-and-go: passer sprints beyond the line after releasing
      if(this.play&&p===this.play.passer&&this.clock<this.play.until&&p!==owner){
        // run beyond the nearest opponent into open space toward goal
        let dx=tgt.x-p.x,dy=tgt.y-p.y;const dl=Math.hypot(dx,dy)||1;dx/=dl;dy/=dl;
        let near=null,nd=1e9;
        this.players.forEach(o=>{if(o.team!==p.team){const d=dist(o,p);if(d<nd){nd=d;near=o;}}});
        if(near&&nd<50){dx+=(p.x-near.x)/nd*0.7;dy+=(p.y-near.y)/nd*0.7;}
        this.steer(p,p.x+dx*110,p.y+dy*110,2.3);
        return;
      }
      if(p===owner){
        let near=null,nd=1e9;
        oppOf(p.team).forEach(o=>{const d=dist(o,p);if(d<nd){nd=d;near=o;}});
        let dx=tgt.x-p.x,dy=tgt.y-p.y;let dl=Math.hypot(dx,dy)||1;dx/=dl;dy/=dl;
        if(near&&nd<60){dx+=(p.x-near.x)/nd*0.9;dy+=(p.y-near.y)/nd*0.9;}
        const {wd,we}=this.wallDist(p);
        const inMouth=we&&we.goal&&we===EDGES[GOAL_EDGE[this.targets[p.team]]]&&
          Math.abs((p.x-we.mx)*we.ux+(p.y-we.my)*we.uy)<we.len*GOAL_HALF*1.3;
        const wallR=this.o.disc?95:70, wallW=this.o.disc?1.6:1.1;
        if(wd<wallR&&!inMouth){const w=(wallR-wd)/wallR*wallW;dx+=we.nx*w;dy+=we.ny*w;}
        this.steer(p,p.x+dx*80,p.y+dy*80,2.05);
      } else if(p.role==="K"){
        const e=EDGES[GOAL_EDGE[p.team]];
        let along=(b.x-e.mx)*e.ux+(b.y-e.my)*e.uy;
        const lim=e.len*GOAL_HALF*0.9;along=Math.max(-lim,Math.min(lim,along));
        this.steer(p,e.mx+e.ux*along+e.nx*20,e.my+e.uy*along+e.ny*20,1.9);
        if(dist(p,b)<55&&(!owner||owner.team!==p.team))this.steer(p,b.x,b.y,2.3);
      } else if(p===chaser[p.team]&&(!owner||owner.team!==p.team)){
        this.steer(p,b.x+b.vx*6,b.y+b.vy*6,2.15+0.4*this.tac(p.team).press);
      } else if(p.role==="D"){
        const ds=P.filter(q=>q.team===p.team&&q.role==="D");
        const idx=ds.indexOf(p);
        const T=this.tac(p.team);
        const lineShift=(T.line-0.5)*0.22;
        let f=(idx===0?0.38:0.62)+lineShift;
        if(pinc||T.bunker>0.5)f=(idx===0?0.28:0.48)+lineShift*0.5;   // bunker posture
        const e=EDGES[GOAL_EDGE[p.team]];
        let bx=own.x+(b.x-own.x)*f+e.ux*(idx===0?34:-34);
        let by=own.y+(b.y-own.y)*f+e.uy*(idx===0?34:-34);
        if(aware){
          // man-marking: find unmarked threats lurking in our defensive zone
          const threats=P.filter(q=>q.team!==p.team&&q.role!=="K"&&q!==owner&&dist(q,{x:own.x,y:own.y})<250)
            .sort((a,b2)=>dist(a,{x:own.x,y:own.y})-dist(b2,{x:own.x,y:own.y}));
          const mark=threats[idx];              // each defender takes a threat by index
          if(mark){
            // goal-side of the mark, blended with zonal duty
            const gx=own.x+(mark.x-own.x)*0.82, gy=own.y+(mark.y-own.y)*0.82;
            bx=bx*0.45+gx*0.55; by=by*0.45+gy*0.55;
          }
        }
        this.steer(p,bx,by,2.0);
      } else {
        // support: M and F
        if(pinc&&p.role==="M"){
          // pincered: mid drops as a third defender
          const bx=own.x+(b.x-own.x)*0.72,by=own.y+(b.y-own.y)*0.72;
          this.steer(p,bx,by,2.0);
          return;
        }
        if(pinc&&p.role==="F"){
          // pincered: forward holds a counter station halfway to the target
          const sx=(own.x+tgt.x)/2,sy=(own.y+tgt.y)/2;
          this.steer(p,sx,sy,2.0);
          return;
        }
        // vulture: my rivals are fighting each other far from me — station for the breakout
        const contested=aware&&owner&&owner.team!==p.team&&this.targets[owner.team]!==p.team;
        const off=this.offense(p.team);
        let f=p.role==="M"?0.45:(contested&&p.role==="F"?0.55:0.72);
        if(off==="direct"&&p.role==="F")f=0.85;                 // target man goes deep
        let sx=b.x+(tgt.x-b.x)*f,sy=b.y+(tgt.y-b.y)*f;
        let side=(p.role==="M"?1:-1);
        const dBallGoal=dist(b,tgt);
        let spread=55+Math.max(0,(230-dBallGoal))*0.45;
        if(off==="overload"){side=1;spread*=0.75;}              // both supports flood one flank
        if(off==="switch"&&p.role==="M"){side=-1;spread*=1.45;} // far-side outlet held wide
        const ang=Math.atan2(tgt.y-b.y,tgt.x-b.x)+Math.PI/2;
        sx+=Math.cos(ang)*spread*side;sy+=Math.sin(ang)*spread*side;
        if(aware){
          // sample alternatives, keep the most open progressive spot
          let bestX=sx,bestY=sy,bs=this.spaceScore(p.team,sx,sy,tgt);
          for(let k=0;k<4;k++){
            const cx2=sx+(RNG()*2-1)*70,cy2=sy+(RNG()*2-1)*70;
            const s2=this.spaceScore(p.team,cx2,cy2,tgt);
            if(s2>bs){bs=s2;bestX=cx2;bestY=cy2;}
          }
          sx=bestX;sy=bestY;
        }
        this.steer(p,sx,sy,2.0);
      }
    });
    // separation
    const sepS=Math.min(1,dt*60);
    for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){
      const a=P[i],bb=P[j],d=dist(a,bb);
      if(d<26&&d>0.01){const push=(26-d)/26*0.45*sepS,dx=(a.x-bb.x)/d,dy=(a.y-bb.y)/d;
        a.vx+=dx*push;a.vy+=dy*push;bb.vx-=dx*push;bb.vy-=dy*push;}
    }
    // owner decisions
    if(owner){
      if(owner.role==="K"){
        const og=goalCenter(owner.team);
        let best=null,bd=1e9;
        P.forEach(m=>{if(m.team===owner.team&&(m.role==="M"||m.role==="F")){
          const d=dist(m,owner);if(d<bd){bd=d;best=m;}}});
        if(best){
          let tx=best.x+best.vx*10,ty=best.y+best.vy*10;
          if(Math.hypot(tx-og.x,ty-og.y)<dist(owner,og)+30){tx=CX;ty=CY;}
          this.kick(tx,ty,Math.min(9,bd*0.05+4));
        } else this.kick(CX,CY,8);
        return;
      }
      const tgt=goalCenter(this.targets[owner.team]);
      const e=EDGES[GOAL_EDGE[this.targets[owner.team]]];
      const dGoal=dist(owner,tgt);
      let pressure=1e9;oppOf(owner.team).forEach(o=>pressure=Math.min(pressure,dist(o,owner)));
      // give-and-go return ball — only if the runner is actually open
      if(this.play&&owner===this.play.receiver&&this.clock<this.play.until){
        const ps=this.play.passer;
        let psOpen=1e9;
        this.players.forEach(o=>{if(o.team!==ps.team){const d=dist(o,ps);if(d<psOpen)psOpen=d;}});
        if(psOpen>45&&dist(ps,owner)>60&&dist(ps,owner)<280&&RNG()<0.25*dt*60){
          this.m.passTry++;
          this.kick(ps.x+ps.vx*10,ps.y+ps.vy*10,Math.min(9,dist(ps,owner)*0.045+4));
          this.play=null;
          return;
        }
      }
      // pinned outlet
      {
        const {wd,we}=this.wallDist(owner);
        const mouth=we&&we.goal&&Math.abs((owner.x-we.mx)*we.ux+(owner.y-we.my)*we.uy)<we.len*GOAL_HALF*1.3;
        if(wd<34&&pressure<58&&!mouth&&RNG()<0.22*dt*60){
          let best=null,bs=1e9;
          P.forEach(m=>{if(m.team===owner.team&&m!==owner&&m.role!=="K"){
            const dc=dist(m,{x:CX,y:CY});if(dc<bs){bs=dc;best=m;}}});
          this.m.passTry++;
          if(best)this.kick(best.x+best.vx*8,best.y+best.vy*8,Math.min(9,dist(best,owner)*0.045+4.5));
          else this.kick(CX,CY,7);
          return;
        }
      }
      {
        const RK=this.tac(owner.team).risk;
        // THE LONG STRIKE: open lane + decent angle + space = have a go from range
        if(this.o.longshots&&dGoal>125&&dGoal<250&&pressure>42){
          const hw2=e.len*GOAL_HALF;
          const latOff=Math.abs((owner.x-tgt.x)*e.ux+(owner.y-tgt.y)*e.uy);
          if(latOff<hw2*1.5){
            let laneClear=true;
            oppOf(owner.team).forEach(o=>{
              const tt=((o.x-owner.x)*(tgt.x-owner.x)+(o.y-owner.y)*(tgt.y-owner.y))/(dGoal*dGoal);
              if(tt>0.12&&tt<0.85){const lx=owner.x+(tgt.x-owner.x)*tt,ly=owner.y+(tgt.y-owner.y)*tt;
                if(o.role!=="K"&&Math.hypot(o.x-lx,o.y-ly)<26)laneClear=false;}
            });
            if(laneClear&&RNG()<0.016*(0.4+1.2*RK)*dt*60){
              this.m2.shotD=this.m2.shotD||[]; this.m2.shotD.push(dGoal);
              this.m2.longs=(this.m2.longs||0)+1;
              const scL=(0.6+0.8*RK)*(0.75+dGoal*0.0035);   // range punishes accuracy
              const offL=(RNG()*2-1)*hw2*scL;
              this.kick(tgt.x+e.ux*offL,tgt.y+e.uy*offL,11.2,true);
              return;
            }
          }
        }
        const open=pressure>60, smothered=pressure<32;
        const shotChance=0.025*(0.5+1.0*RK)*(open?1.5:smothered?0.55:1.0);
        if(dGoal<(150+50*RK)&&RNG()<shotChance*dt*60){
          this.m2.shotD=this.m2.shotD||[]; this.m2.shotD.push(dGoal);
          let scatter=(open?0.55:smothered?1.5:1.0)*(0.6+0.8*RK);   // patience = precision
          // a bunkered box deflects and crowds every strike
          if(this.tac(this.targets[owner.team]).bunker>0.5) scatter*=1.35;
          const off2=(RNG()*2-1)*e.len*GOAL_HALF*scatter;
          this.kick(tgt.x+e.ux*off2,tgt.y+e.uy*off2,9.5+RNG()*1.5,true);
          return;
        }
      }
      if(pressure<48&&RNG()<(0.05+0.10*this.tac(owner.team).tempo)*dt*60){
        let best=null,bs=-1e9;
        const AW=this.o.ally;   // {base, press, solo} penalties, or null = alliance passing off
        const allied=(a,b)=>a!==b&&this.targets[a]!==null&&this.targets[a]===this.targets[b]
          &&this.targets[a]!==b&&this.targets[b]!==a;
        const matesLeft=P.filter(q=>q.team===owner.team&&q!==owner&&!q.out&&q.role!=="K").length;
        P.forEach(m=>{
          const allyOk=AW&&allied(owner.team,m.team)&&!m.out&&m.role!=="K";
          if((m.team!==owner.team&&!allyOk)||m===owner||m.role==="K")return;
          const d=dist(m,owner);
          const DIR=this.tac(owner.team).direct;
          const maxR=(this.offense(owner.team)==="direct")?330:(210+140*DIR);
          if(d<60||d>maxR)return;
          const gain=dist(owner,tgt)-dist(m,tgt);
          const off=this.offense(owner.team);
          let schemeBonus=0;
          if(off==="switch"){
            // reward moving the point of attack laterally
            const ax=tgt.x-owner.x,ay=tgt.y-owner.y,al=Math.hypot(ax,ay)||1;
            const lat=Math.abs((m.x-owner.x)*(-ay/al)+(m.y-owner.y)*(ax/al));
            schemeBonus=lat*0.6;
          }
          if(off==="direct"&&m.role==="F")schemeBonus=60;
          let mOpen=1e9;
          oppOf(owner.team).forEach(o=>{const d2=dist(o,m);if(d2<mOpen)mOpen=d2;});
          const inRange=dist(m,tgt)<175;
          const openBonus=Math.min(mOpen,90)*(inRange?1.2:0.4);   // find the open shooter
          let laneOk=true;
          oppOf(owner.team).forEach(o=>{
            const t=((o.x-owner.x)*(m.x-owner.x)+(o.y-owner.y)*(m.y-owner.y))/(d*d);
            if(t>0.1&&t<0.9){const lx=owner.x+(m.x-owner.x)*t,ly=owner.y+(m.y-owner.y)*t;
              const blockR=(30-12*this.tac(owner.team).risk)+5*(this.tac(o.team).press-0.5)*2;
              if(Math.hypot(o.x-lx,o.y-ly)<blockR)laneOk=false;}
          });
          let s=gain*(0.6+0.8*DIR)+schemeBonus+openBonus*(1.4-0.8*DIR)+(laneOk?0:-500)+RNG()*30;
          if(allyOk){
            const fl=t2=>P.filter(q2=>q2.team===t2&&!q2.out&&q2.role!=="K").length;
            const foe=this.targets[owner.team];
            const foeLead=this.score[foe]-this.score[owner.team];
            const shortfall=fl(foe)-fl(owner.team);
            let desp=Math.max(0,foeLead)*0.28+Math.max(0,shortfall)*0.4+(fl(owner.team)===0?0.45:0);
            let pen=850*Math.max(0,1-desp);
            if(matesLeft===0) pen-=80;
            if(pressure>32) pen*=0.8;
            s-=pen;
          }
          if(s>bs){bs=s;best=m;}
        });
        if(best&&bs>-100){
          if(best.team!==owner.team){
            this.m2.ally=(this.m2.ally||0)+1;
            const mx=Math.max(...this.score), mn=Math.min(...this.score);
            if(mx-mn<=1) this.m2.allyTied=(this.m2.allyTied||0)+1;
            const foe2=this.targets[owner.team];
            if(this.score[foe2]-this.score[owner.team]>=3) this.m2.allyRun=(this.m2.allyRun||0)+1;
          }
          this.m.passTry++;
          const passer=owner;
          this.kick(best.x+best.vx*8,best.y+best.vy*8,Math.min(9,dist(best,owner)*0.045+4));
          if(this.o.teamFlags[passer.team].plays&&pressure<48&&dGoal<380){
            this.play={passer,receiver:best,until:this.clock+1.5};
          }
          return;
        }
      }
      // tackles / shoulder contests
      // fouls: clumsy challenges from aggressive or exhausted defenders
      for(const o of oppOf(owner.team)){
        if(this.suppress&&this.suppress.team===o.team&&this.clock<this.suppress.until)continue;
        if(dist(o,owner)>=28)continue;
        const T=this.tac(o.team);
        const inBox=dist(owner,goalCenter(o.team))<110;
        const cc2=this.o.coalition&&this.HA&&this.HA[o.team]?0.7:1;
        const fc=0.0022*(T.aggF||1)*(0.4+1.2*T.press*cc2)*(1.5-0.7*o.stamina)*(inBox?0.4:1.0);
        if(RNG()<fc*dt*60){
          this.m2.fouls++;
          const ownGoal=goalCenter(o.team);
          if(dist(owner,ownGoal)<110){
            // PENALTY: fouled in the box — spot kick
            this.m2.pens++;
            if(RNG()<0.72){
              this.m2.penGoals++;
              b.owner=null;b.lastTouch=owner.team;b.lastKicker=owner;
              this.goal(o.team);
              return;
            } else {
              // saved: keeper claims it
              const gk=this.players.find(q=>q.team===o.team&&q.role==="K");
              b.owner=gk;b.lastTouch=o.team;b.x=gk.x;b.y=gk.y;
            }
          } else {
            // free kick: victim keeps it, offenders stand off for a second
            this.suppress={team:o.team,until:this.clock+1.0};
          }
          return;
        }
      }
      const tackleR=this.o.dribble?26:27;
      const tackleBase=this.o.dribble?0.010:0.012;
      oppOf(owner.team).forEach(o=>{
        if(this.suppress&&this.suppress.team===o.team&&this.clock<this.suppress.until)return;
        let tc=tackleBase*(0.6+0.8*this.tac(o.team).press)*(this.tac(o.team).aggT||1);
        tc*=(0.55+0.45*o.stamina);
        tc*=(1.35-0.5*owner.stamina);
        if(this.clock<this.boostUntil[o.team])tc*=1.3;
        if(dist(o,owner)<tackleR&&RNG()<tc*dt*60){
          const victim=owner;
          b.owner=o;b.lastTouch=o.team;b.isShot=false;b.ev="tackle";
          if(o.role!=="K"){this.m.tackles++;}
          this.stam(o,+0.10);this.stam(victim,-0.12);
          b.x=o.x;b.y=o.y;b.touchT=0;
        }
      });
    }
  }
  physics(dt){
    const S=dt*60,b=this.ball,P=this.players;
    P.forEach(p=>{
      p.x+=p.vx*S;p.y+=p.vy*S;this.clampIn(p,p.role==="K"?12:14);
      const v=Math.hypot(p.vx,p.vy),eff=v/2.35;
      {
        const cc=this.o.coalition&&this.HA&&this.HA[p.team]?0.7:1;
        p.stamina-=eff*eff*0.0012*S*(0.85+0.5*this.tac(p.team).press*cc);
      }
      p.stamina+=0.0004*S;
      p.stamina=Math.max(0,Math.min(1,p.stamina));
    });
    if(this.o.zoneRule){
      for(const p of P){ if(p.out)continue;
        for(let t=0;t<3;t++){ if(t===p.team)continue;
          const g=goalCenter(t);
          if(dist(b,g)<110)continue;              // ball is in — the zone is open
          if(this.o.anticipate&&b.z>4&&dist(b,g)<260&&((g.x-b.x)*b.vx+(g.y-b.y)*b.vy)>0)continue; // timed run: cross is inbound
          const d=dist(p,g);
          if(d<112){ p.x=g.x+(p.x-g.x)/(d||1)*112; p.y=g.y+(p.y-g.y)/(d||1)*112; }
        }
      }
    }
    const BODY=23;
    for(let pass=0;pass<2;pass++){
      for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){
        const a=P[i],bb=P[j];
        const dx=a.x-bb.x,dy=a.y-bb.y,d=Math.hypot(dx,dy);
        if(d<BODY&&d>0.01){const push=(BODY-d)/2,ux=dx/d,uy=dy/d;
          a.x+=ux*push;a.y+=uy*push;bb.x-=ux*push;bb.y-=uy*push;}
      }
      P.forEach(p=>this.clampIn(p,p.role==="K"?12:14));
    }
    if(b.owner&&!this.o.dribble){
      // shipped rigid-follow carry
      const o=b.owner,v=Math.hypot(o.vx,o.vy);
      if(v>0.1){o.hx=o.hx*0.85+(o.vx/v)*0.15;o.hy=o.hy*0.85+(o.vy/v)*0.15;}
      const hl=Math.hypot(o.hx,o.hy)||1;
      b.x=o.x+(o.hx/hl)*13;b.y=o.y+(o.hy/hl)*13;
      b.vx=o.vx;b.vy=o.vy;
    } else if(b.owner&&this.o.dribble){
      // hybrid dribble: ball is its own body, spring-following, with touch impulses
      const o=b.owner,v=Math.hypot(o.vx,o.vy);
      if(v>0.1){o.hx=o.hx*0.85+(o.vx/v)*0.15;o.hy=o.hy*0.85+(o.vy/v)*0.15;}
      const hl=Math.hypot(o.hx,o.hy)||1,hx=o.hx/hl,hy=o.hy/hl;
      const cx2=o.x+hx*15,cy2=o.y+hy*15;
      b.vx+= (cx2-b.x)*0.08*S; b.vy+=(cy2-b.y)*0.08*S;
      b.vx*=Math.pow(0.90,S); b.vy*=Math.pow(0.90,S);
      b.x+=b.vx*S; b.y+=b.vy*S;
      b.touchT-=dt;
      if(b.touchT<=0&&dist(b,o)<18){
        // take a touch: length depends on pressure
        let pr=1e9;P.forEach(q=>{if(q.team!==o.team){const d=dist(q,o);if(d<pr)pr=d;}});
        const long=pr>70;
        const pw=long?3.6:2.2;
        b.vx+=hx*pw;b.vy+=hy*pw;
        b.touchT=long?0.75:0.45;
      }
      // spatial dispossession: ball strayed — it's loose (tagged below)
      if(dist(b,o)>30){
        b.owner=null;b.noClaim=o;b.noClaimF=8;b.ev="stray";
        this.m.dispossessSpatial++;
      }
    } else {
      const px0=b.x,py0=b.y;
      b.x+=b.vx*S;b.y+=b.vy*S;
      b.vx*=Math.pow(0.985,S);b.vy*=Math.pow(0.985,S);
      if(b.z>0||b.zv>0){ b.z+=b.zv*S; b.zv-=0.14*S;
        if(b.z<=0){ b.z=0;b.zv=0;
          const near=P.filter(p=>dist(p,b)<(this.o.duelR||50));
          const teams=new Set(near.map(p=>p.team));
          if(near.length>=2&&teams.size>=2&&this.o.aerial){
            this.m2.headers++;
            let win=null,wt=0;
            near.forEach(p=>{const w=(1/(dist(p,b)+8))*(0.6+0.8*RNG());if(w>wt){wt=w;win=p;}});
            const tgt2=goalCenter(this.targets[win.team]);
            b.lastTouch=win.team;b.lastKicker=win;
            if(dist(b,tgt2)<160&&win.role!=="K"){
              const e2=EDGES[GOAL_EDGE[this.targets[win.team]]];
              const off2=(RNG()*2-1)*e2.len*GOAL_HALF*1.35;
              const ddx=tgt2.x+e2.ux*off2-b.x,ddy=tgt2.y+e2.uy*off2-b.y,dl2=Math.hypot(ddx,ddy)||1;
              b.vx=ddx/dl2*8.5;b.vy=ddy/dl2*8.5;b.isShot=true;this.m.shots++;
            } else {
              const ddx=tgt2.x-b.x,ddy=tgt2.y-b.y,dl2=Math.hypot(ddx,ddy)||1;
              b.vx=ddx/dl2*5;b.vy=ddy/dl2*5;
            }
            b.noClaim=win;b.noClaimF=10;
          }
        }
      }
      if(b.noClaimF>0)b.noClaimF-=S;else b.noClaim=null;
      let best=null,bd=1e9;
      P.forEach(p=>{if(p===b.noClaim&&b.noClaimF>0)return;
        if(b.z>(p.role==="K"?28:12))return;
        const sx=b.x-px0,sy=b.y-py0,sl=sx*sx+sy*sy;
        let t=sl>0?((p.x-px0)*sx+(p.y-py0)*sy)/sl:0;
        t=Math.max(0,Math.min(1,t));
        const d=Math.hypot(p.x-(px0+sx*t),p.y-(py0+sy*t));
        const reach=p.role==="K"?17:13;
        if(d<reach&&d<bd){bd=d;best=p;}});
      if(best){
        const wasShot=b.isShot,spd=Math.hypot(b.vx,b.vy),kicker=b.lastKicker;
        b.owner=best;b.lastTouch=best.team;b.x=best.x;b.y=best.y;b.isShot=false;b.touchT=0.3;
        if(kicker&&best.team===kicker.team&&best.role!=="K"){
          const tgt2=goalCenter(this.targets[best.team]);
          let pr=1e9;P.forEach(o=>{if(o.team!==best.team){const d2=dist(o,best);if(d2<pr)pr=d2;}});
          if(dist(best,tgt2)<175&&pr>55&&RNG()<0.5){
            const e2=EDGES[GOAL_EDGE[this.targets[best.team]]];
            const off2=(RNG()*2-1)*e2.len*GOAL_HALF*0.5;
            this.kick(tgt2.x+e2.ux*off2,tgt2.y+e2.uy*off2,9.5+RNG()*1.5,true);
          }
        }
        if(wasShot&&best.role==="K"&&kicker&&best.team!==kicker.team&&spd>5){
          this.m.saves++;this.stam(best,+0.12);this.stam(kicker,-0.05);
          if(this.o.parries&&spd>8.5&&RNG()<0.4){
            // parried! pushed wide, not held
            this.m2.parries=(this.m2.parries||0)+1;
            const e2=EDGES[GOAL_EDGE[best.team]];
            const hw3=e2.len*GOAL_HALF;
            const along=(best.x-e2.mx)*e2.ux+(best.y-e2.my)*e2.uy;
            const lat=along>=0?1:-1;                    // push toward the NEARER post
            const need=(hw3+16)-lat*along;              // lateral distance to clear the mouth
            let dx3=e2.ux*lat*need-e2.nx*10, dy3=e2.uy*lat*need-e2.ny*10;
            const dl3=Math.hypot(dx3,dy3)||1;
            b.owner=null; b.lastTouch=best.team; b.lastKicker=best;
            b.vx=dx3/dl3*spd*0.68; b.vy=dy3/dl3*spd*0.68;
            b.ev="parry";
            b.noClaim=best; b.noClaimF=10;
          }
        } else if(kicker&&spd>2.2&&best!==kicker){
          if(best.team===kicker.team){this.m.passOk++;this.stam(kicker,+0.05);this.stam(best,+0.03);}
          else if(!wasShot){this.stam(kicker,-0.08);this.stam(best,+0.06);}
        }
      }
    }
    // walls & goals (ball checked always so dribble touches can score/rebound)
    for(let k=0;k<6;k++){
      const e=EDGES[k];
      const d=(b.x-e.p1.x)*e.nx+(b.y-e.p1.y)*e.ny;
      if(d<7){
        const along=(b.x-e.mx)*e.ux+(b.y-e.my)*e.uy;
        const inMouth=e.goal&&Math.abs(along)<e.len*GOAL_HALF;
        if(inMouth){
          if(d<-6){ if(b.z<28){this.goal(GOAL_EDGE.indexOf(k));return;} }
        }else if(this.o.oob){
          if(d<2){
            this.m2.oobs=(this.m2.oobs||0)+1;
            if(!this.o.restarts){
              b.x=CX;b.y=CY;b.vx=0;b.vy=0;b.z=0;b.zv=0;b.owner=null;b.noClaim=null;
            } else {
              const toucher=b.lastTouch;
              const spotX=Math.max(-1e9,b.x+e.nx*24), spotY=b.y+e.ny*24;
              b.vx=0;b.vy=0;b.z=0;b.zv=0;b.noClaim=null;b.isShot=false;
              if(e.goal){
                const ownerT=GOAL_EDGE.indexOf(k);
                if(toucher===ownerT){
                  // CORNER to the nearest hunter
                  this.m2.corners=(this.m2.corners||0)+1;
                  const att=[0,1,2].filter(x=>x!==ownerT&&(this.targets[x]===ownerT))[0]
                    ??[0,1,2].find(x=>x!==ownerT);
                  const vtx=dist({x:e.p1.x,y:e.p1.y},b)<dist({x:e.p2.x,y:e.p2.y},b)?e.p1:e.p2;
                  const taker=this.players.filter(q=>q.team===att&&q.role!=="K")
                    .sort((a2,b2)=>dist(a2,vtx)-dist(b2,vtx))[0];
                  if(taker){
                    taker.x=vtx.x+e.nx*14; taker.y=vtx.y+e.ny*14;
                    b.owner=taker; b.lastTouch=att; b.x=taker.x; b.y=taker.y;
                    const g=goalCenter(ownerT);
                    const off=(RNG()*2-1)*e.len*GOAL_HALF*0.7;
                    const txc=g.x+e.ux*off+e.nx*44, tyc=g.y+e.uy*off+e.ny*44;
                    const dd=Math.hypot(txc-b.x,tyc-b.y)||1;
                    b.vx=(txc-b.x)/dd*6.8; b.vy=(tyc-b.y)/dd*6.8;
                    b.lastKicker=taker; b.owner=null; b.noClaim=taker; b.noClaimF=14;
                    b.zv=3.0; this.m2.crosses++;
                  } else { b.x=CX;b.y=CY;b.owner=null; }
                } else {
                  // GOAL KICK
                  this.m2.goalkicks=(this.m2.goalkicks||0)+1;
                  const gk=this.players.find(q=>q.team===ownerT&&q.role==="K");
                  b.owner=gk; b.lastTouch=ownerT; b.x=gk.x; b.y=gk.y;
                }
              } else {
                // THROW-IN to the nearest non-toucher
                this.m2.throwins=(this.m2.throwins||0)+1;
                const cands=this.players.filter(q=>q.team!==toucher&&q.role!=="K"&&!q.out);
                cands.sort((a2,b2)=>dist(a2,{x:spotX,y:spotY})-dist(b2,{x:spotX,y:spotY}));
                const thr=cands[0];
                if(thr){
                  thr.x=spotX; thr.y=spotY;
                  b.owner=thr; b.lastTouch=thr.team; b.x=thr.x; b.y=thr.y; b.touchT=0.4;
                  this.suppress={team:toucher,until:this.clock+0.8};
                } else { b.x=CX;b.y=CY;b.owner=null; }
              }
            }
          }
        }else{
          b.x+=e.nx*(7-d);b.y+=e.ny*(7-d);
          const vn=b.vx*e.nx+b.vy*e.ny;
          if(vn<0){b.vx-=2*vn*e.nx*0.82;b.vy-=2*vn*e.ny*0.82;}
          b.vx+=e.nx*0.5;b.vy+=e.ny*0.5;
        }
      }
    }
  }
  goal(conceder){
    const b=this.ball;
    const scorerTeam=(b.owner?b.owner.team:b.lastTouch);
    if(b.owner)this.m.carriedIn=(this.m.carriedIn||0)+1;
    const legit=(scorerTeam!==null&&scorerTeam!==conceder);
    const trailing=legit&&this.wasTrailing(scorerTeam);
    {
      const mx=Math.max(...this.score);
      if(this.score[conceder]===mx&&this.score.filter(x=>x===mx).length===1)
        this.m2.leadHit=(this.m2.leadHit||0)+1;
    }
    this.conceded[conceder]++;this.score[conceder]--;
    if(legit){this.score[scorerTeam]++;this.scored[scorerTeam]++;
      if(trailing){
        this.boostUntil[scorerTeam]=this.clock+20;
        if(this.o.fireProbe){
          this.fp=this.fp||{rankTime:[0,0,0],rankFire:[0,0,0],fireTime:0,fireAsLeader:0,boosts:0,boostLedToLead:0};
          this.fp.boosts++;
          const mx=Math.max(...this.score);
          if(this.score[scorerTeam]===mx&&this.score.filter(x=>x===mx).length===1)
            this.fp.boostLedToLead++;   // the igniting goal itself took them top
        }
      }
      const sc=b.owner||b.lastKicker;if(sc)this.stam(sc,+0.2);
    } else {
      this.m.own++;
      const k=(b.ev||"unknown")+((b.lastKicker&&dist(b.lastKicker,goalCenter(conceder))<130)?"_nearOwnBox":"");
      this.m2.ogBy=this.m2.ogBy||{}; this.m2.ogBy[k]=(this.m2.ogBy[k]||0)+1;
    }
    this.m.goals++;
    this.computeTargets();
    this.endSpell();
    this.kickoff(conceder);
  }
  endSpell(){
    if(this.m.curTeam!==null&&this.m.curSpell>0.3)this.m.spells.push(this.m.curSpell);
    this.m.curSpell=0;this.m.curTeam=null;
  }
  step(dt){
    if(this.o.fireProbe){
      this.fp=this.fp||{rankTime:[0,0,0],rankFire:[0,0,0],fireTime:0,fireAsLeader:0,boosts:0,boostLedToLead:0};
      const ranks=[0,1,2].sort((a,b)=>(this.score[b]-this.score[a])||(this.scored[b]-this.scored[a]));
      for(let r=0;r<3;r++){
        const t=ranks[r];
        const strictLeader=r===0&&(this.score[ranks[0]]>this.score[ranks[1]]||(this.score[ranks[0]]===this.score[ranks[1]]&&this.scored[ranks[0]]>this.scored[ranks[1]]));
        const fired=this.clock<this.boostUntil[t];
        this.fp.rankTime[r]+=dt;
        if(fired){
          this.fp.rankFire[r]+=dt; this.fp.fireTime+=dt;
          if(strictLeader&&r===0)this.fp.fireAsLeader+=dt;
        }
      }
    }
    this.clock+=dt;this.retarget+=dt;
    if(this.retarget>6){this.retarget=0;this.computeTargets();}
    this.think(dt);this.physics(dt);
    const ot=this.ball.owner?this.ball.owner.team:null;
    if(ot!==null){
      if(ot!==this.m.curTeam){
        if(this.m.curTeam!==null){this.m.turnovers++;this.endSpell();}
        this.m.curTeam=ot;
      }
      this.m.curSpell+=dt;
    }
  }
  run(){
    const dt=1/60,steps=Math.round(this.o.minutes*60*60);
    for(let i=0;i<steps;i++)this.step(dt);
    this.endSpell();
    const min=this.o.minutes;
    const sp=this.m.spells;
    return {
      goalsPerMin:+(this.m.goals/min).toFixed(2),
      ownPerMatch:this.m.own,
      shotsPerMin:+(this.m.shots/min).toFixed(2),
      savesPerMin:+(this.m.saves/min).toFixed(2),
      turnoversPerMin:+(this.m.turnovers/min).toFixed(1),
      tacklesPerMin:+(this.m.tackles/min).toFixed(1),
      spatialPerMin:+(this.m.dispossessSpatial/min).toFixed(1),
      carriedIn:this.m.carriedIn||0,
      avgSpellSec:+(sp.length?sp.reduce((a,b)=>a+b,0)/sp.length:0).toFixed(2),
      headersPerMin:+(this.m2.headers/min).toFixed(2),
      crossesPerMin:+(this.m2.crosses/min).toFixed(2),
      foulsPerMin:+(this.m2.fouls/min).toFixed(2),
      pensPerMatch:+this.m2.pens.toFixed(2),
      passOkPerMin:+(this.m.passOk/min).toFixed(1),
      score:[...this.score],
    };
  }
}

function avg(rs,k){return +(rs.reduce((s,r)=>s+r[k],0)/rs.length).toFixed(2);}

function suite(label,flags,dribble,n,minutes){
  const rs=[];
  for(let i=0;i<n;i++){
    rs.push(new Match({minutes,dribble,
      teamFlags:[{...flags},{...flags},{...flags}]}).run());
  }
  const out={label,
    goalsPerMin:avg(rs,"goalsPerMin"),ownGoals:avg(rs,"ownPerMatch"),
    shots:avg(rs,"shotsPerMin"),saves:avg(rs,"savesPerMin"),
    turnovers:avg(rs,"turnoversPerMin"),tackles:avg(rs,"tacklesPerMin"),
    spatial:avg(rs,"spatialPerMin"),spellSec:avg(rs,"avgSpellSec"),
    passOk:avg(rs,"passOkPerMin")};
  console.log(JSON.stringify(out));
  return out;
}

const N=parseInt(process.env.N||"16"), MIN=5;
const FOCUS=process.env.FOCUS==="1";
if(process.env.ZONE==="1"){
  const BAL={tempo:.5,risk:.5,line:.5,press:.5,direct:.5,bunker:0};
  function wz(label,zoneRule){
    const rs=[];
    for(let i=0;i<12;i++)rs.push(new Match({minutes:MIN,dribble:true,aerial:true,zoneRule,
      teamFlags:[{tac:{...BAL}},{tac:{...BAL}},{tac:{...BAL}}]}).run());
    console.log(JSON.stringify({label,g:avg(rs,"goalsPerMin"),shots:avg(rs,"shotsPerMin"),
      headers:avg(rs,"headersPerMin"),crosses:avg(rs,"crossesPerMin"),pens:avg(rs,"pensPerMatch"),
      spell:avg(rs,"avgSpellSec"),saves:avg(rs,"savesPerMin")}));
  }
  wz("no zone rule",false);
  wz("ZONE RULE ON",true);
  // does the rule refund the Bus? rerun its worst matchups with the rule active
  const ATK={TikiTaka:{tempo:.9,risk:.3,direct:.15},RouteOne:{tempo:.3,risk:.7,direct:.95},
    Swashbuckle:{tempo:.8,risk:.95,direct:.5},Probe:{tempo:.35,risk:.25,direct:.3}};
  const BUS={line:.15,press:.2,bunker:1};
  for(const an in ATK){
    let aWins=0,games=0;
    for(let rot=0;rot<3;rot++)for(let i=0;i<8;i++){
      const posA=rot,posB=(rot+1)%3;
      const tf=[{tac:{...BAL}},{tac:{...BAL}},{tac:{...BAL}}];
      tf[posA]={tac:{...BAL,...ATK[an]}};
      tf[posB]={tac:{...BAL,...BUS}};
      const m=new Match({minutes:MIN,dribble:true,aerial:true,zoneRule:true,teamFlags:tf});m.run();
      if(m.rankCmp(posA,posB)<0)aWins++;games++;
    }
    console.log(JSON.stringify({cell:an+" vs Bus (zone rule)",AbeatsB:+(100*aWins/games).toFixed(1),was:{TikiTaka:60,RouteOne:53.3,Swashbuckle:58.3,Probe:62.5}[an]}));
  }
  process.exit(0);
}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;
  let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;
  return((t^t>>>14)>>>0)/4294967296;}}
let RNG=Math.random;
function setSeed(x){RNG=mulberry32(x>>>0);}
const NATIONS={
  ESP:{atk:"TikiTaka",def:"Gegenpress",agg:"Clean"},
  ARG:{atk:"Probe",def:"Trap",agg:"Nasty"},
  ENG:{atk:"RouteOne",def:"Balanced",agg:"Firm"},
  BRA:{atk:"Swashbuckle",def:"Balanced",agg:"Clean"},
  GER:{atk:"Balanced",def:"Gegenpress",agg:"Firm"},
  ITA:{atk:"Probe",def:"ParkTheBus",agg:"Nasty"},
  FRA:{atk:"Swashbuckle",def:"Trap",agg:"Firm"},
  NED:{atk:"TikiTaka",def:"Gegenpress",agg:"Firm"},
  MEX:{atk:"TikiTaka",def:"Trap",agg:"Nasty"},
  JPN:{atk:"TikiTaka",def:"Gegenpress",agg:"Clean"},
  POR:{atk:"Swashbuckle",def:"Trap",agg:"Firm"},
  USA:{atk:"Balanced",def:"Gegenpress",agg:"Firm"}};
const N_ATK={TikiTaka:{tempo:.9,risk:.3,direct:.15},RouteOne:{tempo:.3,risk:.7,direct:.95},
  Swashbuckle:{tempo:.8,risk:.95,direct:.5},Probe:{tempo:.35,risk:.25,direct:.3},
  Balanced:{tempo:.5,risk:.5,direct:.5}};
const N_DEF={Gegenpress:{line:.8,press:.95,bunker:0},ParkTheBus:{line:.15,press:.2,bunker:1},
  Trap:{line:.35,press:.6,bunker:0},Balanced:{line:.5,press:.5,bunker:0}};
const N_AGG={Clean:{aggF:.55,aggT:.92},Firm:{aggF:1,aggT:1},Nasty:{aggF:1.8,aggT:1.18},Filthy:{aggF:2.8,aggT:1.38}};
function natTac(n){const d=NATIONS[n];return {tac:{...N_ATK[d.atk],...N_DEF[d.def],...N_AGG[d.agg]}};}
const BALREF={tac:{tempo:.5,risk:.5,direct:.5,line:.5,press:.5,bunker:0,aggF:1,aggT:1}};
function natMatch(flags){
  return new Match({minutes:MIN,dribble:true,aerial:true,zoneRule:true,anticipate:true,
    oob:true,disc:true,restarts:true,parries:true,ally:{},teamFlags:flags});
}
if(process.env.POWER==="1"){
  const N2=parseInt(process.env.N||"20");
  const groupCsv=(process.env.GROUP||"").split(",").filter(x=>NATIONS[x]);
  const coal=process.env.COAL==="1";
  groupCsv.forEach(nm=>{
    let pts=0,gf=0,ga=0,wins=0;
    for(let i=0;i<N2;i++){
      setSeed(90000+i*131);
      const slot=i%3;
      const flags=[BALREF,BALREF,BALREF]; flags[slot]=natTac(nm);
      const m=natMatch(flags); m.o.coalition=coal; m.run();
      pts+=m.score[slot]; gf+=m.scored[slot]; ga+=m.conceded[slot];
      const mx=Math.max(...m.score);
      if(m.score[slot]===mx&&m.score.filter(x=>x===mx).length===1)wins++;
    }
    console.log(JSON.stringify({nation:nm,coal,n:N2,pts:+(pts/N2).toFixed(2),
      gf:+(gf/N2).toFixed(1),ga:+(ga/N2).toFixed(1),winPct:+(wins/N2*100).toFixed(0)}));
  });
  process.exit(0);
}
if(process.env.FIRECHK==="1"){
  const B={tempo:.5,risk:.5,direct:.5,line:.5,press:.5,bunker:0,aggF:1,aggT:1};
  const agg={rt:[0,0,0],rf:[0,0,0],ft:0,fl:0,bo:0,bl:0,total:0};
  for(let i=0;i<20;i++){
    setSeed(41000+i*307);
    const m=natMatch([{tac:{...B}},{tac:{...B}},{tac:{...B}}]);
    m.o.fireProbe=true; m.run();
    const f=m.fp||{rankTime:[0,0,0],rankFire:[0,0,0],fireTime:0,fireAsLeader:0,boosts:0,boostLedToLead:0};
    for(let r=0;r<3;r++){agg.rt[r]+=f.rankTime[r];agg.rf[r]+=f.rankFire[r];}
    agg.ft+=f.fireTime; agg.fl+=f.fireAsLeader; agg.bo+=f.boosts; agg.bl+=f.boostLedToLead;
    agg.total+=m.clock;
  }
  console.log(JSON.stringify({
    matches:20,
    pctTimeOnFire_rank1:+((agg.rf[0]/agg.rt[0])*100).toFixed(1),
    pctTimeOnFire_rank2:+((agg.rf[1]/agg.rt[1])*100).toFixed(1),
    pctTimeOnFire_rank3:+((agg.rf[2]/agg.rt[2])*100).toFixed(1),
    shareOfFireHeldByStrictLeader:+((agg.fl/agg.ft)*100).toFixed(1),
    boostsPerMatch:+(agg.bo/20).toFixed(1),
    pctBoostsWhereIgnitingGoalTookTheLead:+((agg.bl/agg.bo)*100).toFixed(1)
  }));
  process.exit(0);
}
if(process.env.OGRATE==="1"){
  const B={tempo:.5,risk:.5,direct:.5,line:.5,press:.5,bunker:0,aggF:1,aggT:1};
  const agg={}; let own=0,goals=0,N2=30;
  for(let i=0;i<N2;i++){
    setSeed(31000+i*211);
    const m=natMatch([{tac:{...B}},{tac:{...B}},{tac:{...B}}]);
    m.run();
    own+=m.m.own; goals+=m.m.goals;
    for(const k in (m.m2.ogBy||{})) agg[k]=(agg[k]||0)+m.m2.ogBy[k];
  }
  console.log(JSON.stringify({matches:N2,minutes:MIN,ogPerMatch:+(own/N2).toFixed(2),
    ogShareOfGoals:+(own/goals*100).toFixed(1)+"%",causes:agg}));
  process.exit(0);
}
if(process.env.AGGAB==="1"){
  ["Clean","Firm","Nasty","Filthy"].forEach(a=>{
    const N2=16; let pts=0,wins=0,gf=0,ga=0;
    for(let i=0;i<N2;i++){
      setSeed(70000+i*97);
      const slot=i%3;
      const flags=[BALREF,BALREF,BALREF];
      flags[slot]={tac:{tempo:.5,risk:.5,direct:.5,line:.5,press:.5,bunker:0,...N_AGG[a]}};
      const m=natMatch(flags); m.run();
      pts+=m.score[slot]; gf+=m.scored[slot]; ga+=m.conceded[slot];
      const mx=Math.max(...m.score);
      if(m.score[slot]===mx&&m.score.filter(x=>x===mx).length===1)wins++;
    }
    console.log(JSON.stringify({agg:a,pts:+(pts/16).toFixed(2),gf:+(gf/16).toFixed(1),
      ga:+(ga/16).toFixed(1),winPct:+(wins/16*100).toFixed(0)}));
  });
  process.exit(0);
}
if(false){
  const names=Object.keys(NATIONS);
  const group=process.env.GROUP==="B"?names.slice(6):names.slice(0,6);
  group.forEach(n=>{
    let pts=0,gf=0,ga=0,wins=0;
    for(let i=0;i<8;i++){
      const m=natMatch([natTac(n),BALREF,BALREF]);
      m.run();
      pts+=m.score[0]; gf+=m.scored[0]; ga+=m.conceded[0];
      const mx=Math.max(...m.score);
      if(m.score[0]===mx&&m.score.filter(x=>x===mx).length===1)wins++;
    }
    console.log(JSON.stringify({nation:n,pts:+(pts/8).toFixed(2),gf:+(gf/8).toFixed(1),
      ga:+(ga/8).toFixed(1),winPct:+(wins/8*100).toFixed(0)}));
  });
  process.exit(0);
}
if(process.env.DERBY==="1"){
  const trios=[["ESP","ITA","BRA"],["GER","FRA","ENG"],["ARG","BRA","GER"],
    ["JPN","NED","USA"],["MEX","ARG","POR"],["ITA","FRA","NED"]];
  trios.forEach(tr=>{
    const agg=[[0,0],[0,0],[0,0]];
    for(let i=0;i<8;i++){
      const m=natMatch(tr.map(natTac)); m.run();
      const mx=Math.max(...m.score);
      for(let t=0;t<3;t++){agg[t][0]+=m.score[t];
        if(m.score[t]===mx&&m.score.filter(x=>x===mx).length===1)agg[t][1]++;}
    }
    console.log(JSON.stringify({trio:tr.join("/"),
      result:tr.map((n,t)=>`${n} ${(agg[t][0]/8).toFixed(1)}pts/${agg[t][1]}W`)}));
  });
  process.exit(0);
}
if(process.env.LONG==="1"){
  const B={tempo:.5,risk:.5,line:.5,press:.5,direct:.5,bunker:0};
  function lw(label,longshots){
    const rs=[]; let ds=[], longs=0, parries=0;
    for(let i=0;i<8;i++){
      const m=new Match({minutes:MIN,dribble:true,aerial:true,zoneRule:true,anticipate:true,
        oob:true,disc:true,restarts:true,parries:true,ally:{},longshots,
        teamFlags:[{tac:{...B}},{tac:{...B}},{tac:{...B}}]});
      const r=m.run(); rs.push(r);
      ds=ds.concat(m.m2.shotD||[]); longs+=(m.m2.longs||0); parries+=(m.m2.parries||0);
    }
    const mean=ds.length?ds.reduce((a,b)=>a+b,0)/ds.length:0;
    const farShare=ds.length?ds.filter(d=>d>120).length/ds.length:0;
    console.log(JSON.stringify({label,goals:avg(rs,"goalsPerMin"),shots:avg(rs,"shotsPerMin"),
      meanShotDist:+mean.toFixed(0),shareBeyond120:+(farShare*100).toFixed(0)+"%",
      longsPerMin:+(longs/8/MIN).toFixed(2),parriesPerMin:+(parries/8/MIN).toFixed(2),
      headers:avg(rs,"headersPerMin")}));
  }
  lw("long shots OFF",false);
  lw("long shots ON",true);
  process.exit(0);
}
if(process.env.NATS==="1"){
  const PRE={
    TikiTaka:{tempo:.9,risk:.3,direct:.15},RouteOne:{tempo:.3,risk:.7,direct:.95},
    Swashbuckle:{tempo:.8,risk:.95,direct:.5},Probe:{tempo:.35,risk:.25,direct:.3},
    Balanced:{tempo:.5,risk:.5,direct:.5}};
  const DEF={Gegenpress:{line:.8,press:.95,bunker:0},ParkTheBus:{line:.15,press:.2,bunker:1},
    Trap:{line:.35,press:.6,bunker:0},Balanced:{line:.5,press:.5,bunker:0}};
  function nat(a,d){return {tac:{...PRE[a],...DEF[d]}};}
  function trio(label,teams){
    const rs=[];
    for(let i=0;i<8;i++)rs.push(new Match({minutes:MIN,dribble:true,aerial:true,zoneRule:true,
      anticipate:true,oob:true,disc:true,restarts:true,parries:true,
      ally:{},teamFlags:teams}).run());
    console.log(JSON.stringify({label,goals:avg(rs,"goalsPerMin"),headers:avg(rs,"headersPerMin"),
      spell:avg(rs,"avgSpellSec")}));
  }
  trio("ESP/ITA/MAR (TT·GP vs PR·BUS vs R1·BUS)",[nat("TikiTaka","Gegenpress"),nat("Probe","ParkTheBus"),nat("RouteOne","ParkTheBus")]);
  trio("BRA/GER/FRA (SB·BAL vs BAL·GP vs SB·TRP)",[nat("Swashbuckle","Balanced"),nat("Balanced","Gegenpress"),nat("Swashbuckle","Trap")]);
  trio("JPN/POR/USA (TT·GP vs SB·TRP vs BAL·GP)",[nat("TikiTaka","Gegenpress"),nat("Swashbuckle","Trap"),nat("Balanced","Gegenpress")]);
  process.exit(0);
}
if(process.env.ALLY==="1"){
  const B={tempo:.5,risk:.5,line:.5,press:.5,direct:.5,bunker:0};
  const sd=a=>{const mu=a.reduce((x,y)=>x+y,0)/a.length;
    return Math.sqrt(a.reduce((x,y)=>x+(y-mu)**2,0)/a.length);};
  function aw(label,ally,outs){
    const rs=[]; let allyN=0, leadN=0, spread=0, aTied=0, aRun=0;
    for(let i=0;i<8;i++){
      const m=new Match({minutes:MIN,dribble:true,aerial:true,zoneRule:true,anticipate:true,
        oob:true,disc:true,restarts:true,parries:true,ally,outs,
        teamFlags:[{tac:{...B}},{tac:{...B}},{tac:{...B}}]});
      if(outs)m.applyOuts();
      const r=m.run(); rs.push(r);
      allyN+=(m.m2.ally||0); leadN+=(m.m2.leadHit||0); spread+=sd(m.score);
      aTied+=(m.m2.allyTied||0); aRun+=(m.m2.allyRun||0);
    }
    console.log(JSON.stringify({label,goals:avg(rs,"goalsPerMin"),
      allyPerMin:+(allyN/8/MIN).toFixed(2),
      allyWhileTied:rs.reduce((x,r,i)=>x,0)+(aTied/8).toFixed(1)*1,
      allyVsRunaway:+(aRun/8).toFixed(1),
      leaderConcededPerMatch:+(leadN/8).toFixed(1),
      scoreSpread:+(spread/8).toFixed(2),spell:avg(rs,"avgSpellSec")}));
  }
  const MODE=process.env.MODE||"sweep";
  if(MODE==="sweep"){
    aw("alliances OFF",null);
    aw("shipped (-260/-80/+20)",{base:260,press:80,solo:-20});
    aw("liberal (-120/-30/+30)",{base:120,press:30,solo:-30});
    aw("free love (0/0/-40)",{base:0,press:0,solo:-40});
  } else {
    aw("tuned (-320/-150/+20, gate stays)",{base:320,press:150,solo:-20});
    aw("5-4-3, alliances OFF",null,[0,1,2]);
    aw("5-4-3, shipped weights",{base:260,press:80,solo:-20},[0,1,2]);
  }
  process.exit(0);
}
if(process.env.UNEVEN==="1"){
  const B={tempo:.5,risk:.5,line:.5,press:.5,direct:.5,bunker:0};
  function uw(label,outs){
    const agg=[[0,0,0],[0,0,0],[0,0,0]]; // per team: [pts, gf, ga]
    let errs=0;
    for(let i=0;i<12;i++){
      try{
        const m=new Match({minutes:MIN,dribble:true,aerial:true,zoneRule:true,anticipate:true,
          oob:true,disc:true,restarts:true,parries:true,outs,
          teamFlags:[{tac:{...B}},{tac:{...B}},{tac:{...B}}]});
        m.applyOuts();
        m.run();
        for(let t=0;t<3;t++){ agg[t][0]+=m.score[t]; agg[t][1]+=m.scored[t]; agg[t][2]+=m.conceded[t]; }
      }catch(e){ errs++; console.log("  ERROR:",e.message); }
    }
    console.log(JSON.stringify({label,errors:errs,
      perTeam:agg.map((a,t)=>({team:t,men:5-(outs[t]||0),pts:+(a[0]/12).toFixed(1),
        gf:+(a[1]/12).toFixed(1),ga:+(a[2]/12).toFixed(1)}))}));
  }
  uw("5-5-4: one team a man down",[0,0,1]);
  uw("5-4-3: staggered disadvantage",[0,1,2]);
  process.exit(0);
}
if(process.env.OOB==="1"){
  const B={tempo:.5,risk:.5,line:.5,press:.5,direct:.5,bunker:0};
  function world(label,opts){
    const rs=[];
    for(let i=0;i<10;i++){
      const m=new Match({minutes:MIN,dribble:true,aerial:true,zoneRule:true,anticipate:true,oob:true,...opts,
        teamFlags:[{tac:{...B}},{tac:{...B}},{tac:{...B}}]});
      const r=m.run();
      r.oobs=+((m.m2.oobs||0)/MIN).toFixed(2);
      r.ti=+((m.m2.throwins||0)/MIN).toFixed(2);
      r.co=+((m.m2.corners||0)/MIN).toFixed(2);
      r.gk2=+((m.m2.goalkicks||0)/MIN).toFixed(2);
      rs.push(r);
    }
    console.log(JSON.stringify({label,oob:avg(rs,"oobs"),goals:avg(rs,"goalsPerMin"),
      headers:avg(rs,"headersPerMin"),throwins:avg(rs,"ti"),corners:avg(rs,"co"),
      goalkicks:avg(rs,"gk2"),spell:avg(rs,"avgSpellSec"),pens:avg(rs,"pensPerMatch")}));
  }
  world("naive (no discipline)",{});
  world("+discipline",{disc:true});
  world("+discipline +restarts",{disc:true,restarts:true});
  world("+parries (the full package)",{disc:true,restarts:true,parries:true});
  process.exit(0);
}
if(process.env.ZONE2==="1"){
  const BAL={tempo:.5,risk:.5,line:.5,press:.5,direct:.5,bunker:0};
  function wz(label,zoneRule,anticipate){
    const rs=[];
    for(let i=0;i<12;i++)rs.push(new Match({minutes:MIN,dribble:true,aerial:true,zoneRule,anticipate,
      teamFlags:[{tac:{...BAL}},{tac:{...BAL}},{tac:{...BAL}}]}).run());
    console.log(JSON.stringify({label,headers:avg(rs,"headersPerMin"),g:avg(rs,"goalsPerMin"),
      crosses:avg(rs,"crossesPerMin"),shots:avg(rs,"shotsPerMin"),pens:avg(rs,"pensPerMatch")}));
  }
  wz("no offside rule",false,false);
  wz("strict gate (shipped)",true,false);
  wz("timed runs (anticipate)",true,true);
  function wz2(label,duelR){
    const B2={tempo:.5,risk:.5,line:.5,press:.5,direct:.5,bunker:0};
    const rs=[];
    for(let i=0;i<12;i++)rs.push(new Match({minutes:MIN,dribble:true,aerial:true,
      zoneRule:true,anticipate:true,duelR,
      teamFlags:[{tac:{...B2}},{tac:{...B2}},{tac:{...B2}}]}).run());
    console.log(JSON.stringify({label,headers:avg(rs,"headersPerMin"),g:avg(rs,"goalsPerMin"),
      pens:avg(rs,"pensPerMatch")}));
  }
  wz2("timed runs + duelR 62",62);
  wz2("timed runs + duelR 72",72);
  process.exit(0);
}
if(process.env.FOULCHK==="1"){
  const BAL={tempo:.5,risk:.5,line:.5,press:.5,direct:.5,bunker:0};
  function w2(label,tac){
    const rs=[];
    for(let i=0;i<10;i++)rs.push(new Match({minutes:MIN,dribble:true,aerial:true,
      teamFlags:[{tac:{...tac}},{tac:{...tac}},{tac:{...tac}}]}).run());
    console.log(JSON.stringify({label,fouls:avg(rs,"foulsPerMin"),pens:avg(rs,"pensPerMatch"),
      g:avg(rs,"goalsPerMin"),tackles:avg(rs,"tacklesPerMin")}));
  }
  w2("balanced",BAL);
  w2("all-Gegenpress",{...BAL,line:.8,press:.95});
  w2("all-passive",{...BAL,press:.1});
  process.exit(0);
}
if(process.env.H2H==="1"){
  // COUNTER matrix: attack identity (team A) vs defense identity (team B), third team neutral.
  // Cell = % of matches A finishes above B. 50 = neutral, >50 = attack beats that defense.
  const ATK={
    TikiTaka:   {tempo:.9, risk:.3,  direct:.15},
    RouteOne:   {tempo:.3, risk:.7,  direct:.95},
    Swashbuckle:{tempo:.8, risk:.95, direct:.5 },
    Probe:      {tempo:.35,risk:.25, direct:.3 },
  };
  const DEF={
    Gegenpress: {line:.8, press:.95, bunker:0},
    ParkTheBus: {line:.15,press:.2,  bunker:1},
    Trap:       {line:.35,press:.6,  bunker:0},
    BalancedD:  {line:.5, press:.5,  bunker:0},
  };
  const BAL={tempo:.5,risk:.5,line:.5,press:.5,direct:.5,bunker:0};
  const perRot=parseInt(process.env.PERROT||"10");
  const PART=parseInt(process.env.PART||"0");
  const pairs=[];
  for(const an in ATK)for(const dn in DEF)pairs.push([an,dn]);
  const slice=PART===1?pairs.slice(0,8):PART===2?pairs.slice(8):pairs;
  console.log("attack vs defense".padEnd(30),"A-beats-B% (chance 50)");
  for(const [an,dn] of slice){
    let aWins=0,games=0;
    for(let rot=0;rot<3;rot++)for(let i=0;i<perRot;i++){
      const posA=rot, posB=(rot+1)%3;
      const tf=[{tac:{...BAL}},{tac:{...BAL}},{tac:{...BAL}}];
      tf[posA]={tac:{...BAL,...ATK[an]}};
      tf[posB]={tac:{...BAL,...DEF[dn]}};
      const m=new Match({minutes:MIN,dribble:true,aerial:true,teamFlags:tf});m.run();
      if(m.rankCmp(posA,posB)<0)aWins++;   // A ranks above B
      games++;
    }
    console.log((an+" vs "+dn).padEnd(30),+(100*aWins/games).toFixed(1));
  }
  process.exit(0);
}
if(process.env.PRESETS==="1"){
  const ATK={
    TikiTaka:   {tempo:.9, risk:.3,  direct:.15},
    RouteOne:   {tempo:.3, risk:.7,  direct:.95},
    Swashbuckle:{tempo:.8, risk:.95, direct:.5 },
    Probe:      {tempo:.35,risk:.25, direct:.3 },
  };
  const DEF={
    Gegenpress: {line:.8, press:.95, bunker:0},
    ParkTheBus: {line:.15,press:.2,  bunker:1},
    Trap:       {line:.35,press:.6,  bunker:0},
    BalancedD:  {line:.5, press:.5,  bunker:0},
  };
  const BAL={tempo:.5,risk:.5,line:.5,press:.5,direct:.5,bunker:0};
  const perRot=parseInt(process.env.PERROT||"8");
  const PART=parseInt(process.env.PART||"0"); // 0=all, 1=first 8 pairings, 2=last 8
  console.log("pairing".padEnd(26),"win%","(chance 33.3)");
  const grid={};
  const pairs=[];
  for(const an in ATK)for(const dn in DEF)pairs.push([an,dn]);
  const slice=PART===1?pairs.slice(0,8):PART===2?pairs.slice(8):pairs;
  for(const [an,dn] of slice){
    const tac={...BAL,...ATK[an],...DEF[dn]};
    let wins=0,games=0;
    for(let rot=0;rot<3;rot++)for(let i=0;i<perRot;i++){
      const tf=[{tac:{...BAL}},{tac:{...BAL}},{tac:{...BAL}}];
      tf[rot]={tac:{...tac}};
      const m=new Match({minutes:MIN,dribble:true,aerial:true,teamFlags:tf});m.run();
      const order=[0,1,2].sort((a,b)=>m.rankCmp(a,b));
      if(order[0]===rot)wins++;games++;
    }
    const w=+(100*wins/games).toFixed(1);
    grid[an+"+"+dn]=w;
    console.log((an+"+"+dn).padEnd(26),w);
  }
  process.exit(0);
}
if(process.env.DIALS==="1"){
  function world(label,tac){
    const rs=[];
    for(let i=0;i<N;i++)rs.push(new Match({minutes:MIN,dribble:true,aerial:true,
      teamFlags:[{tac:{...tac}},{tac:{...tac}},{tac:{...tac}}]}).run());
    console.log(JSON.stringify({label,g:avg(rs,"goalsPerMin"),shots:avg(rs,"shotsPerMin"),
      passOk:avg(rs,"passOkPerMin"),tackles:avg(rs,"tacklesPerMin"),
      crosses:avg(rs,"crossesPerMin"),turnovers:avg(rs,"turnoversPerMin"),spell:avg(rs,"avgSpellSec")}));
  }
  const B={tempo:.5,risk:.5,line:.5,press:.5,direct:.5,bunker:0};
  world("BALANCED (all .5)",B);
  world("tempo LO",{...B,tempo:0});   world("tempo HI",{...B,tempo:1});
  world("risk LO",{...B,risk:0});     world("risk HI",{...B,risk:1});
  world("press LO",{...B,press:0});   world("press HI",{...B,press:1});
  world("direct LO",{...B,direct:0}); world("direct HI",{...B,direct:1});
  world("line LO",{...B,line:0});     world("line HI",{...B,line:1});
  world("BUNKER all",{...B,bunker:1});
  process.exit(0);
}
if(process.env.AERIAL==="1"){
  function suiteA(label,aerial){
    const rs=[];
    for(let i=0;i<N;i++)rs.push(new Match({minutes:MIN,dribble:true,aerial,
      teamFlags:[{aware:false,plays:true},{aware:false,plays:true},{aware:false,plays:true}]}).run());
    console.log(JSON.stringify({label,goalsPerMin:avg(rs,"goalsPerMin"),own:avg(rs,"ownPerMatch"),
      turnovers:avg(rs,"turnoversPerMin"),headers:avg(rs,"headersPerMin"),crosses:avg(rs,"crossesPerMin"),
      passOk:avg(rs,"passOkPerMin"),shots:avg(rs,"shotsPerMin"),saves:avg(rs,"savesPerMin")}));
  }
  suiteA("dribble+plays (ground only)",false);
  suiteA("dribble+plays +AERIAL",true);
  process.exit(0);
}
console.log("=== PERMUTATIONS (same features for all teams) ===");
if(FOCUS){
  suite("aware-world (marking, no offense)",{aware:true,plays:false,offense:false},false,N,MIN);
  suite("aware+offense world (marking)",{aware:true,plays:false,offense:true},false,N,MIN);
  suite("ALL (marking)",{aware:true,plays:true,offense:true},true,N,MIN);
  function duelIn2(label,baseFlags,upFlags,dribble,perRot){
    let wins=0,games=0;
    for(let rot=0;rot<3;rot++)for(let i=0;i<perRot;i++){
      const tf=[{...baseFlags},{...baseFlags},{...baseFlags}];
      tf[rot]={...upFlags};
      const m=new Match({minutes:MIN,dribble,teamFlags:tf});m.run();
      const order=[0,1,2].sort((a,b)=>m.rankCmp(a,b));
      if(order[0]===rot)wins++;games++;
    }
    console.log(JSON.stringify({label,games,upgradedWinPct:+(100*wins/games).toFixed(1),chance:33.3}));
  }
  duelIn2("offense-vs-marking-bunkers",{aware:true,plays:false,offense:false},{aware:true,plays:false,offense:true},false,30);
  duelIn2("offense+plays-vs-marking-bunkers",{aware:true,plays:false,offense:false},{aware:true,plays:true,offense:true},false,30);
  process.exit(0);
}
const combos=[
  ["base",            {aware:false,plays:false},false],
  ["aware",           {aware:true, plays:false},false],
  ["plays",           {aware:false,plays:true },false],
  ["dribble",         {aware:false,plays:false},true ],
  ["aware+plays",     {aware:true, plays:true },false],
  ["aware+dribble",   {aware:true, plays:false},true ],
  ["plays+dribble",   {aware:false,plays:true },true ],
  ["all",             {aware:true, plays:true },true ],
];
const results=combos.map(c=>suite(c[0],c[1],c[2],N,MIN));

console.log("=== SMART vs DUMB (one team upgraded, 3 rotations) ===");
function duel(label,upFlags,dribble,perRot){
  const wins=[0,0]; // [upgraded, others best]
  let games=0;
  for(let rot=0;rot<3;rot++){
    for(let i=0;i<perRot;i++){
      const tf=[{aware:false,plays:false},{aware:false,plays:false},{aware:false,plays:false}];
      tf[rot]={...upFlags};
      const m=new Match({minutes:MIN,dribble,teamFlags:tf});
      m.run();
      const order=[0,1,2].sort((a,b)=>m.rankCmp(a,b));
      if(order[0]===rot)wins[0]++;
      games++;
    }
  }
  console.log(JSON.stringify({label,games,upgradedWinPct:+(100*wins[0]/games).toFixed(1),chance:33.3}));
}
duel("aware-vs-base",{aware:true,plays:false},false,30);
duel("plays-vs-base",{aware:false,plays:true},false,30);
duel("aware+plays-vs-base",{aware:true,plays:true},false,30);

console.log("=== OFFENSE EXPERIMENTS ===");
// world A: everyone bunkers (aware), nobody schemes — the low-scoring world
suite("aware-world (no offense)",{aware:true,plays:false,offense:false},false,N,MIN);
// world B: everyone bunkers AND everyone schemes — does craft restore goals?
suite("aware+offense world",{aware:true,plays:false,offense:true},false,N,MIN);
// world C: the full package
suite("ALL: aware+plays+offense+dribble",{aware:true,plays:true,offense:true},true,N,MIN);

// duel: in a bunkered world, one team learns offense — does craft beat the siege?
function duelIn(label,baseFlags,upFlags,dribble,perRot){
  const wins=[0];let games=0;
  for(let rot=0;rot<3;rot++)for(let i=0;i<perRot;i++){
    const tf=[{...baseFlags},{...baseFlags},{...baseFlags}];
    tf[rot]={...upFlags};
    const m=new Match({minutes:MIN,dribble,teamFlags:tf});m.run();
    const order=[0,1,2].sort((a,b)=>m.rankCmp(a,b));
    if(order[0]===rot)wins[0]++;games++;
  }
  console.log(JSON.stringify({label,games,upgradedWinPct:+(100*wins[0]/games).toFixed(1),chance:33.3}));
}
duelIn("offense-in-aware-world",{aware:true,plays:false,offense:false},{aware:true,plays:false,offense:true},false,30);
