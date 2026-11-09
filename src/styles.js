// How each course style looks from the golfer's eyes: ground colours, which
// trees and bushes grow, the horizon backdrop and the haze in the distance.

const BASE_GROUND = {
  fairway: [96, 172, 64], rough: [60, 128, 46], green: [116, 200, 84], fringe: [100, 184, 70],
  tee: [104, 186, 72], bunker: [236, 216, 160], water: [52, 112, 196], waste: [198, 178, 124],
  trees: [42, 92, 38], copse: [42, 92, 38], sea: [44, 98, 176], beach: [232, 212, 162], oob: [36, 78, 34],
};

export const LOOKS = {
  parkland: {
    ground: {},
    trees: [['tree-oak', 4, 14], ['tree-oak2', 3, 15], ['tree-birch', 1, 12], ['tree-willow', 1, 11]],
    bushes: [['bush-green', 1, 1.6]], haze: [196, 222, 236],
  },
  links: {
    ground: { fairway: [150, 174, 88], rough: [128, 142, 76], green: [128, 186, 86], fringe: [140, 180, 86], tee: [140, 178, 86],
      trees: [118, 124, 70], copse: [104, 118, 62], waste: [208, 194, 140], oob: [112, 118, 66] },
    trees: [['bush-gorse', 5, 2.2], ['bush-green', 2, 2.0], ['tree-fir', 1, 9]],
    bushes: [['bush-gorse', 2, 1.8]], haze: [206, 220, 228], sparse: true,
  },
  desert: {
    ground: { rough: [182, 150, 96], trees: [196, 136, 86], copse: [186, 128, 80], waste: [214, 166, 112], oob: [190, 130, 82],
      fairway: [104, 170, 70], green: [116, 196, 82] },
    trees: [['tree-cactus', 4, 7], ['bush-scrub', 4, 1.6], ['tree-palm', 1, 13]],
    bushes: [['bush-scrub', 2, 1.4]], haze: [236, 214, 190], sparse: true,
  },
  heathland: {
    ground: { rough: [104, 126, 60], trees: [96, 76, 92], copse: [90, 72, 88], oob: [80, 66, 78], fairway: [108, 170, 70] },
    trees: [['tree-pine', 4, 17], ['tree-birch', 2, 12], ['bush-heather', 3, 1.4], ['bush-gorse', 1, 1.8]],
    bushes: [['bush-heather', 2, 1.3]], haze: [206, 214, 230],
  },
  alpine: {
    ground: { fairway: [92, 176, 74], rough: [64, 136, 58], trees: [44, 86, 52], copse: [44, 86, 52], oob: [40, 76, 48] },
    trees: [['tree-fir', 4, 17], ['tree-snowpine', 2, 16], ['tree-pine', 1, 18]],
    bushes: [], haze: [204, 226, 244],
  },
  tropical: {
    ground: { fairway: [88, 184, 72], rough: [56, 144, 52], green: [108, 210, 88], water: [40, 168, 196], sea: [34, 150, 190], beach: [240, 226, 176] },
    trees: [['tree-palm', 5, 15], ['bush-green', 2, 2.0], ['tree-oak2', 1, 13]],
    bushes: [['bush-green', 1, 1.6]], haze: [200, 232, 240],
  },
  woodland: {
    ground: { rough: [52, 116, 42], trees: [36, 76, 32], copse: [36, 76, 32], oob: [30, 64, 28] },
    trees: [['tree-oak2', 4, 16], ['tree-oak', 3, 15], ['tree-autumn', 2, 13], ['tree-fir', 2, 17]],
    bushes: [['bush-green', 1, 1.6]], haze: [192, 214, 222],
  },
  stadium: {
    ground: { fairway: [92, 178, 68], green: [114, 206, 86], waste: [210, 200, 170] },
    trees: [['tree-poplar', 3, 17], ['tree-oak', 2, 14], ['tree-palm', 1, 14]],
    bushes: [['bush-green', 1, 1.5]], haze: [200, 216, 232],
  },
};

export function lookFor(style) {
  const look = LOOKS[style] ?? LOOKS.parkland;
  return { ...look, ground: { ...BASE_GROUND, ...look.ground } };
}

// Nice names for the setup screen.
export const STYLE_NAMES = {
  parkland: 'PARKLAND', links: 'LINKS', desert: 'DESERT', heathland: 'HEATHLAND',
  alpine: 'ALPINE', tropical: 'TROPICAL', woodland: 'WOODLAND', stadium: 'STADIUM',
};
