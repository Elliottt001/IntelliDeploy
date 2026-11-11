export type FigmaNodeId = `${number}:${number}`;
export type MobilePrimitiveKey =
  | 'settings' | 'back' | 'share' | 'search' | 'bell'
  | 'microphone' | 'send' | 'arrowRight'
  | 'home' | 'store' | 'community' | 'products'
  | 'brandMark' | 'circleAction' | 'bottomNav' | 'glassCard';

export type FigmaVectorLayer = {
  sourceNodeId: FigmaNodeId;
  path: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeLinecap?: 'butt' | 'round' | 'square';
  strokeLinejoin?: 'miter' | 'round' | 'bevel';
  opacity: number;
  transform?: string;
};

export type FigmaPaintEvidence = {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL';
  color?: string;
  opacity: number;
  styleId?: string;
  variableIds: readonly string[];
};

export type FigmaEffectEvidence = {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  radius: number;
  color?: string;
  offset?: { x: number; y: number };
  styleId?: string;
};

export type FigmaOverrideEvidence = {
  guidPath: readonly FigmaNodeId[];
  property: string;
  value: string | number | boolean | null;
};

export type FigmaPrimitiveEvidence = {
  key: MobilePrimitiveKey;
  sourceKind: 'symbol' | 'node';
  sourceNodeIds: readonly FigmaNodeId[];
  instanceNodeIds: readonly FigmaNodeId[];
  symbolNodeId?: FigmaNodeId;
  noSymbolReason?: 'no-instance-or-symbol-in-audited-subtree';
  size: { width: number; height: number };
  geometry: readonly FigmaVectorLayer[];
  fills: readonly FigmaPaintEvidence[];
  strokes: readonly FigmaPaintEvidence[];
  effects: readonly FigmaEffectEvidence[];
  overrides: readonly FigmaOverrideEvidence[];
};

export const auditedMobilePrimitiveKeys = [
  "settings",
  "back",
  "share",
  "search",
  "bell",
  "microphone",
  "send",
  "arrowRight",
  "home",
  "store",
  "community",
  "products",
  "brandMark",
  "circleAction",
  "bottomNav",
  "glassCard"
] as const;

