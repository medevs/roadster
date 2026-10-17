ab(){ agent-browser "$@"; }
st(){ ab eval "(()=>{const p=__chassis.translation();return [__S.t.toFixed(2),'y',p.y.toFixed(2),'z',p.z.toFixed(1),'x',p.x.toFixed(1),'v',(__S.speed*3.6).toFixed(0),'g',__S.g.toFixed(2),'air',__S.air.toFixed(0),'wd',__S.wheelsDown].join(' ')})()"; }
ab open http://localhost:5179 >/dev/null; sleep 3
echo rest; st
ab eval "__keys.add('KeyW');1" >/dev/null; sleep 1; echo "1s W"; st; sleep 1; echo "2s"; st
ab eval "document.getElementById('toast').textContent" ; sleep 2; st
ab eval "__keys.add('ShiftLeft');1" >/dev/null; sleep 1; echo "boost 1s"; st; sleep 1.5; st
ab eval "__keys.delete('ShiftLeft');1" >/dev/null; sleep 4; echo "W only"; st
ab eval "__keys.clear();__keys.add('KeyS');1" >/dev/null; sleep 2; echo brake; st
