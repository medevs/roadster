ab(){ agent-browser "$@"; }
st(){ ab eval "(()=>{const p=__chassis.translation(),r=__chassis.rotation();return [__S.t.toFixed(2),'y',p.y.toFixed(2),'z',p.z.toFixed(1),'v',(__S.speed*3.6).toFixed(0),'air',__S.air.toFixed(0),'wd',__S.wheelsDown,'q',[r.x,r.y,r.z,r.w].map(a=>a.toFixed(2)).join(','),document.getElementById('toast').textContent].join(' ')})()"; }
ab open http://localhost:5179 >/dev/null; sleep 3
ab eval "__keys.add('Space');1" >/dev/null; sleep 1.2; echo "lift"; st; ab screenshot shots/fly1.png >/dev/null; sleep 1; st
ab eval "__keys.add('KeyD');1" >/dev/null; sleep 1; echo "roll"; st; ab screenshot shots/fly2.png >/dev/null
ab eval "__keys.clear();1" >/dev/null; sleep 4; echo "fall"; st