export const figmaComponentEvidence = {
  "settings": {
    "effects": [
      {
        "color": "#000000",
        "offset": {
          "x": 0,
          "y": 2.202899
        },
        "radius": 2.202899,
        "type": "BACKGROUND_BLUR"
      },
      {
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.202899
        },
        "radius": 3.304348,
        "type": "DROP_SHADOW"
      }
    ],
    "fills": [
      {
        "color": "#FFFFFF",
        "opacity": 0.2,
        "type": "SOLID",
        "variableIds": []
      }
    ],
    "geometry": [
      {
        "fill": "#FFFFFF",
        "opacity": 1,
        "path": "M33.043 16.522 C33.043 25.646 25.646 33.043 16.522 33.043 C7.397 33.043 0 25.646 0 16.522 C0 7.397 7.397 0 16.522 0 C25.646 0 33.043 7.397 33.043 16.522 Z",
        "sourceNodeId": "248:20524",
        "transform": "matrix(1 0 0 1 2 2.203)"
      },
      {
        "opacity": 1,
        "path": "M0.75 -1.5 C0.336 -1.5 0 -1.164 0 -0.75 C0 -0.336 0.336 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M12.25 0 C12.664 0 13 -0.336 13 -0.75 C13 -1.164 12.664 -1.5 12.25 -1.5 L12.25 -0.75 L12.25 0 Z M0.75 -0.75 L0.75 0 L12.25 0 L12.25 -0.75 L12.25 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "248:20528",
        "stroke": "#494A64",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(-1 0 0 -1 26 18)"
      },
      {
        "opacity": 1,
        "path": "M0.75 -1.5 C0.336 -1.5 0 -1.164 0 -0.75 C0 -0.336 0.336 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711 0 C8.125 0 8.461 -0.336 8.461 -0.75 C8.461 -1.164 8.125 -1.5 7.711 -1.5 L7.711 -0.75 L7.711 0 Z M0.75 -0.75 L0.75 0 L7.711 0 L7.711 -0.75 L7.711 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "248:20526",
        "stroke": "#494A64",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(-0.64 0.768 -0.768 -0.64 18.417 12)"
      },
      {
        "opacity": 1,
        "path": "M0.75 -1.5 C0.336 -1.5 0 -1.164 0 -0.75 C0 -0.336 0.336 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711 0 C8.125 0 8.461 -0.336 8.461 -0.75 C8.461 -1.164 8.125 -1.5 7.711 -1.5 L7.711 -0.75 L7.711 0 Z M0.75 -0.75 L0.75 0 L7.711 0 L7.711 -0.75 L7.711 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "248:20527",
        "stroke": "#494A64",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(-0.64 -0.768 -0.768 0.64 18.417 25.5)"
      },
      {
        "opacity": 1,
        "path": "M33.043 16.522 L31.391 16.522 C31.391 24.734 24.734 31.391 16.522 31.391 L16.522 33.043 L16.522 34.696 C26.559 34.696 34.696 26.559 34.696 16.522 L33.043 16.522 Z M16.522 33.043 L16.522 31.391 C8.31 31.391 1.652 24.734 1.652 16.522 L0 16.522 L-1.652 16.522 C-1.652 26.559 6.485 34.696 16.522 34.696 L16.522 33.043 Z M0 16.522 L1.652 16.522 C1.652 8.31 8.31 1.652 16.522 1.652 L16.522 0 L16.522 -1.652 C6.485 -1.652 -1.652 6.485 -1.652 16.522 L0 16.522 Z M16.522 0 L16.522 1.652 C24.734 1.652 31.391 8.31 31.391 16.522 L33.043 16.522 L34.696 16.522 C34.696 6.485 26.559 -1.652 16.522 -1.652 L16.522 0 Z",
        "sourceNodeId": "248:20524",
        "stroke": "#FFFFFF",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.652174,
        "transform": "matrix(1 0 0 1 2 2.203)"
      }
    ],
    "instanceNodeIds": [
      "266:21480"
    ],
    "key": "settings",
    "overrides": [
      {
        "guidPath": [
          "248:20524"
        ],
        "property": "prototypeInteractions",
        "value": "[{\"id\":{\"sessionID\":268,\"localID\":24335},\"event\":{\"interactionType\":\"ON_CLICK\"},\"actions\":[{\"transitionNodeID\":{\"sessionID\":168,\"localID\":6258},\"transitionType\":\"SLIDE_FROM_BOTTOM\",\"transitionDuration\":0.30000001192092896,\"easingType\":\"INOUT_CUBIC\",\"transitionShouldSmartAnimate\":false,\"connectionType\":\"INTERNAL_NODE\",\"navigationType\":\"NAVIGATE\",\"easingFunction\":[0.41999998688697815,0,0.5799999833106995,1],\"transitionResetScrollPosition\":false,\"transitionResetInteractiveComponents\":false,\"transitionResetVideoPosition\":false}],\"isDeleted\":false,\"stateManagementVersion\":1}]"
      }
    ],
    "size": {
      "height": 38,
      "width": 38
    },
    "sourceKind": "symbol",
    "sourceNodeIds": [
      "248:20524",
      "248:20526",
      "248:20527",
      "248:20528",
      "248:20538"
    ],
    "strokes": [
      {
        "color": "#494A64",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#494A64",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#494A64",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ],
    "symbolNodeId": "248:20538"
  },
  "back": {
    "effects": [
      {
        "color": "#000000",
        "offset": {
          "x": 0,
          "y": 2.202899
        },
        "radius": 2.202899,
        "type": "BACKGROUND_BLUR"
      },
      {
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.202899
        },
        "radius": 3.304348,
        "type": "DROP_SHADOW"
      }
    ],
    "fills": [
      {
        "color": "#FFFFFF",
        "opacity": 0.2,
        "type": "SOLID",
        "variableIds": []
      }
    ],
    "geometry": [
      {
        "fill": "#FFFFFF",
        "opacity": 1,
        "path": "M33.043 16.522 C33.043 25.646 25.646 33.043 16.522 33.043 C7.397 33.043 0 25.646 0 16.522 C0 7.397 7.397 0 16.522 0 C25.646 0 33.043 7.397 33.043 16.522 Z",
        "sourceNodeId": "845:3504",
        "transform": "matrix(1 0 0 1 2 2.203)"
      },
      {
        "opacity": 1,
        "path": "M0.75 -1.5 C0.336 -1.5 0 -1.164 0 -0.75 C0 -0.336 0.336 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M12.25 0 C12.664 0 13 -0.336 13 -0.75 C13 -1.164 12.664 -1.5 12.25 -1.5 L12.25 -0.75 L12.25 0 Z M0.75 -0.75 L0.75 0 L12.25 0 L12.25 -0.75 L12.25 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "845:3508",
        "stroke": "#494A64",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(-1 0 0 -1 26 18)"
      },
      {
        "opacity": 1,
        "path": "M0.75 -1.5 C0.336 -1.5 0 -1.164 0 -0.75 C0 -0.336 0.336 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711 0 C8.125 0 8.461 -0.336 8.461 -0.75 C8.461 -1.164 8.125 -1.5 7.711 -1.5 L7.711 -0.75 L7.711 0 Z M0.75 -0.75 L0.75 0 L7.711 0 L7.711 -0.75 L7.711 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "845:3506",
        "stroke": "#494A64",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(-0.64 0.768 -0.768 -0.64 18.417 12)"
      },
      {
        "opacity": 1,
        "path": "M0.75 -1.5 C0.336 -1.5 0 -1.164 0 -0.75 C0 -0.336 0.336 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711 0 C8.125 0 8.461 -0.336 8.461 -0.75 C8.461 -1.164 8.125 -1.5 7.711 -1.5 L7.711 -0.75 L7.711 0 Z M0.75 -0.75 L0.75 0 L7.711 0 L7.711 -0.75 L7.711 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "845:3507",
        "stroke": "#494A64",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(-0.64 -0.768 -0.768 0.64 18.417 25.5)"
      },
      {
        "opacity": 1,
        "path": "M33.043 16.522 L31.391 16.522 C31.391 24.734 24.734 31.391 16.522 31.391 L16.522 33.043 L16.522 34.696 C26.559 34.696 34.696 26.559 34.696 16.522 L33.043 16.522 Z M16.522 33.043 L16.522 31.391 C8.31 31.391 1.652 24.734 1.652 16.522 L0 16.522 L-1.652 16.522 C-1.652 26.559 6.485 34.696 16.522 34.696 L16.522 33.043 Z M0 16.522 L1.652 16.522 C1.652 8.31 8.31 1.652 16.522 1.652 L16.522 0 L16.522 -1.652 C6.485 -1.652 -1.652 6.485 -1.652 16.522 L0 16.522 Z M16.522 0 L16.522 1.652 C24.734 1.652 31.391 8.31 31.391 16.522 L33.043 16.522 L34.696 16.522 C34.696 6.485 26.559 -1.652 16.522 -1.652 L16.522 0 Z",
        "sourceNodeId": "845:3504",
        "stroke": "#FFFFFF",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.652174,
        "transform": "matrix(1 0 0 1 2 2.203)"
      }
    ],
    "instanceNodeIds": [],
    "key": "back",
    "noSymbolReason": "no-instance-or-symbol-in-audited-subtree",
    "overrides": [],
    "size": {
      "height": 38,
      "width": 38
    },
    "sourceKind": "node",
    "sourceNodeIds": [
      "845:3503",
      "845:3504",
      "845:3505",
      "845:3506",
      "845:3507",
      "845:3508"
    ],
    "strokes": [
      {
        "color": "#494A64",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#494A64",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#494A64",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ]
  },
  "share": {
    "effects": [
      {
        "color": "#000000",
        "offset": {
          "x": 0,
          "y": 2.202899
        },
        "radius": 2.202899,
        "type": "BACKGROUND_BLUR"
      },
      {
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.202899
        },
        "radius": 3.304348,
        "type": "DROP_SHADOW"
      }
    ],
    "fills": [
      {
        "color": "#494A64",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 0.2,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ],
    "geometry": [
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M8.534 2.839 C8.534 1.271 9.806 0 11.374 0 C12.686 -0.007 13.832 0.885 14.147 2.16 C14.461 3.434 13.861 4.757 12.696 5.361 C11.531 5.964 10.104 5.691 9.244 4.699 L5.631 6.502 C5.715 6.895 5.715 7.302 5.631 7.695 L9.244 9.498 C10.152 8.468 11.667 8.236 12.843 8.946 C14.018 9.656 14.516 11.106 14.026 12.389 C13.537 13.671 12.199 14.42 10.85 14.167 C9.5 13.914 8.525 12.731 8.534 11.358 C8.534 11.157 8.555 10.957 8.598 10.762 L4.985 8.958 C4.209 9.854 2.957 10.173 1.847 9.759 C0.736 9.345 0 8.284 0 7.099 C0 5.913 0.736 4.853 1.847 4.438 C2.957 4.024 4.209 4.343 4.985 5.239 L8.598 3.436 C8.555 3.24 8.534 3.04 8.534 2.839 Z M12.793 2.84 C12.793 2.056 12.158 1.42 11.374 1.42 C10.59 1.42 9.954 2.056 9.954 2.84 C9.954 3.624 10.59 4.259 11.374 4.259 C12.158 4.259 12.793 3.624 12.793 2.84 Z M2.855 5.679 C3.639 5.679 4.275 6.315 4.275 7.099 C4.275 7.883 3.639 8.519 2.855 8.519 C2.071 8.519 1.436 7.883 1.436 7.099 C1.436 6.315 2.071 5.679 2.855 5.679 Z M12.793 11.358 C12.793 10.574 12.158 9.938 11.374 9.938 C10.59 9.938 9.954 10.574 9.954 11.358 C9.954 12.142 10.59 12.778 11.374 12.778 C12.158 12.778 12.793 12.142 12.793 11.358 Z",
        "sourceNodeId": "845:3513",
        "transform": "matrix(1 0 0 1 10.404 12.42)"
      },
      {
        "fill": "#FFFFFF",
        "opacity": 1,
        "path": "M33.043 16.522 C33.043 25.646 25.646 33.043 16.522 33.043 C7.397 33.043 0 25.646 0 16.522 C0 7.397 7.397 0 16.522 0 C25.646 0 33.043 7.397 33.043 16.522 Z",
        "sourceNodeId": "845:3511",
        "transform": "matrix(1 0 0 1 2 2.203)"
      },
      {
        "opacity": 1,
        "path": "M33.043 16.522 L31.391 16.522 C31.391 24.734 24.734 31.391 16.522 31.391 L16.522 33.043 L16.522 34.696 C26.559 34.696 34.696 26.559 34.696 16.522 L33.043 16.522 Z M16.522 33.043 L16.522 31.391 C8.31 31.391 1.652 24.734 1.652 16.522 L0 16.522 L-1.652 16.522 C-1.652 26.559 6.485 34.696 16.522 34.696 L16.522 33.043 Z M0 16.522 L1.652 16.522 C1.652 8.31 8.31 1.652 16.522 1.652 L16.522 0 L16.522 -1.652 C6.485 -1.652 -1.652 6.485 -1.652 16.522 L0 16.522 Z M16.522 0 L16.522 1.652 C24.734 1.652 31.391 8.31 31.391 16.522 L33.043 16.522 L34.696 16.522 C34.696 6.485 26.559 -1.652 16.522 -1.652 L16.522 0 Z",
        "sourceNodeId": "845:3511",
        "stroke": "#FFFFFF",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.652174,
        "transform": "matrix(1 0 0 1 2 2.203)"
      }
    ],
    "instanceNodeIds": [],
    "key": "share",
    "noSymbolReason": "no-instance-or-symbol-in-audited-subtree",
    "overrides": [],
    "size": {
      "height": 38,
      "width": 38
    },
    "sourceKind": "node",
    "sourceNodeIds": [
      "845:3510",
      "845:3511",
      "845:3512",
      "845:3513"
    ],
    "strokes": [
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ]
  },
  "search": {
    "effects": [],
    "fills": [
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ],
    "geometry": [
      {
        "opacity": 1,
        "path": "M0 0 L12 0 L12 12 L0 12 L0 0 Z",
        "sourceNodeId": "270:26625"
      },
      {
        "opacity": 1,
        "path": "M2.15 2.15 L2.504 1.796 L0.354 -0.354 L0 0 L-0.354 0.354 L1.796 2.504 L2.15 2.15 Z",
        "sourceNodeId": "270:26627",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1,
        "transform": "matrix(1 0 0 1 8.35 8.35)"
      },
      {
        "opacity": 1,
        "path": "M8 4 L7.5 4 C7.5 5.933 5.933 7.5 4 7.5 L4 8 L4 8.5 C6.485 8.5 8.5 6.485 8.5 4 L8 4 Z M4 8 L4 7.5 C2.067 7.5 0.5 5.933 0.5 4 L0 4 L-0.5 4 C-0.5 6.485 1.515 8.5 4 8.5 L4 8 Z M0 4 L0.5 4 C0.5 2.067 2.067 0.5 4 0.5 L4 0 L4 -0.5 C1.515 -0.5 -0.5 1.515 -0.5 4 L0 4 Z M4 0 L4 0.5 C5.933 0.5 7.5 2.067 7.5 4 L8 4 L8.5 4 C8.5 1.515 6.485 -0.5 4 -0.5 L4 0 Z",
        "sourceNodeId": "270:26626",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1,
        "transform": "matrix(1 0 0 1 1.5 1.5)"
      }
    ],
    "instanceNodeIds": [],
    "key": "search",
    "noSymbolReason": "no-instance-or-symbol-in-audited-subtree",
    "overrides": [],
    "size": {
      "height": 12,
      "width": 12
    },
    "sourceKind": "node",
    "sourceNodeIds": [
      "270:26625",
      "270:26626",
      "270:26627"
    ],
    "strokes": [
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ]
  },
  "bell": {
    "effects": [],
    "fills": [
      {
        "color": "#000000",
        "opacity": 0.0001,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#7C62FF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ],
    "geometry": [
      {
        "fill": "#000000",
        "opacity": 1,
        "path": "M0 0 L15 0 L15 15 L0 15 L0 0 Z",
        "sourceNodeId": "825:6483"
      },
      {
        "fill": "#7C62FF",
        "opacity": 1,
        "path": "M5.626 0.005 C4.616 -0.046 3.633 0.333 2.918 1.047 C2.204 1.762 1.825 2.745 1.876 3.755 L1.876 5.63 C1.876 5.83 1.769 5.967 1.426 6.255 L1.176 6.492 C0.425 6.997 -0.018 7.85 0.001 8.755 C0.001 9.598 0.663 9.898 1.682 10.005 L2.501 10.005 L8.751 10.005 L9.569 10.005 C10.588 9.917 11.251 9.617 11.251 8.755 C11.268 7.843 10.827 6.984 10.076 6.467 L9.807 6.255 C9.463 5.973 9.376 5.83 9.376 5.63 L9.376 3.755 C9.426 2.745 9.048 1.762 8.333 1.047 C7.618 0.333 6.635 -0.046 5.626 0.005 Z M5.626 1.254 C6.303 1.203 6.969 1.45 7.449 1.931 C7.93 2.411 8.177 3.077 8.126 3.754 L8.126 5.629 C8.137 6.271 8.467 6.864 9.007 7.211 L9.301 7.448 C9.709 7.711 9.969 8.151 10.001 8.636 C9.829 8.692 9.65 8.726 9.469 8.736 L8.769 8.736 L2.501 8.736 L1.801 8.736 C1.613 8.728 1.428 8.694 1.251 8.636 C1.278 8.155 1.531 7.715 1.932 7.448 L2.207 7.211 C2.761 6.873 3.106 6.278 3.126 5.629 L3.126 3.754 C3.074 3.077 3.321 2.411 3.802 1.931 C4.282 1.45 4.948 1.203 5.626 1.254 Z M5.626 11.254 C5.266 11.252 4.924 11.095 4.688 10.823 C4.549 10.631 4.314 10.534 4.08 10.573 C3.846 10.611 3.654 10.779 3.584 11.005 C3.514 11.232 3.579 11.478 3.751 11.642 C4.219 12.19 4.904 12.505 5.626 12.504 C6.342 12.507 7.024 12.202 7.501 11.667 C7.71 11.406 7.678 11.027 7.427 10.806 C7.176 10.585 6.795 10.601 6.563 10.842 C6.324 11.107 5.983 11.257 5.626 11.254 Z",
        "sourceNodeId": "825:6484",
        "transform": "matrix(1 0 0 1 1.874 1.246)"
      }
    ],
    "instanceNodeIds": [],
    "key": "bell",
    "noSymbolReason": "no-instance-or-symbol-in-audited-subtree",
    "overrides": [],
    "size": {
      "height": 15,
      "width": 15
    },
    "sourceKind": "node",
    "sourceNodeIds": [
      "825:6482",
      "825:6483",
      "825:6484"
    ],
    "strokes": []
  },
  "microphone": {
    "effects": [],
    "fills": [
      {
        "color": "#7F80A1",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": [
          "170:6429"
        ]
      }
    ],
    "geometry": [
      {
        "fill": "#7F80A1",
        "opacity": 1,
        "path": "M8.002 0 C5.241 0 3.002 2.239 3.002 5 L3.002 9 C3.002 11.761 5.241 14 8.002 14 C10.763 14 13.002 11.761 13.002 9 L13.002 5 C13.002 2.239 10.763 0 8.002 0 Z M8.002 2 C9.659 2 11.002 3.343 11.002 5 L11.002 9 C11.002 10.657 9.659 12 8.002 12 C6.345 12 5.002 10.657 5.002 9 L5.002 5 C5.002 3.343 6.345 2 8.002 2 Z M8.002 16 C5.479 16.026 3.137 14.693 1.872 12.51 C1.75 12.265 1.534 12.081 1.272 12 C1.012 11.94 0.738 11.987 0.512 12.13 C0.279 12.26 0.108 12.478 0.036 12.736 C-0.035 12.993 0 13.268 0.132 13.5 C1.579 15.995 4.133 17.646 7.002 17.94 L7.002 19 C7.002 19.552 7.45 20 8.002 20 C8.555 20 9.002 19.552 9.002 19 L9.002 17.94 C11.862 17.628 14.406 15.981 15.862 13.5 C16.124 13.032 15.969 12.441 15.512 12.16 C15.284 12.018 15.007 11.973 14.746 12.037 C14.484 12.101 14.259 12.268 14.122 12.5 C12.849 14.672 10.519 16.004 8.002 16 Z",
        "sourceNodeId": "845:3535"
      }
    ],
    "instanceNodeIds": [],
    "key": "microphone",
    "noSymbolReason": "no-instance-or-symbol-in-audited-subtree",
    "overrides": [],
    "size": {
      "height": 20,
      "width": 15.98938
    },
    "sourceKind": "node",
    "sourceNodeIds": [
      "845:3535"
    ],
    "strokes": []
  },
  "send": {
    "effects": [
      {
        "color": "#939393",
        "offset": {
          "x": 0,
          "y": 4
        },
        "radius": 10,
        "type": "DROP_SHADOW"
      }
    ],
    "fills": [
      {
        "color": "#D9D9D9",
        "opacity": 0.1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "opacity": 1,
        "type": "GRADIENT_LINEAR",
        "variableIds": []
      }
    ],
    "geometry": [
      {
        "fill": "#D9D9D9",
        "opacity": 1,
        "path": "M0 20 C0 8.954 8.954 0 20 0 L20 0 C31.046 0 40 8.954 40 20 L40 20 C40 31.046 31.046 40 20 40 L20 40 C8.954 40 0 31.046 0 20 L0 20 Z",
        "sourceNodeId": "845:3539"
      },
      {
        "fill": "#FFFFFF",
        "opacity": 1,
        "path": "M8.482 0.456 C9.073 0.164 9.722 0.009 10.381 0 C11.956 0.032 12.601 1.436 11.627 3.575 L7.932 11.111 C7.299 12.541 5.958 12.376 5.642 10.87 L4.851 7.276 L1.25 6.485 C-0.293 6.144 -0.433 4.834 0.972 4.151 L8.482 0.456 Z M10.482 3.063 C11.083 1.734 10.962 1.145 10.121 1.266 L10.121 1.247 C9.75 1.319 9.392 1.445 9.058 1.62 L1.56 5.239 L5.496 6.106 C5.732 6.16 5.916 6.344 5.97 6.58 L6.843 10.516 L10.482 3.063 Z",
        "sourceNodeId": "845:3540",
        "transform": "matrix(1 0 0 1 13.456 13.952)"
      }
    ],
    "instanceNodeIds": [],
    "key": "send",
    "noSymbolReason": "no-instance-or-symbol-in-audited-subtree",
    "overrides": [],
    "size": {
      "height": 40,
      "width": 40
    },
    "sourceKind": "node",
    "sourceNodeIds": [
      "845:3539",
      "845:3540"
    ],
    "strokes": []
  },
  "arrowRight": {
    "effects": [],
    "fills": [
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ],
    "geometry": [
      {
        "opacity": 1,
        "path": "M0 0 L10.304 0 L10.304 10.304 L0 10.304 L0 0 Z",
        "sourceNodeId": "825:7024"
      },
      {
        "opacity": 1,
        "path": "M2.576 2.576 L2.88 2.88 L3.183 2.576 L2.88 2.272 L2.576 2.576 Z M0 5.152 L0.304 5.456 L2.88 2.88 L2.576 2.576 L2.272 2.272 L-0.304 4.848 L0 5.152 Z M2.576 2.576 L2.88 2.272 L0.304 -0.304 L0 0 L-0.304 0.304 L2.272 2.88 L2.576 2.576 Z",
        "sourceNodeId": "825:7025",
        "stroke": "#8B8FAF",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 0.858667,
        "transform": "matrix(1 0 0 1 3.864 2.576)"
      }
    ],
    "instanceNodeIds": [],
    "key": "arrowRight",
    "noSymbolReason": "no-instance-or-symbol-in-audited-subtree",
    "overrides": [],
    "size": {
      "height": 10.304,
      "width": 10.304
    },
    "sourceKind": "node",
    "sourceNodeIds": [
      "825:7024",
      "825:7025"
    ],
    "strokes": [
      {
        "color": "#8B8FAF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ]
  },
  "home": {
    "effects": [
      {
        "color": "#939393",
        "offset": {
          "x": 0,
          "y": 4
        },
        "radius": 10,
        "type": "DROP_SHADOW"
      }
    ],
    "fills": [
      {
        "color": "#D9D9D9",
        "opacity": 0.1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "opacity": 1,
        "type": "GRADIENT_LINEAR",
        "variableIds": []
      }
    ],
    "geometry": [
      {
        "fill": "#D9D9D9",
        "opacity": 1,
        "path": "M0 24 C0 10.745 10.745 0 24 0 L24 0 C37.255 0 48 10.745 48 24 L48 24 C48 37.255 37.255 48 24 48 L24 48 C10.745 48 0 37.255 0 24 L0 24 Z",
        "sourceNodeId": "270:26532"
      },
      {
        "opacity": 1,
        "path": "M0 0 L13.991 0 L13.991 13.991 L0 13.991 L0 0 Z",
        "sourceNodeId": "270:26534",
        "transform": "matrix(1 0 0 1 16.505 9.205)"
      },
      {
        "opacity": 1,
        "path": "M0 4.663 L0.75 4.663 L0.75 4.663 L0 4.663 Z M0.413 3.773 L0.897 4.345 L0.901 4.342 L0.413 3.773 Z M4.494 0.275 L4.01 -0.297 L4.006 -0.294 L4.494 0.275 Z M5.247 0 L5.247 -0.75 L5.247 0 Z M5.999 0.275 L6.487 -0.294 L6.483 -0.297 L5.999 0.275 Z M10.08 3.773 L9.592 4.342 L9.596 4.345 L10.08 3.773 Z M10.493 4.663 L9.743 4.663 L9.743 4.663 L10.493 4.663 Z M0 9.91 L-0.75 9.91 L0 9.91 Z M0 4.663 L0.75 4.663 C0.75 4.603 0.763 4.543 0.789 4.488 L0.108 4.172 L-0.572 3.857 C-0.689 4.109 -0.75 4.385 -0.75 4.664 L0 4.663 Z M0.108 4.172 L0.789 4.488 C0.814 4.433 0.851 4.384 0.897 4.345 L0.413 3.773 L-0.071 3.2 C-0.284 3.38 -0.455 3.604 -0.572 3.857 L0.108 4.172 Z M0.413 3.773 L0.901 4.342 L4.982 0.845 L4.494 0.275 L4.006 -0.294 L-0.075 3.203 L0.413 3.773 Z M4.494 0.275 L4.978 0.848 C5.053 0.785 5.148 0.75 5.247 0.75 L5.247 0 L5.247 -0.75 C4.794 -0.75 4.356 -0.59 4.01 -0.297 L4.494 0.275 Z M5.247 0 L5.247 0.75 C5.345 0.75 5.44 0.785 5.515 0.848 L5.999 0.275 L6.483 -0.297 C6.137 -0.59 5.699 -0.75 5.247 -0.75 L5.247 0 Z M5.999 0.275 L5.511 0.845 L9.592 4.342 L10.08 3.773 L10.568 3.203 L6.487 -0.294 L5.999 0.275 Z M10.08 3.773 L9.596 4.345 C9.642 4.384 9.679 4.433 9.705 4.488 L10.385 4.172 L11.065 3.857 C10.948 3.604 10.777 3.38 10.564 3.2 L10.08 3.773 Z M10.385 4.172 L9.705 4.488 C9.73 4.543 9.743 4.603 9.743 4.663 L10.493 4.663 L11.243 4.664 C11.243 4.385 11.182 4.109 11.065 3.857 L10.385 4.172 Z M10.493 4.663 L9.743 4.663 L9.743 9.91 L10.493 9.91 L11.243 9.91 L11.243 4.663 L10.493 4.663 Z M10.493 9.91 L9.743 9.91 C9.743 10.02 9.699 10.126 9.621 10.204 L10.152 10.734 L10.682 11.265 C11.041 10.905 11.243 10.418 11.243 9.91 L10.493 9.91 Z M10.152 10.734 L9.621 10.204 C9.543 10.282 9.438 10.326 9.327 10.326 L9.327 11.076 L9.327 11.826 C9.835 11.826 10.323 11.624 10.682 11.265 L10.152 10.734 Z M9.327 11.076 L9.327 10.326 L1.166 10.326 L1.166 11.076 L1.166 11.826 L9.327 11.826 L9.327 11.076 Z M1.166 11.076 L1.166 10.326 C1.056 10.326 0.95 10.282 0.872 10.204 L0.341 10.734 L-0.189 11.265 C0.17 11.624 0.658 11.826 1.166 11.826 L1.166 11.076 Z M0.341 10.734 L0.872 10.204 C0.794 10.126 0.75 10.02 0.75 9.91 L0 9.91 L-0.75 9.91 C-0.75 10.418 -0.548 10.905 -0.189 11.265 L0.341 10.734 Z M0 9.91 L0.75 9.91 L0.75 4.663 L0 4.663 L-0.75 4.663 L-0.75 9.91 L0 9.91 Z",
        "sourceNodeId": "270:26536",
        "stroke": "#FFFFFF",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 18.253 10.371)"
      },
      {
        "opacity": 1,
        "path": "M3.498 5.247 L4.248 5.247 L4.248 0.583 L3.498 0.583 L2.748 0.583 L2.748 5.247 L3.498 5.247 Z M3.498 0.583 L4.248 0.583 C4.248 0.229 4.107 -0.11 3.857 -0.36 L3.327 0.171 L2.797 0.701 C2.765 0.67 2.748 0.627 2.748 0.583 L3.498 0.583 Z M3.327 0.171 L3.857 -0.36 C3.607 -0.61 3.268 -0.75 2.915 -0.75 L2.915 0 L2.915 0.75 C2.87 0.75 2.828 0.732 2.797 0.701 L3.327 0.171 Z M2.915 0 L2.915 -0.75 L0.583 -0.75 L0.583 0 L0.583 0.75 L2.915 0.75 L2.915 0 Z M0.583 0 L0.583 -0.75 C0.229 -0.75 -0.11 -0.61 -0.36 -0.36 L0.171 0.171 L0.701 0.701 C0.67 0.732 0.627 0.75 0.583 0.75 L0.583 0 Z M0.171 0.171 L-0.36 -0.36 C-0.61 -0.11 -0.75 0.229 -0.75 0.583 L0 0.583 L0.75 0.583 C0.75 0.627 0.732 0.67 0.701 0.701 L0.171 0.171 Z M0 0.583 L-0.75 0.583 L-0.75 5.247 L0 5.247 L0.75 5.247 L0.75 0.583 L0 0.583 Z",
        "sourceNodeId": "270:26535",
        "stroke": "#FFFFFF",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 21.751 16.2)"
      }
    ],
    "instanceNodeIds": [],
    "key": "home",
    "noSymbolReason": "no-instance-or-symbol-in-audited-subtree",
    "overrides": [],
    "size": {
      "height": 48,
      "width": 48
    },
    "sourceKind": "node",
    "sourceNodeIds": [
      "270:26532",
      "270:26534",
      "270:26535",
      "270:26536"
    ],
    "strokes": [
      {
        "color": "#E4E4E7",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ]
  },
  "store": {
    "effects": [
      {
        "color": "#000000",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "radius": 2.643479,
        "type": "BACKGROUND_BLUR"
      },
      {
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "radius": 3.965218,
        "type": "DROP_SHADOW"
      }
    ],
    "fills": [
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 0.2,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ],
    "geometry": [
      {
        "fill": "#FFFFFF",
        "opacity": 1,
        "path": "M0 24 C0 10.745 10.745 0 24 0 L24 0 C37.255 0 48 10.745 48 24 L48 24 C48 37.255 37.255 48 24 48 L24 48 C10.745 48 0 37.255 0 24 L0 24 Z",
        "sourceNodeId": "270:26538"
      },
      {
        "opacity": 1,
        "path": "M0 0 L13.991 0 L13.991 13.991 L0 13.991 L0 0 Z",
        "sourceNodeId": "270:26540",
        "transform": "matrix(1 0 0 1 16.405 10.709)"
      },
      {
        "opacity": 1,
        "path": "M0 24 M48 24 M48 24 M0 24 M24 0 M48 24 M24 48 M0 24 M24 48 L24 46.017 C11.84 46.017 1.983 36.16 1.983 24 L0 24 L-1.983 24 C-1.983 38.35 9.65 49.983 24 49.983 L24 48 Z M48 24 L46.017 24 C46.017 36.16 36.16 46.017 24 46.017 L24 48 L24 49.983 C38.35 49.983 49.983 38.35 49.983 24 L48 24 Z M24 0 L24 1.983 C36.16 1.983 46.017 11.84 46.017 24 L48 24 L49.983 24 C49.983 9.65 38.35 -1.983 24 -1.983 L24 0 Z M24 0 L24 -1.983 C9.65 -1.983 -1.983 9.65 -1.983 24 L0 24 L1.983 24 C1.983 11.84 11.84 1.983 24 1.983 L24 0 Z",
        "sourceNodeId": "270:26538",
        "stroke": "#FFFFFF",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.982609
      },
      {
        "opacity": 1,
        "path": "M0.583 0 L0.583 0.75 L3.498 0.75 L3.498 0 L3.498 -0.75 L0.583 -0.75 L0.583 0 Z M3.498 0 L3.498 0.75 C3.405 0.75 3.331 0.675 3.331 0.583 L4.081 0.583 L4.831 0.583 C4.831 -0.153 4.234 -0.75 3.498 -0.75 L3.498 0 Z M4.081 0.583 L3.331 0.583 L3.331 3.498 L4.081 3.498 L4.831 3.498 L4.831 0.583 L4.081 0.583 Z M4.081 3.498 L3.331 3.498 C3.331 3.405 3.405 3.331 3.498 3.331 L3.498 4.081 L3.498 4.831 C4.234 4.831 4.831 4.234 4.831 3.498 L4.081 3.498 Z M3.498 4.081 L3.498 3.331 L0.583 3.331 L0.583 4.081 L0.583 4.831 L3.498 4.831 L3.498 4.081 Z M0.583 4.081 L0.583 3.331 C0.675 3.331 0.75 3.405 0.75 3.498 L0 3.498 L-0.75 3.498 C-0.75 4.234 -0.153 4.831 0.583 4.831 L0.583 4.081 Z M0 3.498 L0.75 3.498 L0.75 0.583 L0 0.583 L-0.75 0.583 L-0.75 3.498 L0 3.498 Z M0 0.583 L0.75 0.583 C0.75 0.675 0.675 0.75 0.583 0.75 L0.583 0 L0.583 -0.75 C-0.153 -0.75 -0.75 -0.153 -0.75 0.583 L0 0.583 Z",
        "sourceNodeId": "270:26541",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 18.153 12.457)"
      },
      {
        "opacity": 1,
        "path": "M0.583 0 L0.583 0.75 L3.498 0.75 L3.498 0 L3.498 -0.75 L0.583 -0.75 L0.583 0 Z M3.498 0 L3.498 0.75 C3.405 0.75 3.331 0.675 3.331 0.583 L4.081 0.583 L4.831 0.583 C4.831 -0.153 4.234 -0.75 3.498 -0.75 L3.498 0 Z M4.081 0.583 L3.331 0.583 L3.331 3.498 L4.081 3.498 L4.831 3.498 L4.831 0.583 L4.081 0.583 Z M4.081 3.498 L3.331 3.498 C3.331 3.405 3.405 3.331 3.498 3.331 L3.498 4.081 L3.498 4.831 C4.234 4.831 4.831 4.234 4.831 3.498 L4.081 3.498 Z M3.498 4.081 L3.498 3.331 L0.583 3.331 L0.583 4.081 L0.583 4.831 L3.498 4.831 L3.498 4.081 Z M0.583 4.081 L0.583 3.331 C0.675 3.331 0.75 3.405 0.75 3.498 L0 3.498 L-0.75 3.498 C-0.75 4.234 -0.153 4.831 0.583 4.831 L0.583 4.081 Z M0 3.498 L0.75 3.498 L0.75 0.583 L0 0.583 L-0.75 0.583 L-0.75 3.498 L0 3.498 Z M0 0.583 L0.75 0.583 C0.75 0.675 0.675 0.75 0.583 0.75 L0.583 0 L0.583 -0.75 C-0.153 -0.75 -0.75 -0.153 -0.75 0.583 L0 0.583 Z",
        "sourceNodeId": "270:26542",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 24.566 12.457)"
      },
      {
        "opacity": 1,
        "path": "M0.583 0 L0.583 0.75 L3.498 0.75 L3.498 0 L3.498 -0.75 L0.583 -0.75 L0.583 0 Z M3.498 0 L3.498 0.75 C3.405 0.75 3.331 0.675 3.331 0.583 L4.081 0.583 L4.831 0.583 C4.831 -0.153 4.234 -0.75 3.498 -0.75 L3.498 0 Z M4.081 0.583 L3.331 0.583 L3.331 3.498 L4.081 3.498 L4.831 3.498 L4.831 0.583 L4.081 0.583 Z M4.081 3.498 L3.331 3.498 C3.331 3.405 3.405 3.331 3.498 3.331 L3.498 4.081 L3.498 4.831 C4.234 4.831 4.831 4.234 4.831 3.498 L4.081 3.498 Z M3.498 4.081 L3.498 3.331 L0.583 3.331 L0.583 4.081 L0.583 4.831 L3.498 4.831 L3.498 4.081 Z M0.583 4.081 L0.583 3.331 C0.675 3.331 0.75 3.405 0.75 3.498 L0 3.498 L-0.75 3.498 C-0.75 4.234 -0.153 4.831 0.583 4.831 L0.583 4.081 Z M0 3.498 L0.75 3.498 L0.75 0.583 L0 0.583 L-0.75 0.583 L-0.75 3.498 L0 3.498 Z M0 0.583 L0.75 0.583 C0.75 0.675 0.675 0.75 0.583 0.75 L0.583 0 L0.583 -0.75 C-0.153 -0.75 -0.75 -0.153 -0.75 0.583 L0 0.583 Z",
        "sourceNodeId": "270:26543",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 24.566 18.87)"
      },
      {
        "opacity": 1,
        "path": "M0.583 0 L0.583 0.75 L3.498 0.75 L3.498 0 L3.498 -0.75 L0.583 -0.75 L0.583 0 Z M3.498 0 L3.498 0.75 C3.405 0.75 3.331 0.675 3.331 0.583 L4.081 0.583 L4.831 0.583 C4.831 -0.153 4.234 -0.75 3.498 -0.75 L3.498 0 Z M4.081 0.583 L3.331 0.583 L3.331 3.498 L4.081 3.498 L4.831 3.498 L4.831 0.583 L4.081 0.583 Z M4.081 3.498 L3.331 3.498 C3.331 3.405 3.405 3.331 3.498 3.331 L3.498 4.081 L3.498 4.831 C4.234 4.831 4.831 4.234 4.831 3.498 L4.081 3.498 Z M3.498 4.081 L3.498 3.331 L0.583 3.331 L0.583 4.081 L0.583 4.831 L3.498 4.831 L3.498 4.081 Z M0.583 4.081 L0.583 3.331 C0.675 3.331 0.75 3.405 0.75 3.498 L0 3.498 L-0.75 3.498 C-0.75 4.234 -0.153 4.831 0.583 4.831 L0.583 4.081 Z M0 3.498 L0.75 3.498 L0.75 0.583 L0 0.583 L-0.75 0.583 L-0.75 3.498 L0 3.498 Z M0 0.583 L0.75 0.583 C0.75 0.675 0.675 0.75 0.583 0.75 L0.583 0 L0.583 -0.75 C-0.153 -0.75 -0.75 -0.153 -0.75 0.583 L0 0.583 Z",
        "sourceNodeId": "270:26544",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 18.153 18.87)"
      }
    ],
    "instanceNodeIds": [],
    "key": "store",
    "noSymbolReason": "no-instance-or-symbol-in-audited-subtree",
    "overrides": [],
    "size": {
      "height": 48,
      "width": 48
    },
    "sourceKind": "node",
    "sourceNodeIds": [
      "270:26538",
      "270:26540",
      "270:26541",
      "270:26542",
      "270:26543",
      "270:26544"
    ],
    "strokes": [
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#E4E4E7",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ]
  },
  "community": {
    "effects": [
      {
        "color": "#000000",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "radius": 2.643479,
        "type": "BACKGROUND_BLUR"
      },
      {
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "radius": 3.965218,
        "type": "DROP_SHADOW"
      }
    ],
    "fills": [
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 0.2,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ],
    "geometry": [
      {
        "fill": "#FFFFFF",
        "opacity": 1,
        "path": "M0 24 C0 10.745 10.745 0 24 0 L24 0 C37.255 0 48 10.745 48 24 L48 24 C48 37.255 37.255 48 24 48 L24 48 C10.745 48 0 37.255 0 24 L0 24 Z",
        "sourceNodeId": "270:26546"
      },
      {
        "opacity": 1,
        "path": "M0 0 L13.991 0 L13.991 13.991 L0 13.991 L0 0 Z",
        "sourceNodeId": "270:26548",
        "transform": "matrix(1 0 0 1 16.405 10.709)"
      },
      {
        "opacity": 1,
        "path": "M0 24 M48 24 M48 24 M0 24 M24 0 M48 24 M24 48 M0 24 M24 48 L24 46.017 C11.84 46.017 1.983 36.16 1.983 24 L0 24 L-1.983 24 C-1.983 38.35 9.65 49.983 24 49.983 L24 48 Z M48 24 L46.017 24 C46.017 36.16 36.16 46.017 24 46.017 L24 48 L24 49.983 C38.35 49.983 49.983 38.35 49.983 24 L48 24 Z M24 0 L24 1.983 C36.16 1.983 46.017 11.84 46.017 24 L48 24 L49.983 24 C49.983 9.65 38.35 -1.983 24 -1.983 L24 0 Z M24 0 L24 -1.983 C9.65 -1.983 -1.983 9.65 -1.983 24 L0 24 L1.983 24 C1.983 11.84 11.84 1.983 24 1.983 L24 0 Z",
        "sourceNodeId": "270:26546",
        "stroke": "#FFFFFF",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.982609
      },
      {
        "opacity": 1,
        "path": "M11.659 5.83 L10.909 5.83 C10.909 8.635 8.635 10.909 5.83 10.909 L5.83 11.659 L5.83 12.409 C9.463 12.409 12.409 9.463 12.409 5.83 L11.659 5.83 Z M5.83 11.659 L5.83 10.909 C3.024 10.909 0.75 8.635 0.75 5.83 L0 5.83 L-0.75 5.83 C-0.75 9.463 2.196 12.409 5.83 12.409 L5.83 11.659 Z M0 5.83 L0.75 5.83 C0.75 3.024 3.024 0.75 5.83 0.75 L5.83 0 L5.83 -0.75 C2.196 -0.75 -0.75 2.196 -0.75 5.83 L0 5.83 Z M5.83 0 L5.83 0.75 C8.635 0.75 10.909 3.024 10.909 5.83 L11.659 5.83 L12.409 5.83 C12.409 2.196 9.463 -0.75 5.83 -0.75 L5.83 0 Z",
        "sourceNodeId": "270:26550",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 17.57 11.874)"
      },
      {
        "opacity": 1,
        "path": "M4.943 0 L5.655 0.237 L6.129 -1.186 L4.706 -0.711 L4.943 0 Z M3.892 3.154 L3.18 2.917 L3.18 2.917 L3.892 3.154 Z M3.154 3.892 L2.917 3.18 L2.917 3.18 L3.154 3.892 Z M0 4.943 L-0.711 4.706 L-1.186 6.129 L0.237 5.655 L0 4.943 Z M1.052 1.789 L1.763 2.026 L1.763 2.026 L1.052 1.789 Z M1.789 1.052 L2.026 1.763 L2.026 1.763 L1.789 1.052 Z M4.943 0 L4.232 -0.237 L3.18 2.917 L3.892 3.154 L4.603 3.392 L5.655 0.237 L4.943 0 Z M3.892 3.154 L3.18 2.917 C3.16 2.978 3.125 3.034 3.08 3.08 L3.61 3.61 L4.14 4.14 C4.351 3.93 4.509 3.674 4.603 3.392 L3.892 3.154 Z M3.61 3.61 L3.08 3.08 C3.034 3.125 2.978 3.16 2.917 3.18 L3.154 3.892 L3.392 4.603 C3.674 4.509 3.93 4.351 4.14 4.14 L3.61 3.61 Z M3.154 3.892 L2.917 3.18 L-0.237 4.232 L0 4.943 L0.237 5.655 L3.392 4.603 L3.154 3.892 Z M0 4.943 L0.711 5.181 L1.763 2.026 L1.052 1.789 L0.34 1.552 L-0.711 4.706 L0 4.943 Z M1.052 1.789 L1.763 2.026 C1.784 1.965 1.818 1.909 1.864 1.864 L1.333 1.333 L0.803 0.803 C0.593 1.013 0.434 1.27 0.34 1.552 L1.052 1.789 Z M1.333 1.333 L1.864 1.864 C1.909 1.818 1.965 1.784 2.026 1.763 L1.789 1.052 L1.552 0.34 C1.27 0.434 1.013 0.593 0.803 0.803 L1.333 1.333 Z M1.789 1.052 L2.026 1.763 L5.181 0.711 L4.943 0 L4.706 -0.711 L1.552 0.34 L1.789 1.052 Z",
        "sourceNodeId": "270:26549",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 20.928 15.232)"
      }
    ],
    "instanceNodeIds": [],
    "key": "community",
    "noSymbolReason": "no-instance-or-symbol-in-audited-subtree",
    "overrides": [],
    "size": {
      "height": 48,
      "width": 48
    },
    "sourceKind": "node",
    "sourceNodeIds": [
      "270:26546",
      "270:26548",
      "270:26549",
      "270:26550"
    ],
    "strokes": [
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#E4E4E7",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ]
  },
  "products": {
    "effects": [
      {
        "color": "#000000",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "radius": 2.643479,
        "type": "BACKGROUND_BLUR"
      },
      {
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "radius": 3.965218,
        "type": "DROP_SHADOW"
      }
    ],
    "fills": [
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 0.2,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ],
    "geometry": [
      {
        "fill": "#FFFFFF",
        "opacity": 1,
        "path": "M0 24 C0 10.745 10.745 0 24 0 L24 0 C37.255 0 48 10.745 48 24 L48 24 C48 37.255 37.255 48 24 48 L24 48 C10.745 48 0 37.255 0 24 L0 24 Z",
        "sourceNodeId": "270:26552"
      },
      {
        "opacity": 1,
        "path": "M0 0 L13.991 0 L13.991 13.991 L0 13.991 L0 0 Z",
        "sourceNodeId": "270:26554",
        "transform": "matrix(1 0 0 1 16.405 10.709)"
      },
      {
        "opacity": 1,
        "path": "M0 24 M48 24 M48 24 M0 24 M24 0 M48 24 M24 48 M0 24 M24 48 L24 46.017 C11.84 46.017 1.983 36.16 1.983 24 L0 24 L-1.983 24 C-1.983 38.35 9.65 49.983 24 49.983 L24 48 Z M48 24 L46.017 24 C46.017 36.16 36.16 46.017 24 46.017 L24 48 L24 49.983 C38.35 49.983 49.983 38.35 49.983 24 L48 24 Z M24 0 L24 1.983 C36.16 1.983 46.017 11.84 46.017 24 L48 24 L49.983 24 C49.983 9.65 38.35 -1.983 24 -1.983 L24 0 Z M24 0 L24 -1.983 C9.65 -1.983 -1.983 9.65 -1.983 24 L0 24 L1.983 24 C1.983 11.84 11.84 1.983 24 1.983 L24 0 Z",
        "sourceNodeId": "270:26552",
        "stroke": "#FFFFFF",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.982609
      },
      {
        "opacity": 1,
        "path": "M4.664 2.332 L3.914 2.332 C3.914 3.205 3.205 3.914 2.332 3.914 L2.332 4.664 L2.332 5.414 C4.034 5.414 5.414 4.034 5.414 2.332 L4.664 2.332 Z M2.332 4.664 L2.332 3.914 C1.458 3.914 0.75 3.205 0.75 2.332 L0 2.332 L-0.75 2.332 C-0.75 4.034 0.63 5.414 2.332 5.414 L2.332 4.664 Z M0 2.332 L0.75 2.332 C0.75 1.458 1.458 0.75 2.332 0.75 L2.332 0 L2.332 -0.75 C0.63 -0.75 -0.75 0.63 -0.75 2.332 L0 2.332 Z M2.332 0 L2.332 0.75 C3.205 0.75 3.914 1.458 3.914 2.332 L4.664 2.332 L5.414 2.332 C5.414 0.63 4.034 -0.75 2.332 -0.75 L2.332 0 Z",
        "sourceNodeId": "270:26556",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 21.068 12.457)"
      },
      {
        "opacity": 1,
        "path": "M5.83 0 L5.83 -0.75 L5.83 0 Z M2.332 0 L2.332 -0.75 L2.332 0 Z M0 2.332 L-0.75 2.332 L0 2.332 Z M8.161 3.498 L8.911 3.498 L8.911 2.332 L8.161 2.332 L7.411 2.332 L7.411 3.498 L8.161 3.498 Z M8.161 2.332 L8.911 2.332 C8.911 1.514 8.587 0.731 8.009 0.153 L7.478 0.683 L6.948 1.213 C7.245 1.51 7.411 1.912 7.411 2.332 L8.161 2.332 Z M7.478 0.683 L8.009 0.153 C7.431 -0.425 6.647 -0.75 5.83 -0.75 L5.83 0 L5.83 0.75 C6.249 0.75 6.651 0.917 6.948 1.213 L7.478 0.683 Z M5.83 0 L5.83 -0.75 L2.332 -0.75 L2.332 0 L2.332 0.75 L5.83 0.75 L5.83 0 Z M2.332 0 L2.332 -0.75 C1.514 -0.75 0.731 -0.425 0.153 0.153 L0.683 0.683 L1.213 1.213 C1.51 0.917 1.912 0.75 2.332 0.75 L2.332 0 Z M0.683 0.683 L0.153 0.153 C-0.425 0.731 -0.75 1.514 -0.75 2.332 L0 2.332 L0.75 2.332 C0.75 1.912 0.917 1.51 1.213 1.213 L0.683 0.683 Z M0 2.332 L-0.75 2.332 L-0.75 3.498 L0 3.498 L0.75 3.498 L0.75 2.332 L0 2.332 Z",
        "sourceNodeId": "270:26555",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 19.319 19.453)"
      }
    ],
    "instanceNodeIds": [],
    "key": "products",
    "noSymbolReason": "no-instance-or-symbol-in-audited-subtree",
    "overrides": [],
    "size": {
      "height": 48,
      "width": 48
    },
    "sourceKind": "node",
    "sourceNodeIds": [
      "270:26552",
      "270:26554",
      "270:26555",
      "270:26556"
    ],
    "strokes": [
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#E4E4E7",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ]
  },
  "brandMark": {
    "effects": [
      {
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.086957
        },
        "radius": 3.130435,
        "type": "DROP_SHADOW"
      }
    ],
    "fills": [
      {
        "color": "#494A64",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#494A64",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#7C62FF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#F5F8FF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#F5F8FF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#F5F8FF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#F5F8FF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ],
    "geometry": [
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M0 0.17 L2.507 0.17 L2.507 9.677 L0 9.677 L0 0.17 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826 10.435)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M1.073 0.323 C1.458 0.323 1.757 0.36 1.971 0.435 C2.189 0.51 2.343 0.624 2.432 0.778 C2.521 0.928 2.565 1.128 2.565 1.379 C2.565 1.64 2.517 1.849 2.42 2.005 C2.327 2.162 2.171 2.276 1.953 2.348 C1.739 2.42 1.445 2.455 1.073 2.455 L0.4 2.455 L0.4 3.717 L0 3.717 L0 0.323 L1.073 0.323 Z M1.025 2.177 C1.32 2.177 1.547 2.154 1.704 2.108 C1.866 2.059 1.981 1.979 2.05 1.868 C2.119 1.754 2.153 1.591 2.153 1.379 C2.153 1.187 2.119 1.035 2.05 0.924 C1.981 0.814 1.864 0.734 1.698 0.685 C1.536 0.633 1.312 0.607 1.025 0.607 L0.4 0.607 L0.4 2.177 L1.025 2.177 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.783 25.565)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M104.309 0 C105.619 0 106.735 0.236 107.592 0.708 C109.048 1.508 109.905 3.003 109.905 4.852 C109.905 6.491 109.242 8.117 107.884 8.982 C106.978 9.559 105.765 9.913 104.309 9.913 C100.815 9.913 98.697 8.182 98.697 5.061 C98.697 2.15 100.492 0 104.309 0 Z M101.317 4.904 C101.317 6.53 101.818 8.418 104.261 8.418 C105.377 8.418 105.959 8.117 106.396 7.658 C106.978 7.028 107.285 6.11 107.285 4.799 C107.285 3.213 106.59 1.455 104.341 1.455 C102.012 1.455 101.317 3.134 101.317 4.904 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826 10.435)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M109.632 0.236 L112.56 0.236 L114.97 4.55 L117.428 0.236 L120 0.236 L116.054 6.228 L116.054 9.677 L113.579 9.677 L113.579 6.202 L109.632 0.236 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826 10.435)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M14.347 2.397 L12.073 2.519 C12.077 2.754 12.113 2.941 12.182 3.082 C12.255 3.222 12.372 3.324 12.534 3.39 C12.695 3.455 12.916 3.487 13.195 3.487 C13.373 3.487 13.555 3.473 13.741 3.443 C13.931 3.411 14.09 3.37 14.22 3.321 L14.22 3.615 C14.115 3.654 13.959 3.688 13.753 3.717 C13.55 3.75 13.348 3.766 13.146 3.766 C12.803 3.766 12.524 3.724 12.309 3.639 C12.095 3.554 11.935 3.412 11.83 3.214 C11.725 3.011 11.672 2.739 11.672 2.397 C11.672 2.054 11.725 1.784 11.83 1.585 C11.935 1.383 12.091 1.239 12.297 1.154 C12.507 1.07 12.78 1.027 13.116 1.027 C13.609 1.027 13.941 1.13 14.11 1.335 C14.28 1.537 14.365 1.798 14.365 2.118 C14.365 2.19 14.359 2.283 14.347 2.397 Z M13.989 2.157 C13.989 1.965 13.969 1.808 13.929 1.687 C13.888 1.567 13.803 1.471 13.674 1.399 C13.548 1.327 13.36 1.291 13.11 1.291 C12.847 1.291 12.641 1.327 12.491 1.399 C12.342 1.467 12.236 1.572 12.176 1.712 C12.115 1.852 12.081 2.04 12.073 2.274 L13.989 2.157 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.783 25.565)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M16.346 0.197 L25.824 0.197 L25.824 1.77 L22.347 1.77 L22.347 9.677 L19.824 9.677 L19.824 1.77 L16.346 1.77 L16.346 0.197 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826 10.435)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M16.77 1.027 L16.757 1.311 L16.685 1.311 C16.442 1.311 16.232 1.355 16.054 1.443 C15.876 1.531 15.745 1.686 15.66 1.908 L15.66 3.717 L15.272 3.717 L15.272 1.076 L15.66 1.076 L15.66 1.551 C15.809 1.202 16.159 1.027 16.709 1.027 L16.77 1.027 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.783 25.565)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M19.753 2.397 L17.479 2.519 C17.483 2.754 17.519 2.941 17.588 3.082 C17.661 3.222 17.778 3.324 17.94 3.39 C18.101 3.455 18.322 3.487 18.601 3.487 C18.779 3.487 18.96 3.473 19.146 3.443 C19.336 3.411 19.496 3.37 19.626 3.321 L19.626 3.615 C19.52 3.654 19.365 3.688 19.159 3.717 C18.956 3.75 18.754 3.766 18.552 3.766 C18.208 3.766 17.929 3.724 17.715 3.639 C17.501 3.554 17.341 3.412 17.236 3.214 C17.131 3.011 17.078 2.739 17.078 2.397 C17.078 2.054 17.131 1.784 17.236 1.585 C17.341 1.383 17.497 1.239 17.703 1.154 C17.913 1.07 18.186 1.027 18.522 1.027 C19.015 1.027 19.347 1.13 19.516 1.335 C19.686 1.537 19.771 1.798 19.771 2.118 C19.771 2.19 19.765 2.283 19.753 2.397 Z M19.395 2.157 C19.395 1.965 19.375 1.808 19.334 1.687 C19.294 1.567 19.209 1.471 19.08 1.399 C18.954 1.327 18.766 1.291 18.516 1.291 C18.253 1.291 18.047 1.327 17.897 1.399 C17.748 1.467 17.642 1.572 17.582 1.712 C17.521 1.852 17.487 2.04 17.479 2.274 L19.395 2.157 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.783 25.565)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M23.316 0 L23.316 3.717 L22.994 3.717 L22.94 3.194 C22.871 3.373 22.744 3.514 22.558 3.615 C22.372 3.716 22.121 3.766 21.806 3.766 C21.316 3.766 20.975 3.654 20.781 3.429 C20.591 3.201 20.496 2.857 20.496 2.397 C20.496 1.966 20.593 1.63 20.787 1.389 C20.985 1.148 21.324 1.027 21.806 1.027 C22.125 1.027 22.374 1.078 22.552 1.179 C22.729 1.277 22.857 1.414 22.934 1.59 L22.934 0 L23.316 0 Z M22.946 2.397 C22.946 2.048 22.863 1.777 22.697 1.585 C22.535 1.392 22.256 1.296 21.86 1.296 C21.601 1.296 21.401 1.343 21.26 1.438 C21.118 1.529 21.023 1.653 20.975 1.81 C20.926 1.966 20.902 2.162 20.902 2.397 C20.902 2.638 20.926 2.839 20.975 2.998 C21.027 3.155 21.122 3.277 21.26 3.365 C21.401 3.453 21.601 3.497 21.86 3.497 C22.256 3.497 22.535 3.403 22.697 3.214 C22.863 3.024 22.946 2.752 22.946 2.397 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.783 25.565)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M27.204 0.197 L35.033 0.197 L35.033 1.744 L29.711 1.744 L29.711 3.999 L34.693 3.999 L34.693 5.547 L29.711 5.547 L29.711 8.104 L35.211 8.104 L35.211 9.677 L27.204 9.677 L27.204 0.197 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826 10.435)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M28.684 2.397 C28.684 2.827 28.587 3.163 28.393 3.404 C28.199 3.646 27.862 3.766 27.38 3.766 C27.061 3.766 26.812 3.717 26.635 3.62 C26.457 3.522 26.329 3.386 26.252 3.214 L26.198 3.717 L25.864 3.717 L25.864 0 L26.252 0 L26.252 1.609 C26.321 1.423 26.444 1.28 26.622 1.179 C26.804 1.078 27.057 1.027 27.38 1.027 C27.87 1.027 28.209 1.141 28.399 1.37 C28.589 1.595 28.684 1.937 28.684 2.397 Z M28.284 2.397 C28.284 2.155 28.258 1.957 28.205 1.8 C28.153 1.64 28.056 1.516 27.914 1.428 C27.777 1.34 27.581 1.296 27.326 1.296 C26.926 1.296 26.643 1.391 26.477 1.58 C26.315 1.769 26.234 2.041 26.234 2.397 C26.234 2.746 26.317 3.016 26.483 3.209 C26.649 3.401 26.93 3.497 27.326 3.497 C27.702 3.497 27.955 3.404 28.084 3.218 C28.217 3.029 28.284 2.755 28.284 2.397 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.783 25.565)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M29.317 4.427 C29.503 4.427 29.655 4.404 29.772 4.358 C29.894 4.313 29.995 4.237 30.076 4.133 C30.16 4.032 30.241 3.89 30.318 3.708 L29.008 1.076 L29.421 1.076 L30.506 3.355 L30.543 3.355 L31.549 1.076 L31.943 1.076 L30.743 3.688 C30.629 3.926 30.52 4.114 30.415 4.251 C30.31 4.391 30.171 4.5 29.997 4.578 C29.823 4.657 29.596 4.696 29.317 4.696 L29.317 4.427 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.783 25.565)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M3.258 2.397 C3.258 2.054 3.309 1.784 3.41 1.585 C3.515 1.383 3.673 1.239 3.883 1.154 C4.093 1.07 4.368 1.027 4.708 1.027 C5.047 1.027 5.322 1.07 5.533 1.154 C5.743 1.239 5.9 1.383 6.006 1.585 C6.111 1.784 6.163 2.054 6.163 2.397 C6.163 2.739 6.111 3.011 6.006 3.214 C5.9 3.412 5.743 3.554 5.533 3.639 C5.322 3.724 5.047 3.766 4.708 3.766 C4.368 3.766 4.093 3.724 3.883 3.639 C3.673 3.554 3.515 3.412 3.41 3.214 C3.309 3.011 3.258 2.739 3.258 2.397 Z M5.757 2.397 C5.757 2.116 5.725 1.898 5.66 1.741 C5.595 1.582 5.486 1.467 5.332 1.399 C5.183 1.33 4.975 1.296 4.708 1.296 C4.437 1.296 4.227 1.33 4.077 1.399 C3.927 1.467 3.82 1.582 3.756 1.741 C3.695 1.898 3.665 2.116 3.665 2.397 C3.665 2.677 3.697 2.897 3.762 3.057 C3.826 3.214 3.933 3.326 4.083 3.395 C4.233 3.463 4.441 3.497 4.708 3.497 C4.983 3.497 5.195 3.463 5.345 3.395 C5.494 3.326 5.599 3.214 5.66 3.057 C5.725 2.901 5.757 2.68 5.757 2.397 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.783 25.565)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M33.728 3.629 L33.728 3.316 C33.865 3.359 34.049 3.396 34.28 3.429 C34.51 3.461 34.742 3.478 34.977 3.478 C35.329 3.478 35.594 3.427 35.771 3.326 C35.949 3.222 36.038 3.054 36.038 2.822 C36.038 2.669 36.006 2.548 35.941 2.46 C35.881 2.369 35.778 2.296 35.632 2.24 C35.49 2.182 35.28 2.124 35.001 2.069 C34.694 2.01 34.457 1.948 34.292 1.883 C34.13 1.815 34.011 1.725 33.934 1.614 C33.861 1.503 33.825 1.352 33.825 1.159 C33.825 0.566 34.275 0.269 35.177 0.269 C35.359 0.269 35.551 0.282 35.753 0.308 C35.955 0.331 36.111 0.359 36.22 0.391 L36.22 0.695 C36.083 0.655 35.921 0.623 35.735 0.597 C35.549 0.571 35.361 0.558 35.171 0.558 C34.844 0.558 34.603 0.603 34.449 0.695 C34.296 0.783 34.219 0.938 34.219 1.159 C34.219 1.286 34.241 1.387 34.286 1.462 C34.334 1.534 34.423 1.596 34.552 1.648 C34.686 1.697 34.884 1.746 35.147 1.795 C35.474 1.857 35.727 1.926 35.905 2.001 C36.087 2.076 36.22 2.177 36.305 2.304 C36.39 2.431 36.433 2.602 36.433 2.817 C36.433 3.14 36.309 3.38 36.063 3.536 C35.82 3.69 35.458 3.766 34.977 3.766 C34.73 3.766 34.488 3.752 34.249 3.722 C34.011 3.693 33.837 3.662 33.728 3.629 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.783 25.565)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M37.011 0.21 L39.567 0.21 L39.567 8.064 L44.581 8.064 L44.581 9.677 L37.011 9.677 L37.011 0.21 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826 10.435)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M39.749 2.397 L37.474 2.519 C37.478 2.754 37.515 2.941 37.583 3.082 C37.656 3.222 37.774 3.324 37.935 3.39 C38.097 3.455 38.317 3.487 38.596 3.487 C38.774 3.487 38.956 3.473 39.142 3.443 C39.332 3.411 39.492 3.37 39.621 3.321 L39.621 3.615 C39.516 3.654 39.36 3.688 39.154 3.717 C38.952 3.75 38.75 3.766 38.548 3.766 C38.204 3.766 37.925 3.724 37.711 3.639 C37.497 3.554 37.337 3.412 37.232 3.214 C37.127 3.011 37.074 2.739 37.074 2.397 C37.074 2.054 37.127 1.784 37.232 1.585 C37.337 1.383 37.493 1.239 37.699 1.154 C37.909 1.07 38.182 1.027 38.517 1.027 C39.011 1.027 39.342 1.13 39.512 1.335 C39.682 1.537 39.767 1.798 39.767 2.118 C39.767 2.19 39.761 2.283 39.749 2.397 Z M39.391 2.157 C39.391 1.965 39.371 1.808 39.33 1.687 C39.29 1.567 39.205 1.471 39.075 1.399 C38.95 1.327 38.762 1.291 38.511 1.291 C38.249 1.291 38.042 1.327 37.893 1.399 C37.743 1.467 37.638 1.572 37.577 1.712 C37.517 1.852 37.482 2.04 37.474 2.274 L39.391 2.157 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.783 25.565)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M4.696 0.197 L8.319 0.197 L12.702 7.658 L12.702 0.197 L15.031 0.197 L15.031 9.677 L11.586 9.677 L7.057 1.81 L7.057 9.677 L4.696 9.677 L4.696 0.197 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826 10.435)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M43.184 1.849 L43.184 3.717 L42.857 3.717 L42.796 3.277 C42.703 3.43 42.543 3.551 42.317 3.639 C42.094 3.724 41.844 3.766 41.565 3.766 C40.821 3.766 40.449 3.507 40.449 2.989 C40.449 2.682 40.562 2.467 40.788 2.343 C41.015 2.219 41.332 2.157 41.741 2.157 L42.796 2.157 L42.796 1.903 C42.796 1.697 42.735 1.546 42.614 1.448 C42.493 1.347 42.264 1.296 41.929 1.296 C41.678 1.296 41.435 1.317 41.201 1.36 L41.201 1.076 C41.472 1.043 41.722 1.027 41.953 1.027 C42.418 1.027 42.739 1.099 42.917 1.242 C43.095 1.383 43.184 1.585 43.184 1.849 Z M42.796 2.93 L42.796 2.416 L41.777 2.416 C41.559 2.416 41.383 2.433 41.249 2.465 C41.116 2.495 41.015 2.552 40.946 2.636 C40.877 2.718 40.843 2.835 40.843 2.989 C40.843 3.158 40.904 3.285 41.025 3.37 C41.146 3.452 41.332 3.492 41.583 3.492 C41.886 3.492 42.143 3.443 42.353 3.346 C42.567 3.248 42.715 3.109 42.796 2.93 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.783 25.565)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M44.28 3.233 L44.28 0 L44.668 0 L44.668 3.15 C44.668 3.28 44.69 3.368 44.734 3.414 C44.783 3.46 44.864 3.483 44.977 3.483 C45.086 3.483 45.177 3.474 45.25 3.458 L45.25 3.717 C45.161 3.737 45.05 3.747 44.916 3.747 C44.71 3.747 44.552 3.708 44.443 3.629 C44.334 3.551 44.28 3.419 44.28 3.233 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.783 25.565)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M45.654 2.397 C45.654 2.054 45.705 1.784 45.806 1.585 C45.911 1.383 46.069 1.239 46.279 1.154 C46.489 1.07 46.764 1.027 47.104 1.027 C47.443 1.027 47.718 1.07 47.929 1.154 C48.139 1.239 48.296 1.383 48.402 1.585 C48.507 1.784 48.559 2.054 48.559 2.397 C48.559 2.739 48.507 3.011 48.402 3.214 C48.296 3.412 48.139 3.554 47.929 3.639 C47.718 3.724 47.443 3.766 47.104 3.766 C46.764 3.766 46.489 3.724 46.279 3.639 C46.069 3.554 45.911 3.412 45.806 3.214 C45.705 3.011 45.654 2.739 45.654 2.397 Z M48.153 2.397 C48.153 2.116 48.121 1.898 48.056 1.741 C47.991 1.582 47.882 1.467 47.728 1.399 C47.579 1.33 47.371 1.296 47.104 1.296 C46.833 1.296 46.623 1.33 46.473 1.399 C46.323 1.467 46.216 1.582 46.152 1.741 C46.091 1.898 46.061 2.116 46.061 2.397 C46.061 2.677 46.093 2.897 46.158 3.057 C46.222 3.214 46.329 3.326 46.479 3.395 C46.629 3.463 46.837 3.497 47.104 3.497 C47.379 3.497 47.591 3.463 47.741 3.395 C47.89 3.326 47.995 3.214 48.056 3.057 C48.121 2.901 48.153 2.68 48.153 2.397 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.783 25.565)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M45.999 0.21 L48.554 0.21 L48.554 8.064 L53.568 8.064 L53.568 9.677 L45.999 9.677 L45.999 0.21 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826 10.435)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M49.254 3.668 L49.254 3.39 C49.379 3.416 49.527 3.439 49.697 3.458 C49.871 3.474 50.036 3.483 50.194 3.483 C50.473 3.483 50.679 3.447 50.813 3.375 C50.946 3.3 51.013 3.179 51.013 3.013 C51.013 2.905 50.993 2.821 50.952 2.759 C50.912 2.697 50.837 2.645 50.728 2.602 C50.623 2.56 50.463 2.517 50.249 2.475 C50.006 2.426 49.818 2.374 49.685 2.318 C49.555 2.263 49.46 2.191 49.4 2.103 C49.343 2.012 49.315 1.89 49.315 1.736 C49.315 1.511 49.412 1.337 49.606 1.213 C49.8 1.089 50.073 1.027 50.425 1.027 C50.582 1.027 50.74 1.037 50.898 1.057 C51.055 1.073 51.177 1.092 51.261 1.115 L51.237 1.394 C51.136 1.365 51.013 1.34 50.867 1.321 C50.722 1.301 50.574 1.291 50.425 1.291 C50.182 1.291 49.998 1.326 49.873 1.394 C49.747 1.462 49.685 1.578 49.685 1.741 C49.685 1.846 49.707 1.927 49.751 1.986 C49.796 2.041 49.863 2.085 49.951 2.118 C50.04 2.147 50.176 2.18 50.358 2.216 C50.617 2.265 50.817 2.32 50.958 2.382 C51.104 2.441 51.211 2.519 51.28 2.617 C51.348 2.711 51.383 2.84 51.383 3.003 C51.383 3.245 51.284 3.429 51.086 3.556 C50.892 3.683 50.596 3.747 50.2 3.747 C50.038 3.747 49.869 3.739 49.691 3.722 C49.513 3.709 49.367 3.691 49.254 3.668 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.783 25.565)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M53.451 4.696 L53.451 0 L53.827 0 L53.827 4.696 L53.451 4.696 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.783 25.565)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M54.84 0.17 L57.347 0.17 L57.347 9.677 L54.84 9.677 L54.84 0.17 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826 10.435)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M55.999 2.02 C55.999 1.391 56.167 0.942 56.502 0.675 C56.842 0.408 57.341 0.274 58 0.274 C58.203 0.274 58.403 0.285 58.601 0.308 C58.803 0.331 58.965 0.362 59.086 0.401 L59.086 0.704 C58.799 0.61 58.443 0.563 58.019 0.563 C57.675 0.563 57.388 0.603 57.157 0.685 C56.927 0.766 56.745 0.915 56.612 1.13 C56.482 1.342 56.418 1.639 56.418 2.02 C56.418 2.421 56.48 2.728 56.606 2.94 C56.731 3.152 56.905 3.295 57.127 3.37 C57.354 3.445 57.645 3.483 58 3.483 C58.3 3.483 58.556 3.455 58.771 3.399 L58.771 2.23 L57.879 2.23 L57.879 1.952 L59.165 1.952 L59.165 3.629 C58.813 3.721 58.403 3.766 57.934 3.766 C57.505 3.766 57.151 3.717 56.872 3.62 C56.593 3.522 56.377 3.346 56.223 3.091 C56.074 2.834 55.999 2.477 55.999 2.02 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.783 25.565)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M59.423 0.223 L63.515 0.236 C64.987 0.236 66.41 0.524 67.445 1.167 C68.594 1.888 69.305 3.199 69.305 4.812 C69.305 7.015 68.189 8.72 65.989 9.389 C65.31 9.598 64.485 9.677 63.644 9.677 L59.423 9.677 L59.423 0.223 Z M61.962 1.757 L61.962 8.117 C62.302 8.117 62.641 8.143 62.981 8.143 C63.547 8.143 64.049 8.117 64.372 8.051 C66.297 7.697 66.717 6.058 66.717 4.799 C66.717 3.527 66.216 2.098 64.178 1.81 C63.838 1.757 63.305 1.744 62.819 1.744 C62.528 1.744 62.237 1.744 61.962 1.757 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826 10.435)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M60.116 0.333 C60.116 0.248 60.133 0.194 60.165 0.171 C60.201 0.145 60.268 0.132 60.365 0.132 C60.454 0.132 60.515 0.145 60.547 0.171 C60.583 0.194 60.602 0.248 60.602 0.333 C60.602 0.417 60.583 0.473 60.547 0.499 C60.515 0.522 60.454 0.533 60.365 0.533 C60.268 0.533 60.201 0.522 60.165 0.499 C60.133 0.473 60.116 0.417 60.116 0.333 Z M60.165 3.717 L60.165 1.076 L60.553 1.076 L60.553 3.717 L60.165 3.717 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.783 25.565)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M62.949 3.443 L62.949 3.717 C62.779 3.737 62.645 3.747 62.548 3.747 C62.318 3.747 62.14 3.726 62.015 3.683 C61.889 3.641 61.798 3.561 61.742 3.443 C61.685 3.326 61.657 3.152 61.657 2.92 L61.657 1.345 L61.147 1.345 L61.147 1.076 L61.657 1.076 L61.657 0.45 L62.039 0.45 L62.039 1.076 L62.906 1.076 L62.906 1.345 L62.039 1.345 L62.039 2.915 C62.039 3.068 62.053 3.184 62.081 3.262 C62.11 3.341 62.158 3.396 62.227 3.429 C62.3 3.461 62.407 3.478 62.548 3.478 C62.698 3.478 62.831 3.466 62.949 3.443 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.783 25.565)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M66.189 0.323 L66.602 0.323 L66.602 3.717 L66.189 3.717 L66.189 2.025 L63.945 2.025 L63.945 3.717 L63.545 3.717 L63.545 0.323 L63.945 0.323 L63.945 1.746 L66.189 1.746 L66.189 0.323 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.783 25.565)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M7.513 3.717 L6.615 1.076 L7.004 1.076 L7.756 3.39 L7.792 3.39 L8.69 1.076 L9.163 1.076 L10.078 3.39 L10.115 3.39 L10.873 1.076 L11.249 1.076 L10.333 3.717 L9.854 3.717 L8.944 1.414 L8.908 1.414 L7.992 3.717 L7.513 3.717 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.783 25.565)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M70.183 1.076 L70.183 3.717 L69.855 3.717 L69.801 3.292 C69.732 3.458 69.599 3.579 69.401 3.654 C69.206 3.729 68.986 3.766 68.739 3.766 C68.339 3.766 68.06 3.695 67.903 3.551 C67.745 3.408 67.666 3.196 67.666 2.915 L67.666 1.076 L68.048 1.076 L68.048 2.768 C68.048 2.941 68.068 3.08 68.109 3.184 C68.149 3.285 68.222 3.362 68.327 3.414 C68.432 3.463 68.584 3.487 68.782 3.487 C69.033 3.487 69.245 3.447 69.419 3.365 C69.597 3.284 69.722 3.13 69.795 2.905 L69.795 1.076 L70.183 1.076 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.783 25.565)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M71.241 0.197 L79.069 0.197 L79.069 1.744 L73.748 1.744 L73.748 3.999 L78.729 3.999 L78.729 5.547 L73.748 5.547 L73.748 8.104 L79.247 8.104 L79.247 9.677 L71.241 9.677 L71.241 0.197 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826 10.435)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M74.087 2.397 C74.087 2.827 73.99 3.163 73.796 3.404 C73.602 3.646 73.264 3.766 72.783 3.766 C72.464 3.766 72.215 3.717 72.037 3.62 C71.859 3.522 71.732 3.386 71.655 3.214 L71.6 3.717 L71.267 3.717 L71.267 0 L71.655 0 L71.655 1.609 C71.724 1.423 71.847 1.28 72.025 1.179 C72.207 1.078 72.46 1.027 72.783 1.027 C73.272 1.027 73.612 1.141 73.802 1.37 C73.992 1.595 74.087 1.937 74.087 2.397 Z M73.687 2.397 C73.687 2.155 73.66 1.957 73.608 1.8 C73.555 1.64 73.458 1.516 73.317 1.428 C73.179 1.34 72.983 1.296 72.728 1.296 C72.328 1.296 72.045 1.391 71.879 1.58 C71.718 1.769 71.637 2.041 71.637 2.397 C71.637 2.746 71.72 3.016 71.885 3.209 C72.051 3.401 72.332 3.497 72.728 3.497 C73.104 3.497 73.357 3.404 73.487 3.218 C73.62 3.029 73.687 2.755 73.687 2.397 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.783 25.565)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M80.983 0.223 L84.719 0.223 C85.948 0.223 86.854 0.328 87.436 0.538 C88.617 0.944 89.361 1.77 89.361 3.029 C89.361 3.658 89.183 4.222 88.86 4.681 C88.116 5.717 86.951 5.992 85.496 5.992 L83.522 5.992 L83.522 9.677 L80.983 9.677 L80.983 0.223 Z M83.458 4.484 L84.638 4.484 C86.143 4.484 86.773 3.999 86.773 3.042 C86.773 2.177 86.175 1.757 84.881 1.757 L83.458 1.757 L83.458 4.484 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826 10.435)"
      },
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M90.935 0.21 L93.491 0.21 L93.491 8.064 L98.505 8.064 L98.505 9.677 L90.935 9.677 L90.935 0.21 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826 10.435)"
      },
      {
        "fill": "#7C62FF",
        "opacity": 1,
        "path": "M0 15.652 C0 7.008 7.008 0 15.652 0 L15.652 0 C24.297 0 31.304 7.008 31.304 15.652 L31.304 15.652 C31.304 24.297 24.297 31.304 15.652 31.304 L15.652 31.304 C7.008 31.304 0 24.297 0 15.652 L0 15.652 Z",
        "sourceNodeId": "270:26269",
        "transform": "matrix(1 0 0 1 6.783 1.043)"
      },
      {
        "fill": "#F5F8FF",
        "opacity": 1,
        "path": "M1.196 0.277 C1.537 0.611 1.714 0.955 1.867 1.576 C1.99 2.074 2.07 2.24 2.279 2.439 C2.537 2.683 2.674 2.736 3.063 2.737 C3.485 2.738 3.638 2.672 3.959 2.353 C4.192 2.122 4.287 1.924 4.345 1.551 L4.372 1.378 L4.165 1.378 L3.958 1.378 L4.291 0.852 C4.475 0.562 4.634 0.325 4.645 0.325 C4.656 0.325 4.815 0.557 4.998 0.842 L5.33 1.358 L5.155 1.37 L4.979 1.383 L4.951 1.695 C4.883 2.452 4.698 2.906 4.282 3.329 C4.077 3.538 3.929 3.645 3.688 3.76 C3.402 3.896 3.328 3.913 2.982 3.927 C1.876 3.971 1.04 3.342 0.731 2.234 C0.569 1.654 0.403 1.392 0.094 1.233 C-0.012 1.178 -0.02 1.162 0.028 1.099 C0.696 0.208 0.857 0.001 0.883 0 C0.9 0 1.041 0.124 1.196 0.277 Z",
        "sourceNodeId": "270:26272",
        "transform": "matrix(1 0 0 1 23.752 19.162)"
      },
      {
        "fill": "#F5F8FF",
        "opacity": 1,
        "path": "M3.113 2.071 C3.156 1.277 2.814 0.544 2.215 0.146 C2.093 0.066 1.984 0 1.971 0 C1.958 0 1.947 0.087 1.947 0.193 C1.946 1.568 1.227 2.977 0.172 3.67 C0.078 3.732 0 3.787 0 3.791 C0 3.795 0.126 3.767 0.28 3.728 C0.929 3.563 1.382 3.59 1.839 3.82 C2.295 4.05 2.588 4.449 2.702 4.997 C2.852 5.72 2.499 6.478 1.833 6.861 C1.718 6.927 1.658 6.996 1.627 7.097 C1.556 7.333 1.272 7.727 0.978 7.999 L0.701 8.255 L1.476 8.23 C2.318 8.204 2.479 8.172 2.966 7.933 C3.473 7.684 3.943 7.256 4.239 6.772 C4.315 6.648 4.437 6.374 4.511 6.164 C4.64 5.793 4.645 5.76 4.643 5.152 C4.642 4.571 4.633 4.498 4.529 4.198 C4.309 3.564 3.838 2.941 3.329 2.611 L3.091 2.458 L3.113 2.071 Z",
        "sourceNodeId": "270:26273",
        "transform": "matrix(1 0 0 1 27.201 14.821)"
      },
      {
        "fill": "#F5F8FF",
        "opacity": 1,
        "path": "M3.147 0.716 C2.808 0.476 2.4 0.275 1.982 0.143 C1.795 0.084 1.537 0.025 1.409 0.011 C1.191 -0.012 1.171 -0.006 1.108 0.091 C0.82 0.53 0.685 1.479 0.82 2.115 L0.878 2.387 L0.696 2.663 C-0.126 3.91 -0.227 5.502 0.431 6.87 C0.691 7.412 1.001 7.798 1.441 8.128 C1.999 8.547 2.543 8.783 3.331 8.946 L3.682 9.019 L3.864 8.841 C3.964 8.743 4.037 8.654 4.026 8.644 C4.015 8.633 3.838 8.582 3.631 8.53 C2.797 8.319 2.185 8.012 1.864 7.64 C1.321 7.014 1.128 5.928 1.441 5.26 C1.589 4.944 1.794 4.707 2.028 4.583 L2.201 4.491 C2.201 4.491 2.715 4.122 3.403 3.854 C4.074 3.591 4.911 3.428 5.598 3.428 C6.202 3.427 7.081 3.606 7.819 3.854 C8.403 4.049 8.992 4.48 8.992 4.48 L9.146 4.576 C9.41 4.74 9.634 4.988 9.753 5.246 C9.851 5.458 9.869 5.556 9.881 5.92 C9.897 6.419 9.829 6.771 9.638 7.173 C9.471 7.524 9.033 7.963 8.684 8.132 L8.432 8.252 L8.43 8.526 C8.429 8.696 8.445 8.8 8.472 8.8 C8.569 8.8 9.078 8.571 9.402 8.382 C9.872 8.106 10.408 7.563 10.67 7.096 C11.046 6.426 11.209 5.692 11.174 4.825 C11.138 3.953 10.958 3.358 10.533 2.709 L10.329 2.398 L10.372 2.164 C10.481 1.575 10.394 0.738 10.169 0.214 C10.078 0.001 9.987 -0.028 9.621 0.036 C9.147 0.118 8.354 0.473 7.978 0.771 L7.819 0.897 L7.302 0.773 C6.138 0.493 4.855 0.506 3.735 0.808 L3.403 0.898 L3.147 0.716 Z",
        "sourceNodeId": "270:26271",
        "transform": "matrix(1 0 0 1 17.465 9.913)"
      },
      {
        "fill": "#F5F8FF",
        "opacity": 1,
        "path": "M4.162 0 C4.022 0.004 3.519 0.333 3.265 0.587 C2.938 0.915 2.747 1.267 2.647 1.725 L2.583 2.021 L2.336 2.11 C1.557 2.392 0.825 3.054 0.43 3.832 C-0.568 5.803 0.228 8.179 2.231 9.204 C3.007 9.601 3.563 9.715 4.572 9.682 C5.316 9.658 5.778 9.573 6.498 9.326 C6.914 9.184 7.615 8.845 8.029 8.586 C9.146 7.888 10.419 6.607 11.312 5.282 C11.406 5.143 11.498 5.029 11.518 5.029 C11.537 5.029 11.728 5.149 11.942 5.295 L12.331 5.561 L12.331 3.774 C12.331 2.791 12.322 1.986 12.311 1.986 C12.299 1.986 11.565 2.343 10.68 2.779 L9.071 3.572 L9.528 3.793 L9.985 4.013 L9.85 4.201 C9.197 5.112 8.474 5.878 7.768 6.408 C7.061 6.938 6.729 7.148 6.188 7.405 C5.411 7.774 4.793 7.913 4.204 7.85 L3.935 7.821 L3.691 7.767 L3.488 7.671 L3.32 7.577 C3.228 7.525 3.02 7.36 2.859 7.21 C2.536 6.909 2.318 6.549 2.212 6.142 C2.132 5.837 2.132 5.275 2.212 4.97 C2.441 4.092 3.232 3.447 4.081 3.447 C4.224 3.447 4.34 3.438 4.34 3.428 C4.34 3.418 4.304 3.317 4.26 3.205 C3.916 2.332 3.858 1.201 4.113 0.321 C4.172 0.117 4.19 -0.001 4.162 0 Z",
        "sourceNodeId": "270:26274",
        "transform": "matrix(1 0 0 1 13.043 13.4)"
      },
      {
        "opacity": 1,
        "path": "M0 15.652 M31.304 15.652 M31.304 15.652 M0 15.652 M15.652 0 M31.304 15.652 M15.652 31.304 M0 15.652 M15.652 31.304 L15.652 29.739 C7.872 29.739 1.565 23.432 1.565 15.652 L0 15.652 L-1.565 15.652 C-1.565 25.161 6.143 32.87 15.652 32.87 L15.652 31.304 Z M31.304 15.652 L29.739 15.652 C29.739 23.432 23.432 29.739 15.652 29.739 L15.652 31.304 L15.652 32.87 C25.161 32.87 32.87 25.161 32.87 15.652 L31.304 15.652 Z M15.652 0 L15.652 1.565 C23.432 1.565 29.739 7.872 29.739 15.652 L31.304 15.652 L32.87 15.652 C32.87 6.143 25.161 -1.565 15.652 -1.565 L15.652 0 Z M15.652 0 L15.652 -1.565 C6.143 -1.565 -1.565 6.143 -1.565 15.652 L0 15.652 L1.565 15.652 C1.565 7.872 7.872 1.565 15.652 1.565 L15.652 0 Z",
        "sourceNodeId": "270:26269",
        "stroke": "#FFFFFF",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.565218,
        "transform": "matrix(1 0 0 1 6.783 1.043)"
      }
    ],
    "instanceNodeIds": [],
    "key": "brandMark",
    "noSymbolReason": "no-instance-or-symbol-in-audited-subtree",
    "overrides": [],
    "size": {
      "height": 36,
      "width": 170.608688
    },
    "sourceKind": "node",
    "sourceNodeIds": [
      "270:26268",
      "270:26269",
      "270:26271",
      "270:26272",
      "270:26273",
      "270:26274",
      "270:26277",
      "270:26278"
    ],
    "strokes": [
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ]
  },
  "circleAction": {
    "effects": [
      {
        "color": "#000000",
        "offset": {
          "x": 0,
          "y": 2.202899
        },
        "radius": 2.202899,
        "type": "BACKGROUND_BLUR"
      },
      {
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.202899
        },
        "radius": 3.304348,
        "type": "DROP_SHADOW"
      }
    ],
    "fills": [
      {
        "color": "#FFFFFF",
        "opacity": 0.2,
        "type": "SOLID",
        "variableIds": []
      }
    ],
    "geometry": [
      {
        "fill": "#FFFFFF",
        "opacity": 1,
        "path": "M33.043 16.522 C33.043 25.646 25.646 33.043 16.522 33.043 C7.397 33.043 0 25.646 0 16.522 C0 7.397 7.397 0 16.522 0 C25.646 0 33.043 7.397 33.043 16.522 Z",
        "sourceNodeId": "845:3504",
        "transform": "matrix(1 0 0 1 2 2.203)"
      },
      {
        "opacity": 1,
        "path": "M0.75 -1.5 C0.336 -1.5 0 -1.164 0 -0.75 C0 -0.336 0.336 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M12.25 0 C12.664 0 13 -0.336 13 -0.75 C13 -1.164 12.664 -1.5 12.25 -1.5 L12.25 -0.75 L12.25 0 Z M0.75 -0.75 L0.75 0 L12.25 0 L12.25 -0.75 L12.25 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "845:3508",
        "stroke": "#494A64",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(-1 0 0 -1 26 18)"
      },
      {
        "opacity": 1,
        "path": "M0.75 -1.5 C0.336 -1.5 0 -1.164 0 -0.75 C0 -0.336 0.336 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711 0 C8.125 0 8.461 -0.336 8.461 -0.75 C8.461 -1.164 8.125 -1.5 7.711 -1.5 L7.711 -0.75 L7.711 0 Z M0.75 -0.75 L0.75 0 L7.711 0 L7.711 -0.75 L7.711 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "845:3506",
        "stroke": "#494A64",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(-0.64 0.768 -0.768 -0.64 18.417 12)"
      },
      {
        "opacity": 1,
        "path": "M0.75 -1.5 C0.336 -1.5 0 -1.164 0 -0.75 C0 -0.336 0.336 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711 0 C8.125 0 8.461 -0.336 8.461 -0.75 C8.461 -1.164 8.125 -1.5 7.711 -1.5 L7.711 -0.75 L7.711 0 Z M0.75 -0.75 L0.75 0 L7.711 0 L7.711 -0.75 L7.711 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "845:3507",
        "stroke": "#494A64",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(-0.64 -0.768 -0.768 0.64 18.417 25.5)"
      },
      {
        "opacity": 1,
        "path": "M33.043 16.522 L31.391 16.522 C31.391 24.734 24.734 31.391 16.522 31.391 L16.522 33.043 L16.522 34.696 C26.559 34.696 34.696 26.559 34.696 16.522 L33.043 16.522 Z M16.522 33.043 L16.522 31.391 C8.31 31.391 1.652 24.734 1.652 16.522 L0 16.522 L-1.652 16.522 C-1.652 26.559 6.485 34.696 16.522 34.696 L16.522 33.043 Z M0 16.522 L1.652 16.522 C1.652 8.31 8.31 1.652 16.522 1.652 L16.522 0 L16.522 -1.652 C6.485 -1.652 -1.652 6.485 -1.652 16.522 L0 16.522 Z M16.522 0 L16.522 1.652 C24.734 1.652 31.391 8.31 31.391 16.522 L33.043 16.522 L34.696 16.522 C34.696 6.485 26.559 -1.652 16.522 -1.652 L16.522 0 Z",
        "sourceNodeId": "845:3504",
        "stroke": "#FFFFFF",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.652174,
        "transform": "matrix(1 0 0 1 2 2.203)"
      }
    ],
    "instanceNodeIds": [],
    "key": "circleAction",
    "noSymbolReason": "no-instance-or-symbol-in-audited-subtree",
    "overrides": [],
    "size": {
      "height": 38,
      "width": 38
    },
    "sourceKind": "node",
    "sourceNodeIds": [
      "845:3503",
      "845:3504",
      "845:3506",
      "845:3507",
      "845:3508",
      "845:3510"
    ],
    "strokes": [
      {
        "color": "#494A64",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#494A64",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#494A64",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ]
  },
  "bottomNav": {
    "effects": [
      {
        "color": "#000000",
        "offset": {
          "x": 0,
          "y": 1.786134
        },
        "radius": 1.786134,
        "type": "BACKGROUND_BLUR"
      },
      {
        "color": "#000000",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "radius": 2.643479,
        "type": "BACKGROUND_BLUR"
      },
      {
        "color": "#000000",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "radius": 2.643479,
        "type": "BACKGROUND_BLUR"
      },
      {
        "color": "#000000",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "radius": 2.643479,
        "type": "BACKGROUND_BLUR"
      },
      {
        "color": "#939393",
        "offset": {
          "x": 0,
          "y": 4
        },
        "radius": 10,
        "type": "DROP_SHADOW"
      },
      {
        "color": "#9B82E9",
        "offset": {
          "x": 2,
          "y": 2
        },
        "radius": 4,
        "type": "DROP_SHADOW"
      },
      {
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 1.786134
        },
        "radius": 2.679201,
        "type": "DROP_SHADOW"
      },
      {
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "radius": 3.965218,
        "type": "DROP_SHADOW"
      },
      {
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "radius": 3.965218,
        "type": "DROP_SHADOW"
      },
      {
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "radius": 3.965218,
        "type": "DROP_SHADOW"
      }
    ],
    "fills": [
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#D9D9D9",
        "opacity": 0.1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 0.2,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 0.2,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 0.2,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 0.7,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "opacity": 1,
        "type": "GRADIENT_LINEAR",
        "variableIds": []
      }
    ],
    "geometry": [
      {
        "fill": "#D9D9D9",
        "opacity": 1,
        "path": "M0 24 C0 10.745 10.745 0 24 0 L24 0 C37.255 0 48 10.745 48 24 L48 24 C48 37.255 37.255 48 24 48 L24 48 C10.745 48 0 37.255 0 24 L0 24 Z",
        "sourceNodeId": "270:26532",
        "transform": "matrix(1 0 0 1 34.527 3)"
      },
      {
        "fill": "#FFFFFF",
        "opacity": 1,
        "path": "M0 24 C0 10.745 10.745 0 24 0 L24 0 C37.255 0 48 10.745 48 24 L48 24 C48 37.255 37.255 48 24 48 L24 48 C10.745 48 0 37.255 0 24 L0 24 Z",
        "sourceNodeId": "270:26538",
        "transform": "matrix(1 0 0 1 108.527 3)"
      },
      {
        "fill": "#FFFFFF",
        "opacity": 1,
        "path": "M0 24 C0 10.745 10.745 0 24 0 L24 0 C37.255 0 48 10.745 48 24 L48 24 C48 37.255 37.255 48 24 48 L24 48 C10.745 48 0 37.255 0 24 L0 24 Z",
        "sourceNodeId": "270:26546",
        "transform": "matrix(1 0 0 1 182.527 3)"
      },
      {
        "fill": "#FFFFFF",
        "opacity": 1,
        "path": "M0 24 C0 10.745 10.745 0 24 0 L24 0 C37.255 0 48 10.745 48 24 L48 24 C48 37.255 37.255 48 24 48 L24 48 C10.745 48 0 37.255 0 24 L0 24 Z",
        "sourceNodeId": "270:26552",
        "transform": "matrix(1 0 0 1 256.527 3)"
      },
      {
        "fill": "#FFFFFF",
        "opacity": 1,
        "path": "M0 27 C0 12.088 12.088 0 27 0 L308 0 C322.912 0 335 12.088 335 27 L335 27 C335 41.912 322.912 54 308 54 L27 54 C12.088 54 0 41.912 0 27 L0 27 Z",
        "sourceNodeId": "270:26530"
      },
      {
        "opacity": 1,
        "path": "M0 0 L13.991 0 L13.991 13.991 L0 13.991 L0 0 Z",
        "sourceNodeId": "270:26534",
        "transform": "matrix(1 0 0 1 51.032 12.205)"
      },
      {
        "opacity": 1,
        "path": "M0 0 L13.991 0 L13.991 13.991 L0 13.991 L0 0 Z",
        "sourceNodeId": "270:26540",
        "transform": "matrix(1 0 0 1 124.932 13.709)"
      },
      {
        "opacity": 1,
        "path": "M0 0 L13.991 0 L13.991 13.991 L0 13.991 L0 0 Z",
        "sourceNodeId": "270:26548",
        "transform": "matrix(1 0 0 1 198.932 13.709)"
      },
      {
        "opacity": 1,
        "path": "M0 0 L13.991 0 L13.991 13.991 L0 13.991 L0 0 Z",
        "sourceNodeId": "270:26554",
        "transform": "matrix(1 0 0 1 272.932 13.709)"
      },
      {
        "opacity": 1,
        "path": "M0 0 L313 0 L313 48 L0 48 L0 0 Z",
        "sourceNodeId": "270:26531",
        "transform": "matrix(1 0 0 1 13.027 3)"
      },
      {
        "opacity": 1,
        "path": "M0 24 M48 24 M48 24 M0 24 M24 0 M48 24 M24 48 M0 24 M24 48 L24 46.017 C11.84 46.017 1.983 36.16 1.983 24 L0 24 L-1.983 24 C-1.983 38.35 9.65 49.983 24 49.983 L24 48 Z M48 24 L46.017 24 C46.017 36.16 36.16 46.017 24 46.017 L24 48 L24 49.983 C38.35 49.983 49.983 38.35 49.983 24 L48 24 Z M24 0 L24 1.983 C36.16 1.983 46.017 11.84 46.017 24 L48 24 L49.983 24 C49.983 9.65 38.35 -1.983 24 -1.983 L24 0 Z M24 0 L24 -1.983 C9.65 -1.983 -1.983 9.65 -1.983 24 L0 24 L1.983 24 C1.983 11.84 11.84 1.983 24 1.983 L24 0 Z",
        "sourceNodeId": "270:26538",
        "stroke": "#FFFFFF",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.982609,
        "transform": "matrix(1 0 0 1 108.527 3)"
      },
      {
        "opacity": 1,
        "path": "M0 24 M48 24 M48 24 M0 24 M24 0 M48 24 M24 48 M0 24 M24 48 L24 46.017 C11.84 46.017 1.983 36.16 1.983 24 L0 24 L-1.983 24 C-1.983 38.35 9.65 49.983 24 49.983 L24 48 Z M48 24 L46.017 24 C46.017 36.16 36.16 46.017 24 46.017 L24 48 L24 49.983 C38.35 49.983 49.983 38.35 49.983 24 L48 24 Z M24 0 L24 1.983 C36.16 1.983 46.017 11.84 46.017 24 L48 24 L49.983 24 C49.983 9.65 38.35 -1.983 24 -1.983 L24 0 Z M24 0 L24 -1.983 C9.65 -1.983 -1.983 9.65 -1.983 24 L0 24 L1.983 24 C1.983 11.84 11.84 1.983 24 1.983 L24 0 Z",
        "sourceNodeId": "270:26546",
        "stroke": "#FFFFFF",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.982609,
        "transform": "matrix(1 0 0 1 182.527 3)"
      },
      {
        "opacity": 1,
        "path": "M0 24 M48 24 M48 24 M0 24 M24 0 M48 24 M24 48 M0 24 M24 48 L24 46.017 C11.84 46.017 1.983 36.16 1.983 24 L0 24 L-1.983 24 C-1.983 38.35 9.65 49.983 24 49.983 L24 48 Z M48 24 L46.017 24 C46.017 36.16 36.16 46.017 24 46.017 L24 48 L24 49.983 C38.35 49.983 49.983 38.35 49.983 24 L48 24 Z M24 0 L24 1.983 C36.16 1.983 46.017 11.84 46.017 24 L48 24 L49.983 24 C49.983 9.65 38.35 -1.983 24 -1.983 L24 0 Z M24 0 L24 -1.983 C9.65 -1.983 -1.983 9.65 -1.983 24 L0 24 L1.983 24 C1.983 11.84 11.84 1.983 24 1.983 L24 0 Z",
        "sourceNodeId": "270:26552",
        "stroke": "#FFFFFF",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.982609,
        "transform": "matrix(1 0 0 1 256.527 3)"
      },
      {
        "opacity": 1,
        "path": "M0 27 M335 27 M335 27 M0 27 M27 0 L27 1.34 L308 1.34 L308 0 L308 -1.34 L27 -1.34 L27 0 Z M335 27 M308 54 L308 52.66 L27 52.66 L27 54 L27 55.34 L308 55.34 L308 54 Z M0 27 M27 54 L27 52.66 C12.828 52.66 1.34 41.172 1.34 27 L0 27 L-1.34 27 C-1.34 42.652 11.348 55.34 27 55.34 L27 54 Z M335 27 L333.66 27 C333.66 41.172 322.172 52.66 308 52.66 L308 54 L308 55.34 C323.652 55.34 336.34 42.652 336.34 27 L335 27 Z M308 0 L308 1.34 C322.172 1.34 333.66 12.828 333.66 27 L335 27 L336.34 27 C336.34 11.348 323.652 -1.34 308 -1.34 L308 0 Z M27 0 L27 -1.34 C11.348 -1.34 -1.34 11.348 -1.34 27 L0 27 L1.34 27 C1.34 12.828 12.828 1.34 27 1.34 L27 0 Z",
        "sourceNodeId": "270:26530",
        "stroke": "#FFFFFF",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.339601
      },
      {
        "opacity": 1,
        "path": "M0 4.663 L0.75 4.663 L0.75 4.663 L0 4.663 Z M0.413 3.773 L0.897 4.345 L0.901 4.342 L0.413 3.773 Z M4.494 0.275 L4.01 -0.297 L4.006 -0.294 L4.494 0.275 Z M5.247 0 L5.247 -0.75 L5.247 0 Z M5.999 0.275 L6.487 -0.294 L6.483 -0.297 L5.999 0.275 Z M10.08 3.773 L9.592 4.342 L9.596 4.345 L10.08 3.773 Z M10.493 4.663 L9.743 4.663 L9.743 4.663 L10.493 4.663 Z M0 9.91 L-0.75 9.91 L0 9.91 Z M0 4.663 L0.75 4.663 C0.75 4.603 0.763 4.543 0.789 4.488 L0.108 4.172 L-0.572 3.857 C-0.689 4.109 -0.75 4.385 -0.75 4.664 L0 4.663 Z M0.108 4.172 L0.789 4.488 C0.814 4.433 0.851 4.384 0.897 4.345 L0.413 3.773 L-0.071 3.2 C-0.284 3.38 -0.455 3.604 -0.572 3.857 L0.108 4.172 Z M0.413 3.773 L0.901 4.342 L4.982 0.845 L4.494 0.275 L4.006 -0.294 L-0.075 3.203 L0.413 3.773 Z M4.494 0.275 L4.978 0.848 C5.053 0.785 5.148 0.75 5.247 0.75 L5.247 0 L5.247 -0.75 C4.794 -0.75 4.356 -0.59 4.01 -0.297 L4.494 0.275 Z M5.247 0 L5.247 0.75 C5.345 0.75 5.44 0.785 5.515 0.848 L5.999 0.275 L6.483 -0.297 C6.137 -0.59 5.699 -0.75 5.247 -0.75 L5.247 0 Z M5.999 0.275 L5.511 0.845 L9.592 4.342 L10.08 3.773 L10.568 3.203 L6.487 -0.294 L5.999 0.275 Z M10.08 3.773 L9.596 4.345 C9.642 4.384 9.679 4.433 9.705 4.488 L10.385 4.172 L11.065 3.857 C10.948 3.604 10.777 3.38 10.564 3.2 L10.08 3.773 Z M10.385 4.172 L9.705 4.488 C9.73 4.543 9.743 4.603 9.743 4.663 L10.493 4.663 L11.243 4.664 C11.243 4.385 11.182 4.109 11.065 3.857 L10.385 4.172 Z M10.493 4.663 L9.743 4.663 L9.743 9.91 L10.493 9.91 L11.243 9.91 L11.243 4.663 L10.493 4.663 Z M10.493 9.91 L9.743 9.91 C9.743 10.02 9.699 10.126 9.621 10.204 L10.152 10.734 L10.682 11.265 C11.041 10.905 11.243 10.418 11.243 9.91 L10.493 9.91 Z M10.152 10.734 L9.621 10.204 C9.543 10.282 9.438 10.326 9.327 10.326 L9.327 11.076 L9.327 11.826 C9.835 11.826 10.323 11.624 10.682 11.265 L10.152 10.734 Z M9.327 11.076 L9.327 10.326 L1.166 10.326 L1.166 11.076 L1.166 11.826 L9.327 11.826 L9.327 11.076 Z M1.166 11.076 L1.166 10.326 C1.056 10.326 0.95 10.282 0.872 10.204 L0.341 10.734 L-0.189 11.265 C0.17 11.624 0.658 11.826 1.166 11.826 L1.166 11.076 Z M0.341 10.734 L0.872 10.204 C0.794 10.126 0.75 10.02 0.75 9.91 L0 9.91 L-0.75 9.91 C-0.75 10.418 -0.548 10.905 -0.189 11.265 L0.341 10.734 Z M0 9.91 L0.75 9.91 L0.75 4.663 L0 4.663 L-0.75 4.663 L-0.75 9.91 L0 9.91 Z",
        "sourceNodeId": "270:26536",
        "stroke": "#FFFFFF",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 52.78 13.371)"
      },
      {
        "opacity": 1,
        "path": "M0.583 0 L0.583 0.75 L3.498 0.75 L3.498 0 L3.498 -0.75 L0.583 -0.75 L0.583 0 Z M3.498 0 L3.498 0.75 C3.405 0.75 3.331 0.675 3.331 0.583 L4.081 0.583 L4.831 0.583 C4.831 -0.153 4.234 -0.75 3.498 -0.75 L3.498 0 Z M4.081 0.583 L3.331 0.583 L3.331 3.498 L4.081 3.498 L4.831 3.498 L4.831 0.583 L4.081 0.583 Z M4.081 3.498 L3.331 3.498 C3.331 3.405 3.405 3.331 3.498 3.331 L3.498 4.081 L3.498 4.831 C4.234 4.831 4.831 4.234 4.831 3.498 L4.081 3.498 Z M3.498 4.081 L3.498 3.331 L0.583 3.331 L0.583 4.081 L0.583 4.831 L3.498 4.831 L3.498 4.081 Z M0.583 4.081 L0.583 3.331 C0.675 3.331 0.75 3.405 0.75 3.498 L0 3.498 L-0.75 3.498 C-0.75 4.234 -0.153 4.831 0.583 4.831 L0.583 4.081 Z M0 3.498 L0.75 3.498 L0.75 0.583 L0 0.583 L-0.75 0.583 L-0.75 3.498 L0 3.498 Z M0 0.583 L0.75 0.583 C0.75 0.675 0.675 0.75 0.583 0.75 L0.583 0 L0.583 -0.75 C-0.153 -0.75 -0.75 -0.153 -0.75 0.583 L0 0.583 Z",
        "sourceNodeId": "270:26541",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 126.68 15.457)"
      },
      {
        "opacity": 1,
        "path": "M0.583 0 L0.583 0.75 L3.498 0.75 L3.498 0 L3.498 -0.75 L0.583 -0.75 L0.583 0 Z M3.498 0 L3.498 0.75 C3.405 0.75 3.331 0.675 3.331 0.583 L4.081 0.583 L4.831 0.583 C4.831 -0.153 4.234 -0.75 3.498 -0.75 L3.498 0 Z M4.081 0.583 L3.331 0.583 L3.331 3.498 L4.081 3.498 L4.831 3.498 L4.831 0.583 L4.081 0.583 Z M4.081 3.498 L3.331 3.498 C3.331 3.405 3.405 3.331 3.498 3.331 L3.498 4.081 L3.498 4.831 C4.234 4.831 4.831 4.234 4.831 3.498 L4.081 3.498 Z M3.498 4.081 L3.498 3.331 L0.583 3.331 L0.583 4.081 L0.583 4.831 L3.498 4.831 L3.498 4.081 Z M0.583 4.081 L0.583 3.331 C0.675 3.331 0.75 3.405 0.75 3.498 L0 3.498 L-0.75 3.498 C-0.75 4.234 -0.153 4.831 0.583 4.831 L0.583 4.081 Z M0 3.498 L0.75 3.498 L0.75 0.583 L0 0.583 L-0.75 0.583 L-0.75 3.498 L0 3.498 Z M0 0.583 L0.75 0.583 C0.75 0.675 0.675 0.75 0.583 0.75 L0.583 0 L0.583 -0.75 C-0.153 -0.75 -0.75 -0.153 -0.75 0.583 L0 0.583 Z",
        "sourceNodeId": "270:26542",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 133.093 15.457)"
      },
      {
        "opacity": 1,
        "path": "M0.583 0 L0.583 0.75 L3.498 0.75 L3.498 0 L3.498 -0.75 L0.583 -0.75 L0.583 0 Z M3.498 0 L3.498 0.75 C3.405 0.75 3.331 0.675 3.331 0.583 L4.081 0.583 L4.831 0.583 C4.831 -0.153 4.234 -0.75 3.498 -0.75 L3.498 0 Z M4.081 0.583 L3.331 0.583 L3.331 3.498 L4.081 3.498 L4.831 3.498 L4.831 0.583 L4.081 0.583 Z M4.081 3.498 L3.331 3.498 C3.331 3.405 3.405 3.331 3.498 3.331 L3.498 4.081 L3.498 4.831 C4.234 4.831 4.831 4.234 4.831 3.498 L4.081 3.498 Z M3.498 4.081 L3.498 3.331 L0.583 3.331 L0.583 4.081 L0.583 4.831 L3.498 4.831 L3.498 4.081 Z M0.583 4.081 L0.583 3.331 C0.675 3.331 0.75 3.405 0.75 3.498 L0 3.498 L-0.75 3.498 C-0.75 4.234 -0.153 4.831 0.583 4.831 L0.583 4.081 Z M0 3.498 L0.75 3.498 L0.75 0.583 L0 0.583 L-0.75 0.583 L-0.75 3.498 L0 3.498 Z M0 0.583 L0.75 0.583 C0.75 0.675 0.675 0.75 0.583 0.75 L0.583 0 L0.583 -0.75 C-0.153 -0.75 -0.75 -0.153 -0.75 0.583 L0 0.583 Z",
        "sourceNodeId": "270:26543",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 133.093 21.87)"
      },
      {
        "opacity": 1,
        "path": "M0.583 0 L0.583 0.75 L3.498 0.75 L3.498 0 L3.498 -0.75 L0.583 -0.75 L0.583 0 Z M3.498 0 L3.498 0.75 C3.405 0.75 3.331 0.675 3.331 0.583 L4.081 0.583 L4.831 0.583 C4.831 -0.153 4.234 -0.75 3.498 -0.75 L3.498 0 Z M4.081 0.583 L3.331 0.583 L3.331 3.498 L4.081 3.498 L4.831 3.498 L4.831 0.583 L4.081 0.583 Z M4.081 3.498 L3.331 3.498 C3.331 3.405 3.405 3.331 3.498 3.331 L3.498 4.081 L3.498 4.831 C4.234 4.831 4.831 4.234 4.831 3.498 L4.081 3.498 Z M3.498 4.081 L3.498 3.331 L0.583 3.331 L0.583 4.081 L0.583 4.831 L3.498 4.831 L3.498 4.081 Z M0.583 4.081 L0.583 3.331 C0.675 3.331 0.75 3.405 0.75 3.498 L0 3.498 L-0.75 3.498 C-0.75 4.234 -0.153 4.831 0.583 4.831 L0.583 4.081 Z M0 3.498 L0.75 3.498 L0.75 0.583 L0 0.583 L-0.75 0.583 L-0.75 3.498 L0 3.498 Z M0 0.583 L0.75 0.583 C0.75 0.675 0.675 0.75 0.583 0.75 L0.583 0 L0.583 -0.75 C-0.153 -0.75 -0.75 -0.153 -0.75 0.583 L0 0.583 Z",
        "sourceNodeId": "270:26544",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 126.68 21.87)"
      },
      {
        "opacity": 1,
        "path": "M11.659 5.83 L10.909 5.83 C10.909 8.635 8.635 10.909 5.83 10.909 L5.83 11.659 L5.83 12.409 C9.463 12.409 12.409 9.463 12.409 5.83 L11.659 5.83 Z M5.83 11.659 L5.83 10.909 C3.024 10.909 0.75 8.635 0.75 5.83 L0 5.83 L-0.75 5.83 C-0.75 9.463 2.196 12.409 5.83 12.409 L5.83 11.659 Z M0 5.83 L0.75 5.83 C0.75 3.024 3.024 0.75 5.83 0.75 L5.83 0 L5.83 -0.75 C2.196 -0.75 -0.75 2.196 -0.75 5.83 L0 5.83 Z M5.83 0 L5.83 0.75 C8.635 0.75 10.909 3.024 10.909 5.83 L11.659 5.83 L12.409 5.83 C12.409 2.196 9.463 -0.75 5.83 -0.75 L5.83 0 Z",
        "sourceNodeId": "270:26550",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 200.097 14.874)"
      },
      {
        "opacity": 1,
        "path": "M3.498 5.247 L4.248 5.247 L4.248 0.583 L3.498 0.583 L2.748 0.583 L2.748 5.247 L3.498 5.247 Z M3.498 0.583 L4.248 0.583 C4.248 0.229 4.107 -0.11 3.857 -0.36 L3.327 0.171 L2.797 0.701 C2.765 0.67 2.748 0.627 2.748 0.583 L3.498 0.583 Z M3.327 0.171 L3.857 -0.36 C3.607 -0.61 3.268 -0.75 2.915 -0.75 L2.915 0 L2.915 0.75 C2.87 0.75 2.828 0.732 2.797 0.701 L3.327 0.171 Z M2.915 0 L2.915 -0.75 L0.583 -0.75 L0.583 0 L0.583 0.75 L2.915 0.75 L2.915 0 Z M0.583 0 L0.583 -0.75 C0.229 -0.75 -0.11 -0.61 -0.36 -0.36 L0.171 0.171 L0.701 0.701 C0.67 0.732 0.627 0.75 0.583 0.75 L0.583 0 Z M0.171 0.171 L-0.36 -0.36 C-0.61 -0.11 -0.75 0.229 -0.75 0.583 L0 0.583 L0.75 0.583 C0.75 0.627 0.732 0.67 0.701 0.701 L0.171 0.171 Z M0 0.583 L-0.75 0.583 L-0.75 5.247 L0 5.247 L0.75 5.247 L0.75 0.583 L0 0.583 Z",
        "sourceNodeId": "270:26535",
        "stroke": "#FFFFFF",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 56.278 19.2)"
      },
      {
        "opacity": 1,
        "path": "M4.664 2.332 L3.914 2.332 C3.914 3.205 3.205 3.914 2.332 3.914 L2.332 4.664 L2.332 5.414 C4.034 5.414 5.414 4.034 5.414 2.332 L4.664 2.332 Z M2.332 4.664 L2.332 3.914 C1.458 3.914 0.75 3.205 0.75 2.332 L0 2.332 L-0.75 2.332 C-0.75 4.034 0.63 5.414 2.332 5.414 L2.332 4.664 Z M0 2.332 L0.75 2.332 C0.75 1.458 1.458 0.75 2.332 0.75 L2.332 0 L2.332 -0.75 C0.63 -0.75 -0.75 0.63 -0.75 2.332 L0 2.332 Z M2.332 0 L2.332 0.75 C3.205 0.75 3.914 1.458 3.914 2.332 L4.664 2.332 L5.414 2.332 C5.414 0.63 4.034 -0.75 2.332 -0.75 L2.332 0 Z",
        "sourceNodeId": "270:26556",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 277.595 15.457)"
      },
      {
        "opacity": 1,
        "path": "M4.943 0 L5.655 0.237 L6.129 -1.186 L4.706 -0.711 L4.943 0 Z M3.892 3.154 L3.18 2.917 L3.18 2.917 L3.892 3.154 Z M3.154 3.892 L2.917 3.18 L2.917 3.18 L3.154 3.892 Z M0 4.943 L-0.711 4.706 L-1.186 6.129 L0.237 5.655 L0 4.943 Z M1.052 1.789 L1.763 2.026 L1.763 2.026 L1.052 1.789 Z M1.789 1.052 L2.026 1.763 L2.026 1.763 L1.789 1.052 Z M4.943 0 L4.232 -0.237 L3.18 2.917 L3.892 3.154 L4.603 3.392 L5.655 0.237 L4.943 0 Z M3.892 3.154 L3.18 2.917 C3.16 2.978 3.125 3.034 3.08 3.08 L3.61 3.61 L4.14 4.14 C4.351 3.93 4.509 3.674 4.603 3.392 L3.892 3.154 Z M3.61 3.61 L3.08 3.08 C3.034 3.125 2.978 3.16 2.917 3.18 L3.154 3.892 L3.392 4.603 C3.674 4.509 3.93 4.351 4.14 4.14 L3.61 3.61 Z M3.154 3.892 L2.917 3.18 L-0.237 4.232 L0 4.943 L0.237 5.655 L3.392 4.603 L3.154 3.892 Z M0 4.943 L0.711 5.181 L1.763 2.026 L1.052 1.789 L0.34 1.552 L-0.711 4.706 L0 4.943 Z M1.052 1.789 L1.763 2.026 C1.784 1.965 1.818 1.909 1.864 1.864 L1.333 1.333 L0.803 0.803 C0.593 1.013 0.434 1.27 0.34 1.552 L1.052 1.789 Z M1.333 1.333 L1.864 1.864 C1.909 1.818 1.965 1.784 2.026 1.763 L1.789 1.052 L1.552 0.34 C1.27 0.434 1.013 0.593 0.803 0.803 L1.333 1.333 Z M1.789 1.052 L2.026 1.763 L5.181 0.711 L4.943 0 L4.706 -0.711 L1.552 0.34 L1.789 1.052 Z",
        "sourceNodeId": "270:26549",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 203.455 18.232)"
      },
      {
        "opacity": 1,
        "path": "M5.83 0 L5.83 -0.75 L5.83 0 Z M2.332 0 L2.332 -0.75 L2.332 0 Z M0 2.332 L-0.75 2.332 L0 2.332 Z M8.161 3.498 L8.911 3.498 L8.911 2.332 L8.161 2.332 L7.411 2.332 L7.411 3.498 L8.161 3.498 Z M8.161 2.332 L8.911 2.332 C8.911 1.514 8.587 0.731 8.009 0.153 L7.478 0.683 L6.948 1.213 C7.245 1.51 7.411 1.912 7.411 2.332 L8.161 2.332 Z M7.478 0.683 L8.009 0.153 C7.431 -0.425 6.647 -0.75 5.83 -0.75 L5.83 0 L5.83 0.75 C6.249 0.75 6.651 0.917 6.948 1.213 L7.478 0.683 Z M5.83 0 L5.83 -0.75 L2.332 -0.75 L2.332 0 L2.332 0.75 L5.83 0.75 L5.83 0 Z M2.332 0 L2.332 -0.75 C1.514 -0.75 0.731 -0.425 0.153 0.153 L0.683 0.683 L1.213 1.213 C1.51 0.917 1.912 0.75 2.332 0.75 L2.332 0 Z M0.683 0.683 L0.153 0.153 C-0.425 0.731 -0.75 1.514 -0.75 2.332 L0 2.332 L0.75 2.332 C0.75 1.912 0.917 1.51 1.213 1.213 L0.683 0.683 Z M0 2.332 L-0.75 2.332 L-0.75 3.498 L0 3.498 L0.75 3.498 L0.75 2.332 L0 2.332 Z",
        "sourceNodeId": "270:26555",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 275.846 22.453)"
      }
    ],
    "instanceNodeIds": [],
    "key": "bottomNav",
    "noSymbolReason": "no-instance-or-symbol-in-audited-subtree",
    "overrides": [],
    "size": {
      "height": 54,
      "width": 335
    },
    "sourceKind": "node",
    "sourceNodeIds": [
      "270:26530",
      "270:26531",
      "270:26532",
      "270:26534",
      "270:26535",
      "270:26536",
      "270:26538",
      "270:26540",
      "270:26541",
      "270:26542",
      "270:26543",
      "270:26544",
      "270:26546",
      "270:26548",
      "270:26549",
      "270:26550",
      "270:26552",
      "270:26554",
      "270:26555",
      "270:26556"
    ],
    "strokes": [
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#6B7280",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#E4E4E7",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#E4E4E7",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#E4E4E7",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#E4E4E7",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ]
  },
  "glassCard": {
    "effects": [],
    "fills": [
      {
        "color": "#6646C6",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "opacity": 1,
        "type": "GRADIENT_LINEAR",
        "variableIds": []
      }
    ],
    "geometry": [
      {
        "fill": "#FFFFFF",
        "opacity": 1,
        "path": "M2.333 11.667 L2.917 7.583 L0 7.583 L5.25 0 L6.417 0 L5.833 4.667 L9.333 4.667 L3.5 11.667 L2.333 11.667 L2.333 11.667",
        "sourceNodeId": "825:6578",
        "transform": "matrix(1 0 0 1 7.333 6.167)"
      },
      {
        "opacity": 1,
        "path": "M0 12 C0 5.373 5.373 0 12 0 L12 0 C18.627 0 24 5.373 24 12 L24 12 C24 18.627 18.627 24 12 24 L12 24 C5.373 24 0 18.627 0 12 L0 12 Z",
        "sourceNodeId": "825:6576"
      }
    ],
    "instanceNodeIds": [],
    "key": "glassCard",
    "noSymbolReason": "no-instance-or-symbol-in-audited-subtree",
    "overrides": [],
    "size": {
      "height": 24,
      "width": 391.549988
    },
    "sourceKind": "node",
    "sourceNodeIds": [
      "825:6575",
      "825:6576",
      "825:6578"
    ],
    "strokes": []
  }
} as const satisfies Readonly<Record<MobilePrimitiveKey, FigmaPrimitiveEvidence>>;

