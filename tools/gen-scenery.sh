#!/bin/bash
# Generates trees and horizon backdrops with Pixellab (needs PIXELLAB_API_KEY).
PL="python3 $(dirname $0)/pl.py"
T='{"no_background":true,"view":"side","outline":"single color black outline","shading":"medium shading","detail":"highly detailed"'
tree() { $PL pixflux "$2, single tree standing on its own, trunk at the bottom centre, full tree visible, 16-bit pixel art game sprite" 96 128 tree-$1.png "$T,\"seed\":${3:-7}}"; }
tree oak "large round broad-leaved oak tree, rich green foliage" 7 &
tree oak2 "tall summer elm tree, dark green leafy canopy" 12 &
tree autumn "maple tree in autumn with orange and red leaves" 5 &
tree pine "tall scots pine tree with bare reddish trunk and dark green clumps of needles at the top" 9 &
tree fir "tall dark green conifer fir tree, conical shape" 4 &
tree birch "silver birch tree with white bark and light green leaves" 8 &
wait
tree palm "tall tropical palm tree with curved trunk and coconut fronds" 6 &
tree cactus "tall saguaro cactus with two arms" 3 &
tree poplar "tall slim lombardy poplar tree, columnar green" 2 &
tree willow "weeping willow tree with drooping green branches" 11 &
tree snowpine "snow covered alpine spruce tree" 10 &
$PL pixflux "small round gorse bush with yellow flowers" 64 48 bush-gorse.png "$T,\"seed\":3}" &
wait
$PL pixflux "dense round green shrub bush" 64 48 bush-green.png "$T,\"seed\":5}" &
$PL pixflux "clump of purple heather and long grass" 64 48 bush-heather.png "$T,\"seed\":5}" &
$PL pixflux "desert scrub bush, dry sage brush" 64 48 bush-scrub.png "$T,\"seed\":5}" &
$PL pixflux "golf flag pin, thin white pole with a small red triangular flag at the top" 32 96 flag.png "$T,\"seed\":2}" &
wait
