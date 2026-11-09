#!/bin/bash
PL="python3 $(dirname $0)/pl.py"
B='{"view":"side","shading":"medium shading","detail":"highly detailed","outline":"lineless"'
bd() { $PL pixflux "wide panoramic landscape horizon, $2, clear blue sky above, flat horizon line at the bottom, no foreground, 16-bit pixel art game background" 400 100 backdrop-$1.png "$B,\"seed\":${3:-4}}"; }
bd parkland "gentle rolling green hills with hedgerows and a distant church spire and woods" &
bd links "grey-blue sea with a lighthouse on a headland and pale sand dunes with marram grass" &
bd desert "red sandstone mesas and buttes in a hot desert" &
bd heathland "low hills covered in purple heather and dark pine woods" &
wait
bd alpine "jagged snow-capped mountain peaks above pine forests" &
bd tropical "turquoise sea with green volcanic island peaks and palm trees" &
bd woodland "deep forested hills of oak and beech trees" &
bd stadium "modern city skyline with tall towers behind grandstands" &
wait