export const figmaMobileIcons = {
  "settings": {
    "layers": [
      {
        "opacity": 1,
        "path": "M0.75 -1.5 C0.336 -1.5 0 -1.164 0 -0.75 C0 -0.336 0.336 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M12.25 0 C12.664 0 13 -0.336 13 -0.75 C13 -1.164 12.664 -1.5 12.25 -1.5 L12.25 -0.75 L12.25 0 Z M0.75 -0.75 L0.75 0 L12.25 0 L12.25 -0.75 L12.25 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "248:20528",
        "stroke": "#494A64",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(-1 0 0 -1 26 18)"
      },
      {
        "opacity": 1,
        "path": "M0.75 -1.5 C0.336 -1.5 0 -1.164 0 -0.75 C0 -0.336 0.336 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711 0 C8.125 0 8.461 -0.336 8.461 -0.75 C8.461 -1.164 8.125 -1.5 7.711 -1.5 L7.711 -0.75 L7.711 0 Z M0.75 -0.75 L0.75 0 L7.711 0 L7.711 -0.75 L7.711 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "248:20526",
        "stroke": "#494A64",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(-0.64 0.768 -0.768 -0.64 18.417 12)"
      },
      {
        "opacity": 1,
        "path": "M0.75 -1.5 C0.336 -1.5 0 -1.164 0 -0.75 C0 -0.336 0.336 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711 0 C8.125 0 8.461 -0.336 8.461 -0.75 C8.461 -1.164 8.125 -1.5 7.711 -1.5 L7.711 -0.75 L7.711 0 Z M0.75 -0.75 L0.75 0 L7.711 0 L7.711 -0.75 L7.711 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "248:20527",
        "stroke": "#494A64",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(-0.64 -0.768 -0.768 0.64 18.417 25.5)"
      }
    ],
    "sourceNodeIds": [
      "248:20526",
      "248:20527",
      "248:20528"
    ],
    "viewBox": "0 0 38 38"
  },
  "back": {
    "layers": [
      {
        "opacity": 1,
        "path": "M0.75 -1.5 C0.336 -1.5 0 -1.164 0 -0.75 C0 -0.336 0.336 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M12.25 0 C12.664 0 13 -0.336 13 -0.75 C13 -1.164 12.664 -1.5 12.25 -1.5 L12.25 -0.75 L12.25 0 Z M0.75 -0.75 L0.75 0 L12.25 0 L12.25 -0.75 L12.25 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "845:3508",
        "stroke": "#494A64",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(-1 0 0 -1 26 18)"
      },
      {
        "opacity": 1,
        "path": "M0.75 -1.5 C0.336 -1.5 0 -1.164 0 -0.75 C0 -0.336 0.336 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711 0 C8.125 0 8.461 -0.336 8.461 -0.75 C8.461 -1.164 8.125 -1.5 7.711 -1.5 L7.711 -0.75 L7.711 0 Z M0.75 -0.75 L0.75 0 L7.711 0 L7.711 -0.75 L7.711 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "845:3506",
        "stroke": "#494A64",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(-0.64 0.768 -0.768 -0.64 18.417 12)"
      },
      {
        "opacity": 1,
        "path": "M0.75 -1.5 C0.336 -1.5 0 -1.164 0 -0.75 C0 -0.336 0.336 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711 0 C8.125 0 8.461 -0.336 8.461 -0.75 C8.461 -1.164 8.125 -1.5 7.711 -1.5 L7.711 -0.75 L7.711 0 Z M0.75 -0.75 L0.75 0 L7.711 0 L7.711 -0.75 L7.711 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "845:3507",
        "stroke": "#494A64",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(-0.64 -0.768 -0.768 0.64 18.417 25.5)"
      }
    ],
    "sourceNodeIds": [
      "845:3506",
      "845:3507",
      "845:3508"
    ],
    "viewBox": "0 0 38 38"
  },
  "share": {
    "layers": [
      {
        "fill": "#494A64",
        "opacity": 1,
        "path": "M8.534 2.839 C8.534 1.271 9.806 0 11.374 0 C12.686 -0.007 13.832 0.885 14.147 2.16 C14.461 3.434 13.861 4.757 12.696 5.361 C11.531 5.964 10.104 5.691 9.244 4.699 L5.631 6.502 C5.715 6.895 5.715 7.302 5.631 7.695 L9.244 9.498 C10.152 8.468 11.667 8.236 12.843 8.946 C14.018 9.656 14.516 11.106 14.026 12.389 C13.537 13.671 12.199 14.42 10.85 14.167 C9.5 13.914 8.525 12.731 8.534 11.358 C8.534 11.157 8.555 10.957 8.598 10.762 L4.985 8.958 C4.209 9.854 2.957 10.173 1.847 9.759 C0.736 9.345 0 8.284 0 7.099 C0 5.913 0.736 4.853 1.847 4.438 C2.957 4.024 4.209 4.343 4.985 5.239 L8.598 3.436 C8.555 3.24 8.534 3.04 8.534 2.839 Z M12.793 2.84 C12.793 2.056 12.158 1.42 11.374 1.42 C10.59 1.42 9.954 2.056 9.954 2.84 C9.954 3.624 10.59 4.259 11.374 4.259 C12.158 4.259 12.793 3.624 12.793 2.84 Z M2.855 5.679 C3.639 5.679 4.275 6.315 4.275 7.099 C4.275 7.883 3.639 8.519 2.855 8.519 C2.071 8.519 1.436 7.883 1.436 7.099 C1.436 6.315 2.071 5.679 2.855 5.679 Z M12.793 11.358 C12.793 10.574 12.158 9.938 11.374 9.938 C10.59 9.938 9.954 10.574 9.954 11.358 C9.954 12.142 10.59 12.778 11.374 12.778 C12.158 12.778 12.793 12.142 12.793 11.358 Z",
        "sourceNodeId": "845:3513",
        "transform": "matrix(1 0 0 1 10.404 12.42)"
      }
    ],
    "sourceNodeIds": [
      "845:3513"
    ],
    "viewBox": "0 0 38 38"
  },
  "search": {
    "layers": [
      {
        "opacity": 1,
        "path": "M2.15 2.15 L2.504 1.796 L0.354 -0.354 L0 0 L-0.354 0.354 L1.796 2.504 L2.15 2.15 Z",
        "sourceNodeId": "270:26627",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1,
        "transform": "matrix(1 0 0 1 8.35 8.35)"
      },
      {
        "opacity": 1,
        "path": "M8 4 L7.5 4 C7.5 5.933 5.933 7.5 4 7.5 L4 8 L4 8.5 C6.485 8.5 8.5 6.485 8.5 4 L8 4 Z M4 8 L4 7.5 C2.067 7.5 0.5 5.933 0.5 4 L0 4 L-0.5 4 C-0.5 6.485 1.515 8.5 4 8.5 L4 8 Z M0 4 L0.5 4 C0.5 2.067 2.067 0.5 4 0.5 L4 0 L4 -0.5 C1.515 -0.5 -0.5 1.515 -0.5 4 L0 4 Z M4 0 L4 0.5 C5.933 0.5 7.5 2.067 7.5 4 L8 4 L8.5 4 C8.5 1.515 6.485 -0.5 4 -0.5 L4 0 Z",
        "sourceNodeId": "270:26626",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1,
        "transform": "matrix(1 0 0 1 1.5 1.5)"
      }
    ],
    "sourceNodeIds": [
      "270:26626",
      "270:26627"
    ],
    "viewBox": "0 0 12 12"
  },
  "bell": {
    "layers": [
      {
        "fill": "#000000",
        "opacity": 1,
        "path": "M0 0 L15 0 L15 15 L0 15 L0 0 Z",
        "sourceNodeId": "825:6483"
      },
      {
        "fill": "#7C62FF",
        "opacity": 1,
        "path": "M5.626 0.005 C4.616 -0.046 3.633 0.333 2.918 1.047 C2.204 1.762 1.825 2.745 1.876 3.755 L1.876 5.63 C1.876 5.83 1.769 5.967 1.426 6.255 L1.176 6.492 C0.425 6.997 -0.018 7.85 0.001 8.755 C0.001 9.598 0.663 9.898 1.682 10.005 L2.501 10.005 L8.751 10.005 L9.569 10.005 C10.588 9.917 11.251 9.617 11.251 8.755 C11.268 7.843 10.827 6.984 10.076 6.467 L9.807 6.255 C9.463 5.973 9.376 5.83 9.376 5.63 L9.376 3.755 C9.426 2.745 9.048 1.762 8.333 1.047 C7.618 0.333 6.635 -0.046 5.626 0.005 Z M5.626 1.254 C6.303 1.203 6.969 1.45 7.449 1.931 C7.93 2.411 8.177 3.077 8.126 3.754 L8.126 5.629 C8.137 6.271 8.467 6.864 9.007 7.211 L9.301 7.448 C9.709 7.711 9.969 8.151 10.001 8.636 C9.829 8.692 9.65 8.726 9.469 8.736 L8.769 8.736 L2.501 8.736 L1.801 8.736 C1.613 8.728 1.428 8.694 1.251 8.636 C1.278 8.155 1.531 7.715 1.932 7.448 L2.207 7.211 C2.761 6.873 3.106 6.278 3.126 5.629 L3.126 3.754 C3.074 3.077 3.321 2.411 3.802 1.931 C4.282 1.45 4.948 1.203 5.626 1.254 Z M5.626 11.254 C5.266 11.252 4.924 11.095 4.688 10.823 C4.549 10.631 4.314 10.534 4.08 10.573 C3.846 10.611 3.654 10.779 3.584 11.005 C3.514 11.232 3.579 11.478 3.751 11.642 C4.219 12.19 4.904 12.505 5.626 12.504 C6.342 12.507 7.024 12.202 7.501 11.667 C7.71 11.406 7.678 11.027 7.427 10.806 C7.176 10.585 6.795 10.601 6.563 10.842 C6.324 11.107 5.983 11.257 5.626 11.254 Z",
        "sourceNodeId": "825:6484",
        "transform": "matrix(1 0 0 1 1.874 1.246)"
      }
    ],
    "sourceNodeIds": [
      "825:6483",
      "825:6484"
    ],
    "viewBox": "0 0 15 15"
  },
  "microphone": {
    "layers": [
      {
        "fill": "#7F80A1",
        "opacity": 1,
        "path": "M8.002 0 C5.241 0 3.002 2.239 3.002 5 L3.002 9 C3.002 11.761 5.241 14 8.002 14 C10.763 14 13.002 11.761 13.002 9 L13.002 5 C13.002 2.239 10.763 0 8.002 0 Z M8.002 2 C9.659 2 11.002 3.343 11.002 5 L11.002 9 C11.002 10.657 9.659 12 8.002 12 C6.345 12 5.002 10.657 5.002 9 L5.002 5 C5.002 3.343 6.345 2 8.002 2 Z M8.002 16 C5.479 16.026 3.137 14.693 1.872 12.51 C1.75 12.265 1.534 12.081 1.272 12 C1.012 11.94 0.738 11.987 0.512 12.13 C0.279 12.26 0.108 12.478 0.036 12.736 C-0.035 12.993 0 13.268 0.132 13.5 C1.579 15.995 4.133 17.646 7.002 17.94 L7.002 19 C7.002 19.552 7.45 20 8.002 20 C8.555 20 9.002 19.552 9.002 19 L9.002 17.94 C11.862 17.628 14.406 15.981 15.862 13.5 C16.124 13.032 15.969 12.441 15.512 12.16 C15.284 12.018 15.007 11.973 14.746 12.037 C14.484 12.101 14.259 12.268 14.122 12.5 C12.849 14.672 10.519 16.004 8.002 16 Z",
        "sourceNodeId": "845:3535"
      }
    ],
    "sourceNodeIds": [
      "845:3535"
    ],
    "viewBox": "0 0 15.989 20"
  },
  "send": {
    "layers": [
      {
        "fill": "#FFFFFF",
        "opacity": 1,
        "path": "M8.482 0.456 C9.073 0.164 9.722 0.009 10.381 0 C11.956 0.032 12.601 1.436 11.627 3.575 L7.932 11.111 C7.299 12.541 5.958 12.376 5.642 10.87 L4.851 7.276 L1.25 6.485 C-0.293 6.144 -0.433 4.834 0.972 4.151 L8.482 0.456 Z M10.482 3.063 C11.083 1.734 10.962 1.145 10.121 1.266 L10.121 1.247 C9.75 1.319 9.392 1.445 9.058 1.62 L1.56 5.239 L5.496 6.106 C5.732 6.16 5.916 6.344 5.97 6.58 L6.843 10.516 L10.482 3.063 Z",
        "sourceNodeId": "845:3540",
        "transform": "matrix(1 0 0 1 13.456 13.952)"
      }
    ],
    "sourceNodeIds": [
      "845:3540"
    ],
    "viewBox": "0 0 40 40"
  },
  "arrow-right": {
    "layers": [
      {
        "opacity": 1,
        "path": "M2.576 2.576 L2.88 2.88 L3.183 2.576 L2.88 2.272 L2.576 2.576 Z M0 5.152 L0.304 5.456 L2.88 2.88 L2.576 2.576 L2.272 2.272 L-0.304 4.848 L0 5.152 Z M2.576 2.576 L2.88 2.272 L0.304 -0.304 L0 0 L-0.304 0.304 L2.272 2.88 L2.576 2.576 Z",
        "sourceNodeId": "825:7025",
        "stroke": "#8B8FAF",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 0.858667,
        "transform": "matrix(1 0 0 1 3.864 2.576)"
      }
    ],
    "sourceNodeIds": [
      "825:7025"
    ],
    "viewBox": "0 0 10.304 10.304"
  },
  "house": {
    "layers": [
      {
        "opacity": 1,
        "path": "M0 4.663 L0.75 4.663 L0.75 4.663 L0 4.663 Z M0.413 3.773 L0.897 4.345 L0.901 4.342 L0.413 3.773 Z M4.494 0.275 L4.01 -0.297 L4.006 -0.294 L4.494 0.275 Z M5.247 0 L5.247 -0.75 L5.247 0 Z M5.999 0.275 L6.487 -0.294 L6.483 -0.297 L5.999 0.275 Z M10.08 3.773 L9.592 4.342 L9.596 4.345 L10.08 3.773 Z M10.493 4.663 L9.743 4.663 L9.743 4.663 L10.493 4.663 Z M0 9.91 L-0.75 9.91 L0 9.91 Z M0 4.663 L0.75 4.663 C0.75 4.603 0.763 4.543 0.789 4.488 L0.108 4.172 L-0.572 3.857 C-0.689 4.109 -0.75 4.385 -0.75 4.664 L0 4.663 Z M0.108 4.172 L0.789 4.488 C0.814 4.433 0.851 4.384 0.897 4.345 L0.413 3.773 L-0.071 3.2 C-0.284 3.38 -0.455 3.604 -0.572 3.857 L0.108 4.172 Z M0.413 3.773 L0.901 4.342 L4.982 0.845 L4.494 0.275 L4.006 -0.294 L-0.075 3.203 L0.413 3.773 Z M4.494 0.275 L4.978 0.848 C5.053 0.785 5.148 0.75 5.247 0.75 L5.247 0 L5.247 -0.75 C4.794 -0.75 4.356 -0.59 4.01 -0.297 L4.494 0.275 Z M5.247 0 L5.247 0.75 C5.345 0.75 5.44 0.785 5.515 0.848 L5.999 0.275 L6.483 -0.297 C6.137 -0.59 5.699 -0.75 5.247 -0.75 L5.247 0 Z M5.999 0.275 L5.511 0.845 L9.592 4.342 L10.08 3.773 L10.568 3.203 L6.487 -0.294 L5.999 0.275 Z M10.08 3.773 L9.596 4.345 C9.642 4.384 9.679 4.433 9.705 4.488 L10.385 4.172 L11.065 3.857 C10.948 3.604 10.777 3.38 10.564 3.2 L10.08 3.773 Z M10.385 4.172 L9.705 4.488 C9.73 4.543 9.743 4.603 9.743 4.663 L10.493 4.663 L11.243 4.664 C11.243 4.385 11.182 4.109 11.065 3.857 L10.385 4.172 Z M10.493 4.663 L9.743 4.663 L9.743 9.91 L10.493 9.91 L11.243 9.91 L11.243 4.663 L10.493 4.663 Z M10.493 9.91 L9.743 9.91 C9.743 10.02 9.699 10.126 9.621 10.204 L10.152 10.734 L10.682 11.265 C11.041 10.905 11.243 10.418 11.243 9.91 L10.493 9.91 Z M10.152 10.734 L9.621 10.204 C9.543 10.282 9.438 10.326 9.327 10.326 L9.327 11.076 L9.327 11.826 C9.835 11.826 10.323 11.624 10.682 11.265 L10.152 10.734 Z M9.327 11.076 L9.327 10.326 L1.166 10.326 L1.166 11.076 L1.166 11.826 L9.327 11.826 L9.327 11.076 Z M1.166 11.076 L1.166 10.326 C1.056 10.326 0.95 10.282 0.872 10.204 L0.341 10.734 L-0.189 11.265 C0.17 11.624 0.658 11.826 1.166 11.826 L1.166 11.076 Z M0.341 10.734 L0.872 10.204 C0.794 10.126 0.75 10.02 0.75 9.91 L0 9.91 L-0.75 9.91 C-0.75 10.418 -0.548 10.905 -0.189 11.265 L0.341 10.734 Z M0 9.91 L0.75 9.91 L0.75 4.663 L0 4.663 L-0.75 4.663 L-0.75 9.91 L0 9.91 Z",
        "sourceNodeId": "270:26536",
        "stroke": "#FFFFFF",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 18.253 10.371)"
      },
      {
        "opacity": 1,
        "path": "M3.498 5.247 L4.248 5.247 L4.248 0.583 L3.498 0.583 L2.748 0.583 L2.748 5.247 L3.498 5.247 Z M3.498 0.583 L4.248 0.583 C4.248 0.229 4.107 -0.11 3.857 -0.36 L3.327 0.171 L2.797 0.701 C2.765 0.67 2.748 0.627 2.748 0.583 L3.498 0.583 Z M3.327 0.171 L3.857 -0.36 C3.607 -0.61 3.268 -0.75 2.915 -0.75 L2.915 0 L2.915 0.75 C2.87 0.75 2.828 0.732 2.797 0.701 L3.327 0.171 Z M2.915 0 L2.915 -0.75 L0.583 -0.75 L0.583 0 L0.583 0.75 L2.915 0.75 L2.915 0 Z M0.583 0 L0.583 -0.75 C0.229 -0.75 -0.11 -0.61 -0.36 -0.36 L0.171 0.171 L0.701 0.701 C0.67 0.732 0.627 0.75 0.583 0.75 L0.583 0 Z M0.171 0.171 L-0.36 -0.36 C-0.61 -0.11 -0.75 0.229 -0.75 0.583 L0 0.583 L0.75 0.583 C0.75 0.627 0.732 0.67 0.701 0.701 L0.171 0.171 Z M0 0.583 L-0.75 0.583 L-0.75 5.247 L0 5.247 L0.75 5.247 L0.75 0.583 L0 0.583 Z",
        "sourceNodeId": "270:26535",
        "stroke": "#FFFFFF",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 21.751 16.2)"
      }
    ],
    "sourceNodeIds": [
      "270:26535",
      "270:26536"
    ],
    "viewBox": "0 0 48 48"
  },
  "layout-grid": {
    "layers": [
      {
        "opacity": 1,
        "path": "M0.583 0 L0.583 0.75 L3.498 0.75 L3.498 0 L3.498 -0.75 L0.583 -0.75 L0.583 0 Z M3.498 0 L3.498 0.75 C3.405 0.75 3.331 0.675 3.331 0.583 L4.081 0.583 L4.831 0.583 C4.831 -0.153 4.234 -0.75 3.498 -0.75 L3.498 0 Z M4.081 0.583 L3.331 0.583 L3.331 3.498 L4.081 3.498 L4.831 3.498 L4.831 0.583 L4.081 0.583 Z M4.081 3.498 L3.331 3.498 C3.331 3.405 3.405 3.331 3.498 3.331 L3.498 4.081 L3.498 4.831 C4.234 4.831 4.831 4.234 4.831 3.498 L4.081 3.498 Z M3.498 4.081 L3.498 3.331 L0.583 3.331 L0.583 4.081 L0.583 4.831 L3.498 4.831 L3.498 4.081 Z M0.583 4.081 L0.583 3.331 C0.675 3.331 0.75 3.405 0.75 3.498 L0 3.498 L-0.75 3.498 C-0.75 4.234 -0.153 4.831 0.583 4.831 L0.583 4.081 Z M0 3.498 L0.75 3.498 L0.75 0.583 L0 0.583 L-0.75 0.583 L-0.75 3.498 L0 3.498 Z M0 0.583 L0.75 0.583 C0.75 0.675 0.675 0.75 0.583 0.75 L0.583 0 L0.583 -0.75 C-0.153 -0.75 -0.75 -0.153 -0.75 0.583 L0 0.583 Z",
        "sourceNodeId": "270:26541",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 18.153 12.457)"
      },
      {
        "opacity": 1,
        "path": "M0.583 0 L0.583 0.75 L3.498 0.75 L3.498 0 L3.498 -0.75 L0.583 -0.75 L0.583 0 Z M3.498 0 L3.498 0.75 C3.405 0.75 3.331 0.675 3.331 0.583 L4.081 0.583 L4.831 0.583 C4.831 -0.153 4.234 -0.75 3.498 -0.75 L3.498 0 Z M4.081 0.583 L3.331 0.583 L3.331 3.498 L4.081 3.498 L4.831 3.498 L4.831 0.583 L4.081 0.583 Z M4.081 3.498 L3.331 3.498 C3.331 3.405 3.405 3.331 3.498 3.331 L3.498 4.081 L3.498 4.831 C4.234 4.831 4.831 4.234 4.831 3.498 L4.081 3.498 Z M3.498 4.081 L3.498 3.331 L0.583 3.331 L0.583 4.081 L0.583 4.831 L3.498 4.831 L3.498 4.081 Z M0.583 4.081 L0.583 3.331 C0.675 3.331 0.75 3.405 0.75 3.498 L0 3.498 L-0.75 3.498 C-0.75 4.234 -0.153 4.831 0.583 4.831 L0.583 4.081 Z M0 3.498 L0.75 3.498 L0.75 0.583 L0 0.583 L-0.75 0.583 L-0.75 3.498 L0 3.498 Z M0 0.583 L0.75 0.583 C0.75 0.675 0.675 0.75 0.583 0.75 L0.583 0 L0.583 -0.75 C-0.153 -0.75 -0.75 -0.153 -0.75 0.583 L0 0.583 Z",
        "sourceNodeId": "270:26542",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 24.566 12.457)"
      },
      {
        "opacity": 1,
        "path": "M0.583 0 L0.583 0.75 L3.498 0.75 L3.498 0 L3.498 -0.75 L0.583 -0.75 L0.583 0 Z M3.498 0 L3.498 0.75 C3.405 0.75 3.331 0.675 3.331 0.583 L4.081 0.583 L4.831 0.583 C4.831 -0.153 4.234 -0.75 3.498 -0.75 L3.498 0 Z M4.081 0.583 L3.331 0.583 L3.331 3.498 L4.081 3.498 L4.831 3.498 L4.831 0.583 L4.081 0.583 Z M4.081 3.498 L3.331 3.498 C3.331 3.405 3.405 3.331 3.498 3.331 L3.498 4.081 L3.498 4.831 C4.234 4.831 4.831 4.234 4.831 3.498 L4.081 3.498 Z M3.498 4.081 L3.498 3.331 L0.583 3.331 L0.583 4.081 L0.583 4.831 L3.498 4.831 L3.498 4.081 Z M0.583 4.081 L0.583 3.331 C0.675 3.331 0.75 3.405 0.75 3.498 L0 3.498 L-0.75 3.498 C-0.75 4.234 -0.153 4.831 0.583 4.831 L0.583 4.081 Z M0 3.498 L0.75 3.498 L0.75 0.583 L0 0.583 L-0.75 0.583 L-0.75 3.498 L0 3.498 Z M0 0.583 L0.75 0.583 C0.75 0.675 0.675 0.75 0.583 0.75 L0.583 0 L0.583 -0.75 C-0.153 -0.75 -0.75 -0.153 -0.75 0.583 L0 0.583 Z",
        "sourceNodeId": "270:26543",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 24.566 18.87)"
      },
      {
        "opacity": 1,
        "path": "M0.583 0 L0.583 0.75 L3.498 0.75 L3.498 0 L3.498 -0.75 L0.583 -0.75 L0.583 0 Z M3.498 0 L3.498 0.75 C3.405 0.75 3.331 0.675 3.331 0.583 L4.081 0.583 L4.831 0.583 C4.831 -0.153 4.234 -0.75 3.498 -0.75 L3.498 0 Z M4.081 0.583 L3.331 0.583 L3.331 3.498 L4.081 3.498 L4.831 3.498 L4.831 0.583 L4.081 0.583 Z M4.081 3.498 L3.331 3.498 C3.331 3.405 3.405 3.331 3.498 3.331 L3.498 4.081 L3.498 4.831 C4.234 4.831 4.831 4.234 4.831 3.498 L4.081 3.498 Z M3.498 4.081 L3.498 3.331 L0.583 3.331 L0.583 4.081 L0.583 4.831 L3.498 4.831 L3.498 4.081 Z M0.583 4.081 L0.583 3.331 C0.675 3.331 0.75 3.405 0.75 3.498 L0 3.498 L-0.75 3.498 C-0.75 4.234 -0.153 4.831 0.583 4.831 L0.583 4.081 Z M0 3.498 L0.75 3.498 L0.75 0.583 L0 0.583 L-0.75 0.583 L-0.75 3.498 L0 3.498 Z M0 0.583 L0.75 0.583 C0.75 0.675 0.675 0.75 0.583 0.75 L0.583 0 L0.583 -0.75 C-0.153 -0.75 -0.75 -0.153 -0.75 0.583 L0 0.583 Z",
        "sourceNodeId": "270:26544",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 18.153 18.87)"
      }
    ],
    "sourceNodeIds": [
      "270:26541",
      "270:26542",
      "270:26543",
      "270:26544"
    ],
    "viewBox": "0 0 48 48"
  },
  "compass": {
    "layers": [
      {
        "opacity": 1,
        "path": "M11.659 5.83 L10.909 5.83 C10.909 8.635 8.635 10.909 5.83 10.909 L5.83 11.659 L5.83 12.409 C9.463 12.409 12.409 9.463 12.409 5.83 L11.659 5.83 Z M5.83 11.659 L5.83 10.909 C3.024 10.909 0.75 8.635 0.75 5.83 L0 5.83 L-0.75 5.83 C-0.75 9.463 2.196 12.409 5.83 12.409 L5.83 11.659 Z M0 5.83 L0.75 5.83 C0.75 3.024 3.024 0.75 5.83 0.75 L5.83 0 L5.83 -0.75 C2.196 -0.75 -0.75 2.196 -0.75 5.83 L0 5.83 Z M5.83 0 L5.83 0.75 C8.635 0.75 10.909 3.024 10.909 5.83 L11.659 5.83 L12.409 5.83 C12.409 2.196 9.463 -0.75 5.83 -0.75 L5.83 0 Z",
        "sourceNodeId": "270:26550",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 17.57 11.874)"
      },
      {
        "opacity": 1,
        "path": "M4.943 0 L5.655 0.237 L6.129 -1.186 L4.706 -0.711 L4.943 0 Z M3.892 3.154 L3.18 2.917 L3.18 2.917 L3.892 3.154 Z M3.154 3.892 L2.917 3.18 L2.917 3.18 L3.154 3.892 Z M0 4.943 L-0.711 4.706 L-1.186 6.129 L0.237 5.655 L0 4.943 Z M1.052 1.789 L1.763 2.026 L1.763 2.026 L1.052 1.789 Z M1.789 1.052 L2.026 1.763 L2.026 1.763 L1.789 1.052 Z M4.943 0 L4.232 -0.237 L3.18 2.917 L3.892 3.154 L4.603 3.392 L5.655 0.237 L4.943 0 Z M3.892 3.154 L3.18 2.917 C3.16 2.978 3.125 3.034 3.08 3.08 L3.61 3.61 L4.14 4.14 C4.351 3.93 4.509 3.674 4.603 3.392 L3.892 3.154 Z M3.61 3.61 L3.08 3.08 C3.034 3.125 2.978 3.16 2.917 3.18 L3.154 3.892 L3.392 4.603 C3.674 4.509 3.93 4.351 4.14 4.14 L3.61 3.61 Z M3.154 3.892 L2.917 3.18 L-0.237 4.232 L0 4.943 L0.237 5.655 L3.392 4.603 L3.154 3.892 Z M0 4.943 L0.711 5.181 L1.763 2.026 L1.052 1.789 L0.34 1.552 L-0.711 4.706 L0 4.943 Z M1.052 1.789 L1.763 2.026 C1.784 1.965 1.818 1.909 1.864 1.864 L1.333 1.333 L0.803 0.803 C0.593 1.013 0.434 1.27 0.34 1.552 L1.052 1.789 Z M1.333 1.333 L1.864 1.864 C1.909 1.818 1.965 1.784 2.026 1.763 L1.789 1.052 L1.552 0.34 C1.27 0.434 1.013 0.593 0.803 0.803 L1.333 1.333 Z M1.789 1.052 L2.026 1.763 L5.181 0.711 L4.943 0 L4.706 -0.711 L1.552 0.34 L1.789 1.052 Z",
        "sourceNodeId": "270:26549",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 20.928 15.232)"
      }
    ],
    "sourceNodeIds": [
      "270:26549",
      "270:26550"
    ],
    "viewBox": "0 0 48 48"
  },
  "user": {
    "layers": [
      {
        "opacity": 1,
        "path": "M4.664 2.332 L3.914 2.332 C3.914 3.205 3.205 3.914 2.332 3.914 L2.332 4.664 L2.332 5.414 C4.034 5.414 5.414 4.034 5.414 2.332 L4.664 2.332 Z M2.332 4.664 L2.332 3.914 C1.458 3.914 0.75 3.205 0.75 2.332 L0 2.332 L-0.75 2.332 C-0.75 4.034 0.63 5.414 2.332 5.414 L2.332 4.664 Z M0 2.332 L0.75 2.332 C0.75 1.458 1.458 0.75 2.332 0.75 L2.332 0 L2.332 -0.75 C0.63 -0.75 -0.75 0.63 -0.75 2.332 L0 2.332 Z M2.332 0 L2.332 0.75 C3.205 0.75 3.914 1.458 3.914 2.332 L4.664 2.332 L5.414 2.332 C5.414 0.63 4.034 -0.75 2.332 -0.75 L2.332 0 Z",
        "sourceNodeId": "270:26556",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 21.068 12.457)"
      },
      {
        "opacity": 1,
        "path": "M5.83 0 L5.83 -0.75 L5.83 0 Z M2.332 0 L2.332 -0.75 L2.332 0 Z M0 2.332 L-0.75 2.332 L0 2.332 Z M8.161 3.498 L8.911 3.498 L8.911 2.332 L8.161 2.332 L7.411 2.332 L7.411 3.498 L8.161 3.498 Z M8.161 2.332 L8.911 2.332 C8.911 1.514 8.587 0.731 8.009 0.153 L7.478 0.683 L6.948 1.213 C7.245 1.51 7.411 1.912 7.411 2.332 L8.161 2.332 Z M7.478 0.683 L8.009 0.153 C7.431 -0.425 6.647 -0.75 5.83 -0.75 L5.83 0 L5.83 0.75 C6.249 0.75 6.651 0.917 6.948 1.213 L7.478 0.683 Z M5.83 0 L5.83 -0.75 L2.332 -0.75 L2.332 0 L2.332 0.75 L5.83 0.75 L5.83 0 Z M2.332 0 L2.332 -0.75 C1.514 -0.75 0.731 -0.425 0.153 0.153 L0.683 0.683 L1.213 1.213 C1.51 0.917 1.912 0.75 2.332 0.75 L2.332 0 Z M0.683 0.683 L0.153 0.153 C-0.425 0.731 -0.75 1.514 -0.75 2.332 L0 2.332 L0.75 2.332 C0.75 1.912 0.917 1.51 1.213 1.213 L0.683 0.683 Z M0 2.332 L-0.75 2.332 L-0.75 3.498 L0 3.498 L0.75 3.498 L0.75 2.332 L0 2.332 Z",
        "sourceNodeId": "270:26555",
        "stroke": "#6B7280",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "strokeWidth": 1.5,
        "transform": "matrix(1 0 0 1 19.319 19.453)"
      }
    ],
    "sourceNodeIds": [
      "270:26555",
      "270:26556"
    ],
    "viewBox": "0 0 48 48"
  }
} as const satisfies Readonly<Record<
  'settings' | 'back' | 'share' | 'search' | 'bell' | 'microphone' | 'send' | 'arrow-right' |
  'house' | 'layout-grid' | 'compass' | 'user',
  { sourceNodeIds: readonly FigmaNodeId[]; viewBox: string; layers: readonly FigmaVectorLayer[] }
>>;

export function getFigmaMobileIcon(name: keyof typeof figmaMobileIcons) {
  return figmaMobileIcons[name];
}
