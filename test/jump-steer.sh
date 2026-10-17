# Checks: steering direction (A = left = +X), wheel spin sign, five-car jump with lift thrusters.
ab(){ agent-browser "$@"; }
ab open http://localhost:5179 >/dev/null; sleep 3
ab eval "__chassis.setLinvel({x:0,y:0,z:15},true);__keys.add('KeyA');__keys.add('KeyW');window.__r0=null;1" >/dev/null
ab eval "1" >/dev/null; sleep 1
ab eval "__keys.clear();'steer A -> x='+__chassis.translation().x.toFixed(2)+' (want >0)'"
ab eval "__once.add('KeyT');1" >/dev/null; sleep 0.5
ab eval "__keys.add('KeyW');window.__log=[];setInterval(()=>{const p=__chassis.translation();if(p.z>80&&p.z<150)__log.push([p.z.toFixed(0),p.y.toFixed(1),(__S.speed*3.6).toFixed(0)].join('/'))},150);1" >/dev/null
ab eval "setInterval(()=>{const z=__chassis.translation().z; if(z>88&&z<135)__keys.add('Space'); else __keys.delete('Space'); if(__S.speed>28)__keys.delete('KeyW'); else __keys.add('KeyW')},20);1" >/dev/null
sleep 24
ab eval "__log.join(' ')"
