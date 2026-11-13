export type FigmaNodeId = `${number}:${number}`;
export type MobilePrimitiveKey =
  | 'settings' | 'back' | 'share' | 'search' | 'bell'
  | 'microphone' | 'send' | 'arrowRight'
  | 'home' | 'store' | 'community' | 'products'
  | 'brandMark' | 'circleAction' | 'bottomNav' | 'glassCard';

export type FigmaGradientStopEvidence = {
  color?: string;
  opacity: number;
  position: number;
  variableIds: readonly string[];
};

export type FigmaPaintEvidence = {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'IMAGE';
  color?: string;
  end?: { x: number; y: number };
  gradientStops?: readonly FigmaGradientStopEvidence[];
  opacity: number;
  start?: { x: number; y: number };
  styleId?: string;
  transform?: string;
  variableIds: readonly string[];
};

export type FigmaColorEvidence = { r: number; g: number; b: number; a: number };

export type FigmaEffectEvidence = {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'FOREGROUND_BLUR' | 'LAYER_BLUR' | 'BACKGROUND_BLUR' | 'GLASS' | 'NOISE' | string;
  radius: number;
  bevelSize?: number;
  blendMode?: string;
  blurOpType?: string;
  clipToShape?: boolean;
  color?: string;
  chromaticAberration?: number;
  density?: number;
  noiseSize?: { x: number; y: number };
  noiseType?: string;
  offset?: { x: number; y: number };
  opacity?: number;
  rawFields?: Record<string, unknown>;
  rawPayload?: Record<string, unknown>;
  rawType?: string;
  reflectionDistance?: number;
  refractionIntensity?: number;
  refractionRadius?: number;
  secondaryColor?: string;
  secondaryOpacity?: number;
  secondarySourceColor?: FigmaColorEvidence;
  seed?: number;
  showShadowBehindNode?: boolean;
  sourceColor?: FigmaColorEvidence;
  sourceNodeId?: FigmaNodeId;
  spread?: number;
  specularAngle?: number;
  specularIntensity?: number;
  styleId?: string;
  visible?: boolean;
};

export type FigmaVectorLayer = {
  sourceNodeId: FigmaNodeId;
  path: string;
  fill?: string;
  fillRule?: 'nonzero' | 'evenodd';
  paint?: FigmaPaintEvidence;
  stroke?: string;
  strokeWidth?: number;
  strokeLinecap?: 'butt' | 'round' | 'square';
  strokeLinejoin?: 'miter' | 'round' | 'bevel';
  opacity: number;
  sourceEffects?: readonly FigmaEffectEvidence[];
  transform?: string;
};

export type FigmaOverrideEvidence = {
  guidPath: readonly FigmaNodeId[];
  property: string;
  value: string | number | boolean | null;
};

export type FigmaCornerRadiiEvidence = {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
};

export type FigmaBorderWidthsEvidence = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type FigmaPrimitiveEvidence = {
  key: MobilePrimitiveKey;
  sourceKind: 'symbol' | 'node';
  sourceNodeIds: readonly FigmaNodeId[];
  instanceNodeIds: readonly FigmaNodeId[];
  symbolNodeId?: FigmaNodeId;
  noSymbolReason?: 'no-instance-or-symbol-in-audited-subtree';
  size: { width: number; height: number };
  sourceClipsContent?: boolean;
  sourcePadding?: { top: number; right: number; bottom: number; left: number };
  geometry: readonly FigmaVectorLayer[];
  fills: readonly FigmaPaintEvidence[];
  strokes: readonly FigmaPaintEvidence[];
  effects: readonly FigmaEffectEvidence[];
  overrides: readonly FigmaOverrideEvidence[];
  componentValues?: readonly FigmaOverrideEvidence[];
  derivedValues?: readonly FigmaOverrideEvidence[];
  instanceTransform?: string;
  surfaceNodeId?: FigmaNodeId;
  surfaceFills?: readonly FigmaPaintEvidence[];
  surfaceStrokes?: readonly FigmaPaintEvidence[];
  surfaceEffects?: readonly FigmaEffectEvidence[];
  cornerRadii?: FigmaCornerRadiiEvidence;
  borderWidths?: FigmaBorderWidthsEvidence;
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
    "borderWidths": {
      "bottom": 0.550725,
      "left": 0.550725,
      "right": 0.550725,
      "top": 0.550725
    },
    "componentValues": [
      {
        "guidPath": [
          "248:20538"
        ],
        "property": "variantPropSpecs[3042298610:1086140708].value",
        "value": "Default"
      },
      {
        "guidPath": [
          "248:20539"
        ],
        "property": "componentPropDefs[3042298610:1086140708].name",
        "value": "Property 1"
      },
      {
        "guidPath": [
          "248:20539"
        ],
        "property": "componentPropDefs[3042298610:1086140708].type",
        "value": "VARIANT"
      }
    ],
    "derivedValues": [
      {
        "guidPath": [
          "248:20524"
        ],
        "property": "fillGeometry",
        "value": "M33.04348 16.52174 C33.04348 25.646444 25.646444 33.04348 16.52174 33.04348 C7.397035 33.04348 0 25.646444 0 16.52174 C0 7.397035 7.397035 0 16.52174 0 C25.646444 0 33.04348 7.397035 33.04348 16.52174 Z"
      },
      {
        "guidPath": [
          "248:20524"
        ],
        "property": "strokeGeometry",
        "value": "M33.04348 16.52174 L31.391306 16.52174 C31.391306 24.733974 24.733974 31.391306 16.52174 31.391306 L16.52174 33.04348 L16.52174 34.695656 C26.558916 34.695656 34.695656 26.558916 34.695656 16.52174 L33.04348 16.52174 Z M16.52174 33.04348 L16.52174 31.391306 C8.309505 31.391306 1.652174 24.733974 1.652174 16.52174 L0 16.52174 L-1.652174 16.52174 C-1.652174 26.558916 6.484564 34.695656 16.52174 34.695656 L16.52174 33.04348 Z M0 16.52174 L1.652174 16.52174 C1.652174 8.309505 8.309505 1.652174 16.52174 1.652174 L16.52174 0 L16.52174 -1.652174 C6.484564 -1.652174 -1.652174 6.484564 -1.652174 16.52174 L0 16.52174 Z M16.52174 0 L16.52174 1.652174 C24.733974 1.652174 31.391306 8.309505 31.391306 16.52174 L33.04348 16.52174 L34.695656 16.52174 C34.695656 6.484564 26.558916 -1.652174 16.52174 -1.652174 L16.52174 0 Z"
      },
      {
        "guidPath": [
          "248:20526"
        ],
        "property": "strokeGeometry",
        "value": "M0.75 -1.5 C0.335786 -1.5 0 -1.164214 0 -0.75 C0 -0.335786 0.335786 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711104 0 C8.125318 0 8.461104 -0.335786 8.461104 -0.75 C8.461104 -1.164214 8.125318 -1.5 7.711104 -1.5 L7.711104 -0.75 L7.711104 0 Z M0.75 -0.75 L0.75 0 L7.711104 0 L7.711104 -0.75 L7.711104 -1.5 L0.75 -1.5 L0.75 -0.75 Z"
      },
      {
        "guidPath": [
          "248:20527"
        ],
        "property": "strokeGeometry",
        "value": "M0.75 -1.5 C0.335786 -1.5 0 -1.164214 0 -0.75 C0 -0.335786 0.335786 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711104 0 C8.125318 0 8.461104 -0.335786 8.461104 -0.75 C8.461104 -1.164214 8.125318 -1.5 7.711104 -1.5 L7.711104 -0.75 L7.711104 0 Z M0.75 -0.75 L0.75 0 L7.711104 0 L7.711104 -0.75 L7.711104 -1.5 L0.75 -1.5 L0.75 -0.75 Z"
      },
      {
        "guidPath": [
          "248:20528"
        ],
        "property": "strokeGeometry",
        "value": "M0.75 -1.5 C0.335786 -1.5 0 -1.164214 0 -0.75 C0 -0.335786 0.335786 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M12.25 0 C12.664213 0 13 -0.335786 13 -0.75 C13 -1.164214 12.664213 -1.5 12.25 -1.5 L12.25 -0.75 L12.25 0 Z M0.75 -0.75 L0.75 0 L12.25 0 L12.25 -0.75 L12.25 -1.5 L0.75 -1.5 L0.75 -0.75 Z"
      }
    ],
    "effects": [
      {
        "bevelSize": 0.550725,
        "blendMode": "NORMAL",
        "clipToShape": false,
        "color": "#000000",
        "chromaticAberration": 0.31,
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 2.202899
        },
        "opacity": 0.15,
        "radius": 2.202899,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "GLASS",
          "offset": {
            "x": 0,
            "y": 2.2028987407684326
          },
          "radius": 2.2028987407684326,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 3832,
          "clipToShape": false,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448,
          "refractionRadius": 9.913043975830078,
          "specularAngle": -45,
          "specularIntensity": 0.800000011920929,
          "bevelSize": 0.5507246851921082,
          "chromaticAberration": 0.3100000023841858,
          "reflectionDistance": 0,
          "refractionIntensity": 0.7400000095367432
        },
        "rawType": "GLASS",
        "reflectionDistance": 0,
        "refractionIntensity": 0.74,
        "refractionRadius": 9.913044,
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 3832,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "248:20524",
        "spread": 0,
        "specularAngle": -45,
        "specularIntensity": 0.8,
        "type": "GLASS",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.202899
        },
        "opacity": 0.25,
        "radius": 3.304348,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 2.2028987407684326
          },
          "radius": 3.3043482303619385,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.72998046875,
            "g": 0.72998046875,
            "b": 0.72998046875,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.72998,
          "g": 0.72998,
          "r": 0.72998
        },
        "sourceNodeId": "248:20524",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
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
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.75 -1.5 C0.335786 -1.5 0 -1.164214 0 -0.75 C0 -0.335786 0.335786 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M12.25 0 C12.664213 0 13 -0.335786 13 -0.75 C13 -1.164214 12.664213 -1.5 12.25 -1.5 L12.25 -0.75 L12.25 0 Z M0.75 -0.75 L0.75 0 L12.25 0 L12.25 -0.75 L12.25 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "248:20528",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "transform": "matrix(-1 0 0 -1 264.999983 19.999996)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.75 -1.5 C0.335786 -1.5 0 -1.164214 0 -0.75 C0 -0.335786 0.335786 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711104 0 C8.125318 0 8.461104 -0.335786 8.461104 -0.75 C8.461104 -1.164214 8.125318 -1.5 7.711104 -1.5 L7.711104 -0.75 L7.711104 0 Z M0.75 -0.75 L0.75 0 L7.711104 0 L7.711104 -0.75 L7.711104 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "248:20526",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "transform": "matrix(-0.640184 0.768221 -0.768221 -0.640184 257.41667 13.999996)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.75 -1.5 C0.335786 -1.5 0 -1.164214 0 -0.75 C0 -0.335786 0.335786 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711104 0 C8.125318 0 8.461104 -0.335786 8.461104 -0.75 C8.461104 -1.164214 8.125318 -1.5 7.711104 -1.5 L7.711104 -0.75 L7.711104 0 Z M0.75 -0.75 L0.75 0 L7.711104 0 L7.711104 -0.75 L7.711104 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "248:20527",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "transform": "matrix(-0.640184 -0.768221 -0.768221 0.640184 257.41667 27.499996)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 0.2,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 0.2,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M33.04348 16.52174 C33.04348 25.646444 25.646444 33.04348 16.52174 33.04348 C7.397035 33.04348 0 25.646444 0 16.52174 C0 7.397035 7.397035 0 16.52174 0 C25.646444 0 33.04348 7.397035 33.04348 16.52174 Z",
        "sourceNodeId": "248:20524",
        "transform": "matrix(1 0 0 1 240.999995 4.202868)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M33.04348 16.52174 L31.391306 16.52174 C31.391306 24.733974 24.733974 31.391306 16.52174 31.391306 L16.52174 33.04348 L16.52174 34.695656 C26.558916 34.695656 34.695656 26.558916 34.695656 16.52174 L33.04348 16.52174 Z M16.52174 33.04348 L16.52174 31.391306 C8.309505 31.391306 1.652174 24.733974 1.652174 16.52174 L0 16.52174 L-1.652174 16.52174 C-1.652174 26.558916 6.484564 34.695656 16.52174 34.695656 L16.52174 33.04348 Z M0 16.52174 L1.652174 16.52174 C1.652174 8.309505 8.309505 1.652174 16.52174 1.652174 L16.52174 0 L16.52174 -1.652174 C6.484564 -1.652174 -1.652174 6.484564 -1.652174 16.52174 L0 16.52174 Z M16.52174 0 L16.52174 1.652174 C24.733974 1.652174 31.391306 8.309505 31.391306 16.52174 L33.04348 16.52174 L34.695656 16.52174 C34.695656 6.484564 26.558916 -1.652174 16.52174 -1.652174 L16.52174 0 Z",
        "sourceNodeId": "248:20524",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 240.999995 4.202868)"
      }
    ],
    "instanceNodeIds": [
      "266:21480"
    ],
    "instanceTransform": "matrix(-1 0 0 -1 301 60)",
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
    "surfaceEffects": [],
    "surfaceFills": [],
    "surfaceNodeId": "248:20538",
    "surfaceStrokes": [],
    "symbolNodeId": "248:20538"
  },
  "back": {
    "borderWidths": {
      "bottom": 0.550725,
      "left": 0.550725,
      "right": 0.550725,
      "top": 0.550725
    },
    "componentValues": [],
    "derivedValues": [],
    "effects": [
      {
        "bevelSize": 0.550725,
        "blendMode": "NORMAL",
        "clipToShape": false,
        "color": "#000000",
        "chromaticAberration": 0.31,
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 2.202899
        },
        "opacity": 0.15,
        "radius": 2.202899,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "GLASS",
          "offset": {
            "x": 0,
            "y": 2.2028987407684326
          },
          "radius": 2.2028987407684326,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 3832,
          "clipToShape": false,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448,
          "refractionRadius": 9.913043975830078,
          "specularAngle": -45,
          "specularIntensity": 0.800000011920929,
          "bevelSize": 0.5507246851921082,
          "chromaticAberration": 0.3100000023841858,
          "reflectionDistance": 0,
          "refractionIntensity": 0.7400000095367432
        },
        "rawType": "GLASS",
        "reflectionDistance": 0,
        "refractionIntensity": 0.74,
        "refractionRadius": 9.913044,
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 3832,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "845:3504",
        "spread": 0,
        "specularAngle": -45,
        "specularIntensity": 0.8,
        "type": "GLASS",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.202899
        },
        "opacity": 0.25,
        "radius": 3.304348,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 2.2028987407684326
          },
          "radius": 3.3043482303619385,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.72998046875,
            "g": 0.72998046875,
            "b": 0.72998046875,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.72998,
          "g": 0.72998,
          "r": 0.72998
        },
        "sourceNodeId": "845:3504",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
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
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.75 -1.5 C0.335786 -1.5 0 -1.164214 0 -0.75 C0 -0.335786 0.335786 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M12.25 0 C12.664213 0 13 -0.335786 13 -0.75 C13 -1.164214 12.664213 -1.5 12.25 -1.5 L12.25 -0.75 L12.25 0 Z M0.75 -0.75 L0.75 0 L12.25 0 L12.25 -0.75 L12.25 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "845:3508",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "transform": "matrix(-1 0 0 -1 25.999979 18)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.75 -1.5 C0.335786 -1.5 0 -1.164214 0 -0.75 C0 -0.335786 0.335786 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711104 0 C8.125318 0 8.461104 -0.335786 8.461104 -0.75 C8.461104 -1.164214 8.125318 -1.5 7.711104 -1.5 L7.711104 -0.75 L7.711104 0 Z M0.75 -0.75 L0.75 0 L7.711104 0 L7.711104 -0.75 L7.711104 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "845:3506",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "transform": "matrix(-0.640184 0.768221 -0.768221 -0.640184 18.416666 12)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.75 -1.5 C0.335786 -1.5 0 -1.164214 0 -0.75 C0 -0.335786 0.335786 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711104 0 C8.125318 0 8.461104 -0.335786 8.461104 -0.75 C8.461104 -1.164214 8.125318 -1.5 7.711104 -1.5 L7.711104 -0.75 L7.711104 0 Z M0.75 -0.75 L0.75 0 L7.711104 0 L7.711104 -0.75 L7.711104 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "845:3507",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "transform": "matrix(-0.640184 -0.768221 -0.768221 0.640184 18.416666 25.5)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 0.2,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 0.2,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M33.04348 16.52174 C33.04348 25.646444 25.646444 33.04348 16.52174 33.04348 C7.397035 33.04348 0 25.646444 0 16.52174 C0 7.397035 7.397035 0 16.52174 0 C25.646444 0 33.04348 7.397035 33.04348 16.52174 Z",
        "sourceNodeId": "845:3504",
        "transform": "matrix(1 0 0 1 1.999991 2.202872)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M33.04348 16.52174 L31.391306 16.52174 C31.391306 24.733974 24.733974 31.391306 16.52174 31.391306 L16.52174 33.04348 L16.52174 34.695656 C26.558916 34.695656 34.695656 26.558916 34.695656 16.52174 L33.04348 16.52174 Z M16.52174 33.04348 L16.52174 31.391306 C8.309505 31.391306 1.652174 24.733974 1.652174 16.52174 L0 16.52174 L-1.652174 16.52174 C-1.652174 26.558916 6.484564 34.695656 16.52174 34.695656 L16.52174 33.04348 Z M0 16.52174 L1.652174 16.52174 C1.652174 8.309505 8.309505 1.652174 16.52174 1.652174 L16.52174 0 L16.52174 -1.652174 C6.484564 -1.652174 -1.652174 6.484564 -1.652174 16.52174 L0 16.52174 Z M16.52174 0 L16.52174 1.652174 C24.733974 1.652174 31.391306 8.309505 31.391306 16.52174 L33.04348 16.52174 L34.695656 16.52174 C34.695656 6.484564 26.558916 -1.652174 16.52174 -1.652174 L16.52174 0 Z",
        "sourceNodeId": "845:3504",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 1.999991 2.202872)"
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
    "sourceClipsContent": false,
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
    ],
    "surfaceEffects": [],
    "surfaceFills": [],
    "surfaceNodeId": "845:3503",
    "surfaceStrokes": []
  },
  "share": {
    "borderWidths": {
      "bottom": 0.550725,
      "left": 0.550725,
      "right": 0.550725,
      "top": 0.550725
    },
    "componentValues": [],
    "derivedValues": [],
    "effects": [
      {
        "bevelSize": 0.550725,
        "blendMode": "NORMAL",
        "clipToShape": false,
        "color": "#000000",
        "chromaticAberration": 0.31,
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 2.202899
        },
        "opacity": 0.15,
        "radius": 2.202899,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "GLASS",
          "offset": {
            "x": 0,
            "y": 2.2028987407684326
          },
          "radius": 2.2028987407684326,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 3832,
          "clipToShape": false,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448,
          "refractionRadius": 9.913043975830078,
          "specularAngle": -45,
          "specularIntensity": 0.800000011920929,
          "bevelSize": 0.5507246851921082,
          "chromaticAberration": 0.3100000023841858,
          "reflectionDistance": 0,
          "refractionIntensity": 0.7400000095367432
        },
        "rawType": "GLASS",
        "reflectionDistance": 0,
        "refractionIntensity": 0.74,
        "refractionRadius": 9.913044,
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 3832,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "845:3511",
        "spread": 0,
        "specularAngle": -45,
        "specularIntensity": 0.8,
        "type": "GLASS",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.202899
        },
        "opacity": 0.25,
        "radius": 3.304348,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 2.2028987407684326
          },
          "radius": 3.3043482303619385,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.72998046875,
            "g": 0.72998046875,
            "b": 0.72998046875,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.72998,
          "g": 0.72998,
          "r": 0.72998
        },
        "sourceNodeId": "845:3511",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
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
      }
    ],
    "geometry": [
      {
        "fill": "#494A64",
        "fillRule": "evenodd",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M8.534293 2.839482 C8.534293 1.271304 9.805552 0.000045 11.373731 0.000045 C12.68594 -0.007323 13.832272 0.88545 14.146501 2.159501 C14.460729 3.433553 13.860991 4.756971 12.695846 5.360611 C11.530699 5.964251 10.103683 5.690854 9.244152 4.699313 L5.630969 6.502356 C5.71539 6.895394 5.71539 7.30188 5.630969 7.694919 L9.244152 9.497961 C10.1524 8.46817 11.667402 8.235836 12.842504 8.946133 C14.017605 9.65643 14.516076 11.105822 14.026447 12.388649 C13.536818 13.671477 12.199393 14.420144 10.849866 14.166843 C9.50034 13.913542 8.525421 12.730856 8.534293 11.357792 C8.533709 11.157292 8.555133 10.957335 8.598181 10.761511 L4.984997 8.958468 C4.208593 9.854152 2.957484 10.173295 1.84691 9.758955 C0.736336 9.344616 0 8.283986 0 7.098637 C0 5.913289 0.736336 4.852658 1.84691 4.438319 C2.957484 4.02398 4.208593 4.343122 4.984997 5.238806 L8.598181 3.435764 C8.555133 3.239939 8.533709 3.039982 8.534293 2.839482 Z M12.793436 2.839722 C12.793436 2.055633 12.157806 1.420003 11.373718 1.420003 C10.589629 1.420003 9.954 2.055633 9.954 2.839722 C9.954 3.623811 10.589629 4.25944 11.373718 4.25944 C12.157806 4.25944 12.793436 3.623811 12.793436 2.839722 Z M2.855408 5.679159 C3.639497 5.679159 4.275126 6.314788 4.275126 7.098877 C4.275126 7.882966 3.639497 8.518596 2.855408 8.518596 C2.071319 8.518596 1.435689 7.882966 1.435689 7.098877 C1.435689 6.314788 2.071319 5.679159 2.855408 5.679159 Z M12.793436 11.358032 C12.793436 10.573943 12.157806 9.938313 11.373718 9.938313 C10.589629 9.938313 9.954 10.573943 9.954 11.358032 C9.954 12.14212 10.589629 12.77775 11.373718 12.77775 C12.157806 12.77775 12.793436 12.14212 12.793436 11.358032 Z",
        "sourceNodeId": "845:3513",
        "transform": "matrix(1 0 0 1 10.403748 12.419922)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 0.2,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 0.2,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M33.04348 16.52174 C33.04348 25.646444 25.646444 33.04348 16.52174 33.04348 C7.397035 33.04348 0 25.646444 0 16.52174 C0 7.397035 7.397035 0 16.52174 0 C25.646444 0 33.04348 7.397035 33.04348 16.52174 Z",
        "sourceNodeId": "845:3511",
        "transform": "matrix(1 0 0 1 1.999991 2.202872)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M33.04348 16.52174 L31.391306 16.52174 C31.391306 24.733974 24.733974 31.391306 16.52174 31.391306 L16.52174 33.04348 L16.52174 34.695656 C26.558916 34.695656 34.695656 26.558916 34.695656 16.52174 L33.04348 16.52174 Z M16.52174 33.04348 L16.52174 31.391306 C8.309505 31.391306 1.652174 24.733974 1.652174 16.52174 L0 16.52174 L-1.652174 16.52174 C-1.652174 26.558916 6.484564 34.695656 16.52174 34.695656 L16.52174 33.04348 Z M0 16.52174 L1.652174 16.52174 C1.652174 8.309505 8.309505 1.652174 16.52174 1.652174 L16.52174 0 L16.52174 -1.652174 C6.484564 -1.652174 -1.652174 6.484564 -1.652174 16.52174 L0 16.52174 Z M16.52174 0 L16.52174 1.652174 C24.733974 1.652174 31.391306 8.309505 31.391306 16.52174 L33.04348 16.52174 L34.695656 16.52174 C34.695656 6.484564 26.558916 -1.652174 16.52174 -1.652174 L16.52174 0 Z",
        "sourceNodeId": "845:3511",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 1.999991 2.202872)"
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
    "sourceClipsContent": false,
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
    ],
    "surfaceEffects": [],
    "surfaceFills": [],
    "surfaceNodeId": "845:3510",
    "surfaceStrokes": []
  },
  "search": {
    "borderWidths": {
      "bottom": 0,
      "left": 0,
      "right": 0,
      "top": 0
    },
    "componentValues": [],
    "derivedValues": [],
    "effects": [],
    "fills": [],
    "geometry": [
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M2.15 2.15 L2.503553 1.796446 L0.353553 -0.353553 L0 0 L-0.353553 0.353553 L1.796446 2.503553 L2.15 2.15 Z",
        "sourceNodeId": "270:26627",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 8.35 8.35)"
      },
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M8 4 L7.5 4 C7.5 5.932997 5.932997 7.5 4 7.5 L4 8 L4 8.5 C6.485281 8.5 8.5 6.485281 8.5 4 L8 4 Z M4 8 L4 7.5 C2.067003 7.5 0.5 5.932997 0.5 4 L0 4 L-0.5 4 C-0.5 6.485281 1.514719 8.5 4 8.5 L4 8 Z M0 4 L0.5 4 C0.5 2.067003 2.067003 0.5 4 0.5 L4 0 L4 -0.5 C1.514719 -0.5 -0.5 1.514719 -0.5 4 L0 4 Z M4 0 L4 0.5 C5.932997 0.5 7.5 2.067003 7.5 4 L8 4 L8.5 4 C8.5 1.514719 6.485281 -0.5 4 -0.5 L4 0 Z",
        "sourceNodeId": "270:26626",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
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
    "sourceClipsContent": true,
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
    ],
    "surfaceEffects": [],
    "surfaceFills": [],
    "surfaceNodeId": "270:26625",
    "surfaceStrokes": []
  },
  "bell": {
    "borderWidths": {
      "bottom": 0,
      "left": 0,
      "right": 0,
      "top": 0
    },
    "componentValues": [],
    "derivedValues": [],
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
      }
    ],
    "geometry": [
      {
        "fill": "#000000",
        "fillRule": "nonzero",
        "opacity": 0.0001,
        "paint": {
          "color": "#000000",
          "opacity": 0.0001,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 0 L15 0 L15 15 L0 15 L0 0 Z",
        "sourceNodeId": "825:6483"
      },
      {
        "fill": "#7C62FF",
        "fillRule": "evenodd",
        "opacity": 1,
        "paint": {
          "color": "#7C62FF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M5.625548 0.004515 C4.616284 -0.046226 3.63269 0.332541 2.918131 1.047099 C2.203573 1.761657 1.824806 2.745252 1.875548 3.754515 L1.875548 5.629516 C1.875548 5.829515 1.769298 5.967016 1.425548 6.254516 L1.175548 6.492016 C0.424802 6.997462 -0.017777 7.849662 0.000548 8.754516 C0.000548 9.598266 0.663048 9.898266 1.681798 10.004516 L2.500548 10.004516 L8.750547 10.004516 L9.569298 10.004516 C10.588047 9.917016 11.250547 9.617016 11.250547 8.754516 C11.268187 7.843007 10.826745 6.983603 10.075548 6.467015 L9.806797 6.254516 C9.463047 5.973266 9.375547 5.829515 9.375547 5.629516 L9.375547 3.754515 C9.42629 2.745252 9.047523 1.761657 8.332964 1.047099 C7.618406 0.332541 6.634811 -0.046226 5.625548 0.004515 Z M5.625538 1.25438 C6.302957 1.203281 6.968967 1.450215 7.449336 1.930583 C7.929704 2.410951 8.176638 3.076961 8.125539 3.75438 L8.125539 5.62938 C8.136566 6.270617 8.467237 6.863946 9.006788 7.21063 L9.300539 7.44813 C9.708921 7.71062 9.968639 8.151213 10.000539 8.63563 C9.828646 8.692267 9.650009 8.725893 9.469288 8.73563 L8.769288 8.73563 L2.500538 8.73563 L1.800538 8.73563 C1.613499 8.727567 1.428446 8.693921 1.250538 8.63563 C1.278176 8.15467 1.530546 7.714759 1.931788 7.44813 L2.206789 7.21063 C2.760682 6.872777 3.106324 6.277896 3.125538 5.62938 L3.125538 3.75438 C3.074439 3.076961 3.321373 2.410951 3.801742 1.930583 C4.28211 1.450215 4.94812 1.203281 5.625538 1.25438 Z M5.625541 11.254403 C5.265519 11.252372 4.923854 11.095206 4.688041 10.823153 C4.549197 10.630993 4.313585 10.53393 4.079676 10.572533 C3.845768 10.611135 3.653836 10.778755 3.584097 11.005338 C3.514359 11.231921 3.578821 11.478456 3.750541 11.641903 C4.2191 12.190081 4.9044 12.505319 5.625541 12.504403 C6.341644 12.50666 7.024334 12.201725 7.500541 11.666903 C7.710418 11.406331 7.677862 11.026694 7.426686 10.805659 C7.17551 10.584624 6.794815 10.600601 6.563041 10.841904 C6.323805 11.106998 5.982615 11.257122 5.625541 11.254403 Z",
        "sourceNodeId": "825:6484",
        "transform": "matrix(1 0 0 1 1.874444 1.24564)"
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
    "sourceClipsContent": true,
    "sourceKind": "node",
    "sourceNodeIds": [
      "825:6482",
      "825:6483",
      "825:6484"
    ],
    "strokes": [],
    "surfaceEffects": [],
    "surfaceFills": [],
    "surfaceNodeId": "825:6482",
    "surfaceStrokes": []
  },
  "microphone": {
    "borderWidths": {
      "bottom": 0,
      "left": 0,
      "right": 0,
      "top": 0
    },
    "componentValues": [],
    "derivedValues": [],
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
        "fillRule": "evenodd",
        "opacity": 1,
        "paint": {
          "color": "#7F80A1",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": [
            "170:6429"
          ]
        },
        "path": "M8.001953 0 C5.240529 0 3.001953 2.238576 3.001953 5 L3.001953 9 C3.001953 11.761424 5.240529 14 8.001953 14 C10.763377 14 13.001953 11.761424 13.001953 9 L13.001953 5 C13.001953 2.238576 10.763377 0 8.001953 0 Z M8.001953 2 C9.658808 2 11.001953 3.343146 11.001953 5 L11.001953 9 C11.001953 10.656855 9.658808 12 8.001953 12 C6.345099 12 5.001953 10.656855 5.001953 9 L5.001953 5 C5.001953 3.343146 6.345099 2 8.001953 2 Z M8.002259 16 C5.479276 16.026451 3.137286 14.693083 1.872259 12.509999 C1.750428 12.265094 1.533593 12.080784 1.272259 12 C1.011733 11.94 0.73803 11.986817 0.512259 12.13 C0.279117 12.260258 0.107765 12.478359 0.036384 12.735705 C-0.034997 12.993052 -0.000474 13.268258 0.132259 13.5 C1.578557 15.995284 4.133122 17.646269 7.002259 17.939999 L7.002259 19 C7.002259 19.552284 7.449975 20 8.002259 20 C8.554544 20 9.002259 19.552284 9.002259 19 L9.002259 17.939999 C11.862218 17.627605 14.406009 15.981187 15.862259 13.5 C16.123829 13.03175 15.969405 12.440525 15.512259 12.16 C15.283683 12.01751 15.007291 11.973256 14.745652 12.037253 C14.484014 12.101252 14.259256 12.26809 14.122259 12.5 C12.849475 14.67163 10.519388 16.004196 8.002259 16 Z",
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
    "sourceClipsContent": false,
    "sourceKind": "node",
    "sourceNodeIds": [
      "845:3535"
    ],
    "strokes": [],
    "surfaceEffects": [],
    "surfaceFills": [
      {
        "color": "#7F80A1",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": [
          "170:6429"
        ]
      }
    ],
    "surfaceNodeId": "845:3535",
    "surfaceStrokes": []
  },
  "send": {
    "borderWidths": {
      "bottom": 0.5,
      "left": 0.5,
      "right": 0.5,
      "top": 0.5
    },
    "componentValues": [],
    "cornerRadii": {
      "bottomLeft": 43.254723,
      "bottomRight": 43.254723,
      "topLeft": 43.254723,
      "topRight": 43.254723
    },
    "derivedValues": [],
    "effects": [
      {
        "blendMode": "NORMAL",
        "color": "#939393",
        "offset": {
          "x": 0,
          "y": 4
        },
        "opacity": 0.25,
        "radius": 10,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.5753831267356873,
            "c1": 0.5753831267356873,
            "c2": 0.5753831267356873,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 4
          },
          "radius": 10,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.5753831267356873,
            "g": 0.5753831267356873,
            "b": 0.5753831267356873,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.5753831267356873,
            "c1": 0.5753831267356873,
            "c2": 0.5753831267356873,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.575383,
          "g": 0.575383,
          "r": 0.575383
        },
        "sourceNodeId": "845:3539",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
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
        "end": {
          "x": 0.486304,
          "y": -0.091011
        },
        "gradientStops": [
          {
            "color": "#C05CF6",
            "opacity": 1,
            "position": 0,
            "variableIds": [
              "153:2325"
            ]
          },
          {
            "color": "#7C62FF",
            "opacity": 1,
            "position": 1,
            "variableIds": [
              "106:76525"
            ]
          }
        ],
        "opacity": 1,
        "start": {
          "x": -0.230402,
          "y": 0.675698
        },
        "transform": "matrix(0.716706 -0.766709 0.766709 0.716706 -0.230402 0.675698)",
        "type": "GRADIENT_LINEAR",
        "variableIds": [
          "106:76525",
          "153:2325"
        ]
      }
    ],
    "geometry": [
      {
        "fill": "#D9D9D9",
        "fillRule": "nonzero",
        "opacity": 0.1,
        "paint": {
          "color": "#D9D9D9",
          "opacity": 0.1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 20 C0 8.954306 8.954306 0 20 0 L20 0 C31.045694 0 40 8.954306 40 20 L40 20 C40 31.045694 31.045694 40 20 40 L20 40 C8.954306 40 0 31.045694 0 20 L0 20 Z",
        "sourceNodeId": "845:3539"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "evenodd",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M8.482423 0.455559 C9.07339 0.164428 9.72186 0.008795 10.380588 0 C11.956063 0.031636 12.601439 1.436278 11.627048 3.574876 L7.931956 11.110587 C7.299234 12.540537 5.957865 12.37603 5.641504 10.870153 L4.850603 7.276296 L1.250418 6.485394 C-0.293422 6.143724 -0.432621 4.833991 0.972021 4.150652 L8.482423 0.455559 Z M10.481548 3.062507 C11.082634 1.733792 10.962417 1.145362 10.120897 1.265579 L10.120897 1.246597 C9.750363 1.318895 9.392301 1.444644 9.057925 1.619903 L1.560177 5.239069 L5.495704 6.105896 C5.731652 6.160249 5.915893 6.34449 5.970245 6.580438 L6.843401 10.515964 L10.481548 3.062507 Z",
        "sourceNodeId": "845:3540",
        "transform": "matrix(1 0 0 1 13.456245 13.951735)"
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
    "sourceClipsContent": false,
    "sourceKind": "node",
    "sourceNodeIds": [
      "845:3539",
      "845:3540"
    ],
    "strokes": [],
    "surfaceEffects": [
      {
        "blendMode": "NORMAL",
        "color": "#939393",
        "offset": {
          "x": 0,
          "y": 4
        },
        "opacity": 0.25,
        "radius": 10,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.5753831267356873,
            "c1": 0.5753831267356873,
            "c2": 0.5753831267356873,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 4
          },
          "radius": 10,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.5753831267356873,
            "g": 0.5753831267356873,
            "b": 0.5753831267356873,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.5753831267356873,
            "c1": 0.5753831267356873,
            "c2": 0.5753831267356873,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.575383,
          "g": 0.575383,
          "r": 0.575383
        },
        "sourceNodeId": "845:3539",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
      }
    ],
    "surfaceFills": [
      {
        "color": "#D9D9D9",
        "opacity": 0.1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "end": {
          "x": 0.486304,
          "y": -0.091011
        },
        "gradientStops": [
          {
            "color": "#C05CF6",
            "opacity": 1,
            "position": 0,
            "variableIds": [
              "153:2325"
            ]
          },
          {
            "color": "#7C62FF",
            "opacity": 1,
            "position": 1,
            "variableIds": [
              "106:76525"
            ]
          }
        ],
        "opacity": 1,
        "start": {
          "x": -0.230402,
          "y": 0.675698
        },
        "transform": "matrix(0.716706 -0.766709 0.766709 0.716706 -0.230402 0.675698)",
        "type": "GRADIENT_LINEAR",
        "variableIds": [
          "106:76525",
          "153:2325"
        ]
      }
    ],
    "surfaceNodeId": "845:3539",
    "surfaceStrokes": []
  },
  "arrowRight": {
    "borderWidths": {
      "bottom": 0,
      "left": 0,
      "right": 0,
      "top": 0
    },
    "componentValues": [],
    "derivedValues": [],
    "effects": [],
    "fills": [],
    "geometry": [
      {
        "fill": "#8B8FAF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#8B8FAF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M2.576 2.576 L2.879585 2.879585 L3.183169 2.576 L2.879585 2.272415 L2.576 2.576 Z M0 5.152 L0.303584 5.455585 L2.879585 2.879585 L2.576 2.576 L2.272415 2.272415 L-0.303584 4.848415 L0 5.152 Z M2.576 2.576 L2.879585 2.272415 L0.303584 -0.303584 L0 0 L-0.303584 0.303584 L2.272415 2.879585 L2.576 2.576 Z",
        "sourceNodeId": "825:7025",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 3.863973 2.576034)"
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
    "sourceClipsContent": true,
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
    ],
    "surfaceEffects": [],
    "surfaceFills": [],
    "surfaceNodeId": "825:7024",
    "surfaceStrokes": []
  },
  "home": {
    "borderWidths": {
      "bottom": 0.5,
      "left": 0.5,
      "right": 0.5,
      "top": 0.5
    },
    "componentValues": [],
    "cornerRadii": {
      "bottomLeft": 43.254723,
      "bottomRight": 43.254723,
      "topLeft": 43.254723,
      "topRight": 43.254723
    },
    "derivedValues": [],
    "effects": [
      {
        "blendMode": "NORMAL",
        "color": "#939393",
        "offset": {
          "x": 0,
          "y": 4
        },
        "opacity": 0.25,
        "radius": 10,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.5753831267356873,
            "c1": 0.5753831267356873,
            "c2": 0.5753831267356873,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 4
          },
          "radius": 10,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.5753831267356873,
            "g": 0.5753831267356873,
            "b": 0.5753831267356873,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.5753831267356873,
            "c1": 0.5753831267356873,
            "c2": 0.5753831267356873,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.575383,
          "g": 0.575383,
          "r": 0.575383
        },
        "sourceNodeId": "270:26532",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
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
        "end": {
          "x": 0.486304,
          "y": -0.091011
        },
        "gradientStops": [
          {
            "color": "#C05CF6",
            "opacity": 1,
            "position": 0,
            "variableIds": [
              "153:2325"
            ]
          },
          {
            "color": "#7C62FF",
            "opacity": 1,
            "position": 1,
            "variableIds": [
              "106:76525"
            ]
          }
        ],
        "opacity": 1,
        "start": {
          "x": -0.230402,
          "y": 0.675698
        },
        "transform": "matrix(0.716706 -0.766709 0.766709 0.716706 -0.230402 0.675698)",
        "type": "GRADIENT_LINEAR",
        "variableIds": [
          "106:76525",
          "153:2325"
        ]
      }
    ],
    "geometry": [
      {
        "fill": "#D9D9D9",
        "fillRule": "nonzero",
        "opacity": 0.1,
        "paint": {
          "color": "#D9D9D9",
          "opacity": 0.1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 24 C0 10.745167 10.745167 0 24 0 L24 0 C37.254833 0 48 10.745167 48 24 L48 24 C48 37.254833 37.254833 48 24 48 L24 48 C10.745167 48 0 37.254833 0 24 L0 24 Z",
        "sourceNodeId": "270:26532"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 4.663327 L0.75 4.663327 L0.75 4.663147 L0 4.663327 Z M0.413314 3.772573 L0.897451 4.345407 L0.901361 4.342056 L0.413314 3.772573 Z M4.49399 0.275434 L4.009854 -0.2974 L4.005944 -0.294049 L4.49399 0.275434 Z M5.246584 0 L5.246584 -0.75 L5.246584 0 Z M5.999177 0.275434 L6.487236 -0.294062 L6.483302 -0.297386 L5.999177 0.275434 Z M10.079853 3.772573 L9.591795 4.34207 L9.595729 4.345394 L10.079853 3.772573 Z M10.493168 4.663327 L9.743168 4.663147 L9.743168 4.663327 L10.493168 4.663327 Z M0 9.909911 L-0.75 9.909911 L0 9.909911 Z M0 4.663327 L0.75 4.663147 C0.749986 4.602647 0.76317 4.542871 0.788635 4.487991 L0.108306 4.172315 L-0.572024 3.856638 C-0.689329 4.109448 -0.750067 4.384807 -0.75 4.663507 L0 4.663327 Z M0.108306 4.172315 L0.788635 4.487991 C0.8141 4.433111 0.851231 4.384447 0.897439 4.345394 L0.413314 3.772573 L-0.070811 3.199753 C-0.28367 3.379654 -0.454719 3.603828 -0.572024 3.856638 L0.108306 4.172315 Z M0.413314 3.772573 L0.901361 4.342056 L4.982037 0.844916 L4.49399 0.275434 L4.005944 -0.294049 L-0.074732 3.203091 L0.413314 3.772573 Z M4.49399 0.275434 L4.978115 0.848254 C5.053184 0.784809 5.148296 0.75 5.246584 0.75 L5.246584 0 L5.246584 -0.75 C4.793813 -0.75 4.355673 -0.58965 4.009865 -0.297386 L4.49399 0.275434 Z M5.246584 0 L5.246584 0.75 C5.344872 0.75 5.439984 0.784809 5.515052 0.848254 L5.999177 0.275434 L6.483302 -0.297386 C6.137494 -0.58965 5.699354 -0.75 5.246584 -0.75 L5.246584 0 Z M5.999177 0.275434 L5.511131 0.844916 L9.591806 4.342056 L10.079853 3.772573 L10.5679 3.203091 L6.487224 -0.294049 L5.999177 0.275434 Z M10.079853 3.772573 L9.595729 4.345394 C9.641936 4.384447 9.679068 4.433111 9.704533 4.487991 L10.384862 4.172315 L11.065192 3.856638 C10.947886 3.603828 10.776838 3.379654 10.563978 3.199753 L10.079853 3.772573 Z M10.384862 4.172315 L9.704533 4.487991 C9.729997 4.542871 9.743182 4.602646 9.743168 4.663147 L10.493168 4.663327 L11.243168 4.663507 C11.243235 4.384808 11.182497 4.109449 11.065192 3.856638 L10.384862 4.172315 Z M10.493168 4.663327 L9.743168 4.663327 L9.743168 9.909911 L10.493168 9.909911 L11.243168 9.909911 L11.243168 4.663327 L10.493168 4.663327 Z M10.493168 9.909911 L9.743168 9.909911 C9.743168 10.020216 9.699349 10.126004 9.621351 10.204002 L10.151681 10.734332 L10.682011 11.264662 C11.041313 10.90536 11.243168 10.418042 11.243168 9.909911 L10.493168 9.909911 Z M10.151681 10.734332 L9.621351 10.204002 C9.543353 10.282001 9.437565 10.325819 9.32726 10.325819 L9.32726 11.075819 L9.32726 11.825819 C9.835391 11.825819 10.322709 11.623964 10.682011 11.264662 L10.151681 10.734332 Z M9.32726 11.075819 L9.32726 10.325819 L1.165908 10.325819 L1.165908 11.075819 L1.165908 11.825819 L9.32726 11.825819 L9.32726 11.075819 Z M1.165908 11.075819 L1.165908 10.325819 C1.055602 10.325819 0.949815 10.282001 0.871817 10.204002 L0.341486 10.734332 L-0.188844 11.264662 C0.170458 11.623964 0.657777 11.825819 1.165908 11.825819 L1.165908 11.075819 Z M0.341486 10.734332 L0.871817 10.204002 C0.793819 10.126004 0.75 10.020217 0.75 9.909911 L0 9.909911 L-0.75 9.909911 C-0.75 10.418041 -0.548146 10.90536 -0.188844 11.264662 L0.341486 10.734332 Z M0 9.909911 L0.75 9.909911 L0.75 4.663327 L0 4.663327 L-0.75 4.663327 L-0.75 9.909911 L0 9.909911 Z",
        "sourceNodeId": "270:26536",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 18.253465 10.370568)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M3.497723 5.246584 L4.247723 5.246584 L4.247723 0.582954 L3.497723 0.582954 L2.747723 0.582954 L2.747723 5.246584 L3.497723 5.246584 Z M3.497723 0.582954 L4.247723 0.582954 C4.247723 0.229432 4.107287 -0.10961 3.85731 -0.359587 L3.32698 0.170743 L2.79665 0.701073 C2.765323 0.669747 2.747723 0.627258 2.747723 0.582954 L3.497723 0.582954 Z M3.32698 0.170743 L3.85731 -0.359587 C3.607333 -0.609564 3.268291 -0.75 2.914769 -0.75 L2.914769 0 L2.914769 0.75 C2.870466 0.75 2.827977 0.7324 2.79665 0.701073 L3.32698 0.170743 Z M2.914769 0 L2.914769 -0.75 L0.582954 -0.75 L0.582954 0 L0.582954 0.75 L2.914769 0.75 L2.914769 0 Z M0.582954 0 L0.582954 -0.75 C0.229432 -0.75 -0.10961 -0.609564 -0.359587 -0.359587 L0.170743 0.170743 L0.701073 0.701073 C0.669747 0.7324 0.627258 0.75 0.582954 0.75 L0.582954 0 Z M0.170743 0.170743 L-0.359587 -0.359587 C-0.609564 -0.10961 -0.75 0.229432 -0.75 0.582954 L0 0.582954 L0.75 0.582954 C0.75 0.627258 0.7324 0.669747 0.701073 0.701073 L0.170743 0.170743 Z M0 0.582954 L-0.75 0.582954 L-0.75 5.246584 L0 5.246584 L0.75 5.246584 L0.75 0.582954 L0 0.582954 Z",
        "sourceNodeId": "270:26535",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 21.751146 16.20006)"
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
    "sourceClipsContent": false,
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
    ],
    "surfaceEffects": [
      {
        "blendMode": "NORMAL",
        "color": "#939393",
        "offset": {
          "x": 0,
          "y": 4
        },
        "opacity": 0.25,
        "radius": 10,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.5753831267356873,
            "c1": 0.5753831267356873,
            "c2": 0.5753831267356873,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 4
          },
          "radius": 10,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.5753831267356873,
            "g": 0.5753831267356873,
            "b": 0.5753831267356873,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.5753831267356873,
            "c1": 0.5753831267356873,
            "c2": 0.5753831267356873,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.575383,
          "g": 0.575383,
          "r": 0.575383
        },
        "sourceNodeId": "270:26532",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
      }
    ],
    "surfaceFills": [
      {
        "color": "#D9D9D9",
        "opacity": 0.1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "end": {
          "x": 0.486304,
          "y": -0.091011
        },
        "gradientStops": [
          {
            "color": "#C05CF6",
            "opacity": 1,
            "position": 0,
            "variableIds": [
              "153:2325"
            ]
          },
          {
            "color": "#7C62FF",
            "opacity": 1,
            "position": 1,
            "variableIds": [
              "106:76525"
            ]
          }
        ],
        "opacity": 1,
        "start": {
          "x": -0.230402,
          "y": 0.675698
        },
        "transform": "matrix(0.716706 -0.766709 0.766709 0.716706 -0.230402 0.675698)",
        "type": "GRADIENT_LINEAR",
        "variableIds": [
          "106:76525",
          "153:2325"
        ]
      }
    ],
    "surfaceNodeId": "270:26532",
    "surfaceStrokes": []
  },
  "store": {
    "borderWidths": {
      "bottom": 1.982609,
      "left": 1.982609,
      "right": 1.982609,
      "top": 1.982609
    },
    "componentValues": [],
    "cornerRadii": {
      "bottomLeft": 66.08696,
      "bottomRight": 66.08696,
      "topLeft": 66.08696,
      "topRight": 66.08696
    },
    "derivedValues": [],
    "effects": [
      {
        "bevelSize": 0.66087,
        "blendMode": "NORMAL",
        "clipToShape": false,
        "color": "#000000",
        "chromaticAberration": 0.31,
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "opacity": 0.15,
        "radius": 2.643479,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "GLASS",
          "offset": {
            "x": 0,
            "y": 2.6434786319732666
          },
          "radius": 2.6434786319732666,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 3832,
          "clipToShape": false,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448,
          "refractionRadius": 11.895652770996094,
          "specularAngle": -45,
          "specularIntensity": 0.800000011920929,
          "bevelSize": 0.6608696579933167,
          "chromaticAberration": 0.3100000023841858,
          "reflectionDistance": 0,
          "refractionIntensity": 0.7400000095367432
        },
        "rawType": "GLASS",
        "reflectionDistance": 0,
        "refractionIntensity": 0.74,
        "refractionRadius": 11.895653,
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 3832,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "270:26538",
        "spread": 0,
        "specularAngle": -45,
        "specularIntensity": 0.8,
        "type": "GLASS",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "opacity": 0.25,
        "radius": 3.965218,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 2.6434786319732666
          },
          "radius": 3.9652178287506104,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.72998046875,
            "g": 0.72998046875,
            "b": 0.72998046875,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.72998,
          "g": 0.72998,
          "r": 0.72998
        },
        "sourceNodeId": "270:26538",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
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
      }
    ],
    "geometry": [
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.582954 0 L0.582954 0.75 L3.497723 0.75 L3.497723 0 L3.497723 -0.75 L0.582954 -0.75 L0.582954 0 Z M3.497723 0 L3.497723 0.75 C3.405466 0.75 3.330677 0.675211 3.330677 0.582954 L4.080677 0.582954 L4.830677 0.582954 C4.830677 -0.153216 4.233893 -0.75 3.497723 -0.75 L3.497723 0 Z M4.080677 0.582954 L3.330677 0.582954 L3.330677 3.497723 L4.080677 3.497723 L4.830677 3.497723 L4.830677 0.582954 L4.080677 0.582954 Z M4.080677 3.497723 L3.330677 3.497723 C3.330677 3.405466 3.405466 3.330677 3.497723 3.330677 L3.497723 4.080677 L3.497723 4.830677 C4.233893 4.830677 4.830677 4.233893 4.830677 3.497723 L4.080677 3.497723 Z M3.497723 4.080677 L3.497723 3.330677 L0.582954 3.330677 L0.582954 4.080677 L0.582954 4.830677 L3.497723 4.830677 L3.497723 4.080677 Z M0.582954 4.080677 L0.582954 3.330677 C0.675211 3.330677 0.75 3.405466 0.75 3.497723 L0 3.497723 L-0.75 3.497723 C-0.75 4.233893 -0.153216 4.830677 0.582954 4.830677 L0.582954 4.080677 Z M0 3.497723 L0.75 3.497723 L0.75 0.582954 L0 0.582954 L-0.75 0.582954 L-0.75 3.497723 L0 3.497723 Z M0 0.582954 L0.75 0.582954 C0.75 0.675211 0.675211 0.75 0.582954 0.75 L0.582954 0 L0.582954 -0.75 C-0.153216 -0.75 -0.75 -0.153216 -0.75 0.582954 L0 0.582954 Z",
        "sourceNodeId": "270:26541",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 18.153423 12.457418)"
      },
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.582954 0 L0.582954 0.75 L3.497723 0.75 L3.497723 0 L3.497723 -0.75 L0.582954 -0.75 L0.582954 0 Z M3.497723 0 L3.497723 0.75 C3.405466 0.75 3.330677 0.675211 3.330677 0.582954 L4.080677 0.582954 L4.830677 0.582954 C4.830677 -0.153216 4.233893 -0.75 3.497723 -0.75 L3.497723 0 Z M4.080677 0.582954 L3.330677 0.582954 L3.330677 3.497723 L4.080677 3.497723 L4.830677 3.497723 L4.830677 0.582954 L4.080677 0.582954 Z M4.080677 3.497723 L3.330677 3.497723 C3.330677 3.405466 3.405466 3.330677 3.497723 3.330677 L3.497723 4.080677 L3.497723 4.830677 C4.233893 4.830677 4.830677 4.233893 4.830677 3.497723 L4.080677 3.497723 Z M3.497723 4.080677 L3.497723 3.330677 L0.582954 3.330677 L0.582954 4.080677 L0.582954 4.830677 L3.497723 4.830677 L3.497723 4.080677 Z M0.582954 4.080677 L0.582954 3.330677 C0.675211 3.330677 0.75 3.405466 0.75 3.497723 L0 3.497723 L-0.75 3.497723 C-0.75 4.233893 -0.153216 4.830677 0.582954 4.830677 L0.582954 4.080677 Z M0 3.497723 L0.75 3.497723 L0.75 0.582954 L0 0.582954 L-0.75 0.582954 L-0.75 3.497723 L0 3.497723 Z M0 0.582954 L0.75 0.582954 C0.75 0.675211 0.675211 0.75 0.582954 0.75 L0.582954 0 L0.582954 -0.75 C-0.153216 -0.75 -0.75 -0.153216 -0.75 0.582954 L0 0.582954 Z",
        "sourceNodeId": "270:26542",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 24.565931 12.457418)"
      },
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.582954 0 L0.582954 0.75 L3.497723 0.75 L3.497723 0 L3.497723 -0.75 L0.582954 -0.75 L0.582954 0 Z M3.497723 0 L3.497723 0.75 C3.405466 0.75 3.330677 0.675211 3.330677 0.582954 L4.080677 0.582954 L4.830677 0.582954 C4.830677 -0.153216 4.233893 -0.75 3.497723 -0.75 L3.497723 0 Z M4.080677 0.582954 L3.330677 0.582954 L3.330677 3.497723 L4.080677 3.497723 L4.830677 3.497723 L4.830677 0.582954 L4.080677 0.582954 Z M4.080677 3.497723 L3.330677 3.497723 C3.330677 3.405466 3.405466 3.330677 3.497723 3.330677 L3.497723 4.080677 L3.497723 4.830677 C4.233893 4.830677 4.830677 4.233893 4.830677 3.497723 L4.080677 3.497723 Z M3.497723 4.080677 L3.497723 3.330677 L0.582954 3.330677 L0.582954 4.080677 L0.582954 4.830677 L3.497723 4.830677 L3.497723 4.080677 Z M0.582954 4.080677 L0.582954 3.330677 C0.675211 3.330677 0.75 3.405466 0.75 3.497723 L0 3.497723 L-0.75 3.497723 C-0.75 4.233893 -0.153216 4.830677 0.582954 4.830677 L0.582954 4.080677 Z M0 3.497723 L0.75 3.497723 L0.75 0.582954 L0 0.582954 L-0.75 0.582954 L-0.75 3.497723 L0 3.497723 Z M0 0.582954 L0.75 0.582954 C0.75 0.675211 0.675211 0.75 0.582954 0.75 L0.582954 0 L0.582954 -0.75 C-0.153216 -0.75 -0.75 -0.153216 -0.75 0.582954 L0 0.582954 Z",
        "sourceNodeId": "270:26543",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 24.565931 18.870014)"
      },
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.582954 0 L0.582954 0.75 L3.497723 0.75 L3.497723 0 L3.497723 -0.75 L0.582954 -0.75 L0.582954 0 Z M3.497723 0 L3.497723 0.75 C3.405466 0.75 3.330677 0.675211 3.330677 0.582954 L4.080677 0.582954 L4.830677 0.582954 C4.830677 -0.153216 4.233893 -0.75 3.497723 -0.75 L3.497723 0 Z M4.080677 0.582954 L3.330677 0.582954 L3.330677 3.497723 L4.080677 3.497723 L4.830677 3.497723 L4.830677 0.582954 L4.080677 0.582954 Z M4.080677 3.497723 L3.330677 3.497723 C3.330677 3.405466 3.405466 3.330677 3.497723 3.330677 L3.497723 4.080677 L3.497723 4.830677 C4.233893 4.830677 4.830677 4.233893 4.830677 3.497723 L4.080677 3.497723 Z M3.497723 4.080677 L3.497723 3.330677 L0.582954 3.330677 L0.582954 4.080677 L0.582954 4.830677 L3.497723 4.830677 L3.497723 4.080677 Z M0.582954 4.080677 L0.582954 3.330677 C0.675211 3.330677 0.75 3.405466 0.75 3.497723 L0 3.497723 L-0.75 3.497723 C-0.75 4.233893 -0.153216 4.830677 0.582954 4.830677 L0.582954 4.080677 Z M0 3.497723 L0.75 3.497723 L0.75 0.582954 L0 0.582954 L-0.75 0.582954 L-0.75 3.497723 L0 3.497723 Z M0 0.582954 L0.75 0.582954 C0.75 0.675211 0.675211 0.75 0.582954 0.75 L0.582954 0 L0.582954 -0.75 C-0.153216 -0.75 -0.75 -0.153216 -0.75 0.582954 L0 0.582954 Z",
        "sourceNodeId": "270:26544",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 18.153423 18.870014)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 0.2,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 0.2,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 24 C0 10.745167 10.745167 0 24 0 L24 0 C37.254833 0 48 10.745167 48 24 L48 24 C48 37.254833 37.254833 48 24 48 L24 48 C10.745167 48 0 37.254833 0 24 L0 24 Z",
        "sourceNodeId": "270:26538"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 24 M48 24 M48 24 M0 24 M24 0 M48 24 M24 48 M0 24 M24 48 L24 46.017391 C11.840131 46.017391 1.982609 36.15987 1.982609 24 L0 24 L-1.982609 24 C-1.982609 38.3498 9.650202 49.982609 24 49.982609 L24 48 Z M48 24 L46.017391 24 C46.017391 36.15987 36.15987 46.017391 24 46.017391 L24 48 L24 49.982609 C38.3498 49.982609 49.982609 38.3498 49.982609 24 L48 24 Z M24 0 L24 1.982609 C36.15987 1.982609 46.017391 11.840131 46.017391 24 L48 24 L49.982609 24 C49.982609 9.650202 38.3498 -1.982609 24 -1.982609 L24 0 Z M24 0 L24 -1.982609 C9.650202 -1.982609 -1.982609 9.650202 -1.982609 24 L0 24 L1.982609 24 C1.982609 11.840131 11.840131 1.982609 24 1.982609 L24 0 Z",
        "sourceNodeId": "270:26538",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter"
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
    "sourceClipsContent": false,
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
    ],
    "surfaceEffects": [
      {
        "bevelSize": 0.66087,
        "blendMode": "NORMAL",
        "clipToShape": false,
        "color": "#000000",
        "chromaticAberration": 0.31,
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "opacity": 0.15,
        "radius": 2.643479,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "GLASS",
          "offset": {
            "x": 0,
            "y": 2.6434786319732666
          },
          "radius": 2.6434786319732666,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 3832,
          "clipToShape": false,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448,
          "refractionRadius": 11.895652770996094,
          "specularAngle": -45,
          "specularIntensity": 0.800000011920929,
          "bevelSize": 0.6608696579933167,
          "chromaticAberration": 0.3100000023841858,
          "reflectionDistance": 0,
          "refractionIntensity": 0.7400000095367432
        },
        "rawType": "GLASS",
        "reflectionDistance": 0,
        "refractionIntensity": 0.74,
        "refractionRadius": 11.895653,
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 3832,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "270:26538",
        "spread": 0,
        "specularAngle": -45,
        "specularIntensity": 0.8,
        "type": "GLASS",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "opacity": 0.25,
        "radius": 3.965218,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 2.6434786319732666
          },
          "radius": 3.9652178287506104,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.72998046875,
            "g": 0.72998046875,
            "b": 0.72998046875,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.72998,
          "g": 0.72998,
          "r": 0.72998
        },
        "sourceNodeId": "270:26538",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
      }
    ],
    "surfaceFills": [
      {
        "color": "#FFFFFF",
        "opacity": 0.2,
        "type": "SOLID",
        "variableIds": []
      }
    ],
    "surfaceNodeId": "270:26538",
    "surfaceStrokes": [
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ]
  },
  "community": {
    "borderWidths": {
      "bottom": 1.982609,
      "left": 1.982609,
      "right": 1.982609,
      "top": 1.982609
    },
    "componentValues": [],
    "cornerRadii": {
      "bottomLeft": 66.08696,
      "bottomRight": 66.08696,
      "topLeft": 66.08696,
      "topRight": 66.08696
    },
    "derivedValues": [],
    "effects": [
      {
        "bevelSize": 0.66087,
        "blendMode": "NORMAL",
        "clipToShape": false,
        "color": "#000000",
        "chromaticAberration": 0.31,
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "opacity": 0.15,
        "radius": 2.643479,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "GLASS",
          "offset": {
            "x": 0,
            "y": 2.6434786319732666
          },
          "radius": 2.6434786319732666,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 3832,
          "clipToShape": false,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448,
          "refractionRadius": 11.895652770996094,
          "specularAngle": -45,
          "specularIntensity": 0.800000011920929,
          "bevelSize": 0.6608696579933167,
          "chromaticAberration": 0.3100000023841858,
          "reflectionDistance": 0,
          "refractionIntensity": 0.7400000095367432
        },
        "rawType": "GLASS",
        "reflectionDistance": 0,
        "refractionIntensity": 0.74,
        "refractionRadius": 11.895653,
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 3832,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "270:26546",
        "spread": 0,
        "specularAngle": -45,
        "specularIntensity": 0.8,
        "type": "GLASS",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "opacity": 0.25,
        "radius": 3.965218,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 2.6434786319732666
          },
          "radius": 3.9652180671691895,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.72998046875,
            "g": 0.72998046875,
            "b": 0.72998046875,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.72998,
          "g": 0.72998,
          "r": 0.72998
        },
        "sourceNodeId": "270:26546",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
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
      }
    ],
    "geometry": [
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M11.659077 5.829538 L10.909077 5.829538 C10.909077 8.63489 8.63489 10.909077 5.829538 10.909077 L5.829538 11.659077 L5.829538 12.409077 C9.463317 12.409077 12.409077 9.463317 12.409077 5.829538 L11.659077 5.829538 Z M5.829538 11.659077 L5.829538 10.909077 C3.024187 10.909077 0.75 8.63489 0.75 5.829538 L0 5.829538 L-0.75 5.829538 C-0.75 9.463317 2.19576 12.409077 5.829538 12.409077 L5.829538 11.659077 Z M0 5.829538 L0.75 5.829538 C0.75 3.024187 3.024187 0.75 5.829538 0.75 L5.829538 0 L5.829538 -0.75 C2.19576 -0.75 -0.75 2.19576 -0.75 5.829538 L0 5.829538 Z M5.829538 0 L5.829538 0.75 C8.63489 0.75 10.909077 3.024187 10.909077 5.829538 L11.659077 5.829538 L12.409077 5.829538 C12.409077 2.19576 9.463317 -0.75 5.829538 -0.75 L5.829538 0 Z",
        "sourceNodeId": "270:26550",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 17.57045 11.874444)"
      },
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M4.943448 0 L5.654947 0.23721 L6.129434 -1.185986 L4.706238 -0.711499 L4.943448 0 Z M3.891799 3.154363 L3.1803 2.917152 L3.180279 2.917217 L3.891799 3.154363 Z M3.154363 3.891799 L2.917217 3.180279 L2.917152 3.1803 L3.154363 3.891799 Z M0 4.943448 L-0.711499 4.706238 L-1.185986 6.129434 L0.23721 5.654947 L0 4.943448 Z M1.051649 1.789085 L1.763148 2.026296 L1.763169 2.026231 L1.051649 1.789085 Z M1.789085 1.051649 L2.026231 1.763169 L2.026296 1.763148 L1.789085 1.051649 Z M4.943448 0 L4.231949 -0.23721 L3.1803 2.917152 L3.891799 3.154363 L4.603299 3.391573 L5.654947 0.23721 L4.943448 0 Z M3.891799 3.154363 L3.180279 2.917217 C3.159861 2.978477 3.12546 3.034141 3.0798 3.0798 L3.610131 3.610131 L4.14046 4.14046 C4.350795 3.930126 4.509266 3.673705 4.60332 3.391509 L3.891799 3.154363 Z M3.610131 3.610131 L3.0798 3.0798 C3.034141 3.12546 2.978477 3.159861 2.917217 3.180279 L3.154363 3.891799 L3.391509 4.60332 C3.673705 4.509266 3.930126 4.350795 4.14046 4.14046 L3.610131 3.610131 Z M3.154363 3.891799 L2.917152 3.1803 L-0.23721 4.231949 L0 4.943448 L0.23721 5.654947 L3.391573 4.603299 L3.154363 3.891799 Z M0 4.943448 L0.711499 5.180658 L1.763148 2.026296 L1.051649 1.789085 L0.340149 1.551875 L-0.711499 4.706238 L0 4.943448 Z M1.051649 1.789085 L1.763169 2.026231 C1.783587 1.964971 1.817988 1.909307 1.863648 1.863648 L1.333318 1.333318 L0.802987 0.802987 C0.592653 1.013322 0.434182 1.269743 0.340128 1.55194 L1.051649 1.789085 Z M1.333318 1.333318 L1.863648 1.863648 C1.909307 1.817988 1.964971 1.783587 2.026231 1.763169 L1.789085 1.051649 L1.55194 0.340128 C1.269743 0.434182 1.013322 0.592653 0.802987 0.802987 L1.333318 1.333318 Z M1.789085 1.051649 L2.026296 1.763148 L5.180658 0.711499 L4.943448 0 L4.706238 -0.711499 L1.551875 0.340149 L1.789085 1.051649 Z",
        "sourceNodeId": "270:26549",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 20.928277 15.232121)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 0.2,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 0.2,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 24 C0 10.745167 10.745167 0 24 0 L24 0 C37.254833 0 48 10.745167 48 24 L48 24 C48 37.254833 37.254833 48 24 48 L24 48 C10.745167 48 0 37.254833 0 24 L0 24 Z",
        "sourceNodeId": "270:26546"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 24 M48 24 M48 24 M0 24 M24 0 M48 24 M24 48 M0 24 M24 48 L24 46.017391 C11.840131 46.017391 1.982609 36.15987 1.982609 24 L0 24 L-1.982609 24 C-1.982609 38.3498 9.650202 49.982609 24 49.982609 L24 48 Z M48 24 L46.017391 24 C46.017391 36.15987 36.15987 46.017391 24 46.017391 L24 48 L24 49.982609 C38.3498 49.982609 49.982609 38.3498 49.982609 24 L48 24 Z M24 0 L24 1.982609 C36.15987 1.982609 46.017391 11.840131 46.017391 24 L48 24 L49.982609 24 C49.982609 9.650202 38.3498 -1.982609 24 -1.982609 L24 0 Z M24 0 L24 -1.982609 C9.650202 -1.982609 -1.982609 9.650202 -1.982609 24 L0 24 L1.982609 24 C1.982609 11.840131 11.840131 1.982609 24 1.982609 L24 0 Z",
        "sourceNodeId": "270:26546",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter"
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
    "sourceClipsContent": false,
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
    ],
    "surfaceEffects": [
      {
        "bevelSize": 0.66087,
        "blendMode": "NORMAL",
        "clipToShape": false,
        "color": "#000000",
        "chromaticAberration": 0.31,
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "opacity": 0.15,
        "radius": 2.643479,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "GLASS",
          "offset": {
            "x": 0,
            "y": 2.6434786319732666
          },
          "radius": 2.6434786319732666,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 3832,
          "clipToShape": false,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448,
          "refractionRadius": 11.895652770996094,
          "specularAngle": -45,
          "specularIntensity": 0.800000011920929,
          "bevelSize": 0.6608696579933167,
          "chromaticAberration": 0.3100000023841858,
          "reflectionDistance": 0,
          "refractionIntensity": 0.7400000095367432
        },
        "rawType": "GLASS",
        "reflectionDistance": 0,
        "refractionIntensity": 0.74,
        "refractionRadius": 11.895653,
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 3832,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "270:26546",
        "spread": 0,
        "specularAngle": -45,
        "specularIntensity": 0.8,
        "type": "GLASS",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "opacity": 0.25,
        "radius": 3.965218,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 2.6434786319732666
          },
          "radius": 3.9652180671691895,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.72998046875,
            "g": 0.72998046875,
            "b": 0.72998046875,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.72998,
          "g": 0.72998,
          "r": 0.72998
        },
        "sourceNodeId": "270:26546",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
      }
    ],
    "surfaceFills": [
      {
        "color": "#FFFFFF",
        "opacity": 0.2,
        "type": "SOLID",
        "variableIds": []
      }
    ],
    "surfaceNodeId": "270:26546",
    "surfaceStrokes": [
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ]
  },
  "products": {
    "borderWidths": {
      "bottom": 1.982609,
      "left": 1.982609,
      "right": 1.982609,
      "top": 1.982609
    },
    "componentValues": [],
    "cornerRadii": {
      "bottomLeft": 66.08696,
      "bottomRight": 66.08696,
      "topLeft": 66.08696,
      "topRight": 66.08696
    },
    "derivedValues": [],
    "effects": [
      {
        "bevelSize": 0.66087,
        "blendMode": "NORMAL",
        "clipToShape": false,
        "color": "#000000",
        "chromaticAberration": 0.31,
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "opacity": 0.15,
        "radius": 2.643479,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "GLASS",
          "offset": {
            "x": 0,
            "y": 2.6434786319732666
          },
          "radius": 2.6434786319732666,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 3832,
          "clipToShape": false,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448,
          "refractionRadius": 11.895652770996094,
          "specularAngle": -45,
          "specularIntensity": 0.800000011920929,
          "bevelSize": 0.6608696579933167,
          "chromaticAberration": 0.3100000023841858,
          "reflectionDistance": 0,
          "refractionIntensity": 0.7400000095367432
        },
        "rawType": "GLASS",
        "reflectionDistance": 0,
        "refractionIntensity": 0.74,
        "refractionRadius": 11.895653,
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 3832,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "270:26552",
        "spread": 0,
        "specularAngle": -45,
        "specularIntensity": 0.8,
        "type": "GLASS",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "opacity": 0.25,
        "radius": 3.965218,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 2.6434786319732666
          },
          "radius": 3.9652180671691895,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.72998046875,
            "g": 0.72998046875,
            "b": 0.72998046875,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.72998,
          "g": 0.72998,
          "r": 0.72998
        },
        "sourceNodeId": "270:26552",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
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
      }
    ],
    "geometry": [
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M4.66363 2.331815 L3.91363 2.331815 C3.91363 3.205428 3.205428 3.91363 2.331815 3.91363 L2.331815 4.66363 L2.331815 5.41363 C4.033855 5.41363 5.41363 4.033855 5.41363 2.331815 L4.66363 2.331815 Z M2.331815 4.66363 L2.331815 3.91363 C1.458203 3.91363 0.75 3.205428 0.75 2.331815 L0 2.331815 L-0.75 2.331815 C-0.75 4.033855 0.629776 5.41363 2.331815 5.41363 L2.331815 4.66363 Z M0 2.331815 L0.75 2.331815 C0.75 1.458203 1.458203 0.75 2.331815 0.75 L2.331815 0 L2.331815 -0.75 C0.629776 -0.75 -0.75 0.629776 -0.75 2.331815 L0 2.331815 Z M2.331815 0 L2.331815 0.75 C3.205428 0.75 3.91363 1.458203 3.91363 2.331815 L4.66363 2.331815 L5.41363 2.331815 C5.41363 0.629776 4.033855 -0.75 2.331815 -0.75 L2.331815 0 Z",
        "sourceNodeId": "270:26556",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 21.068143 12.457242)"
      },
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M5.829538 0 L5.829538 -0.75 L5.829538 0 Z M2.331815 0 L2.331815 -0.75 L2.331815 0 Z M0 2.331815 L-0.75 2.331815 L0 2.331815 Z M8.161353 3.497723 L8.911353 3.497723 L8.911353 2.331815 L8.161353 2.331815 L7.411353 2.331815 L7.411353 3.497723 L8.161353 3.497723 Z M8.161353 2.331815 L8.911353 2.331815 C8.911353 1.514467 8.586662 0.730595 8.00871 0.152643 L7.47838 0.682973 L6.94805 1.213303 C7.244698 1.509952 7.411353 1.912292 7.411353 2.331815 L8.161353 2.331815 Z M7.47838 0.682973 L8.00871 0.152643 C7.430758 -0.425309 6.646887 -0.75 5.829538 -0.75 L5.829538 0 L5.829538 0.75 C6.249061 0.75 6.651402 0.916655 6.94805 1.213303 L7.47838 0.682973 Z M5.829538 0 L5.829538 -0.75 L2.331815 -0.75 L2.331815 0 L2.331815 0.75 L5.829538 0.75 L5.829538 0 Z M2.331815 0 L2.331815 -0.75 C1.514467 -0.75 0.730595 -0.425309 0.152643 0.152643 L0.682973 0.682973 L1.213303 1.213303 C1.509951 0.916655 1.912292 0.75 2.331815 0.75 L2.331815 0 Z M0.682973 0.682973 L0.152643 0.152643 C-0.42531 0.730596 -0.75 1.514467 -0.75 2.331815 L0 2.331815 L0.75 2.331815 C0.75 1.912292 0.916655 1.509951 1.213303 1.213303 L0.682973 0.682973 Z M0 2.331815 L-0.75 2.331815 L-0.75 3.497723 L0 3.497723 L0.75 3.497723 L0.75 2.331815 L0 2.331815 Z",
        "sourceNodeId": "270:26555",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 19.319276 19.452707)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 0.2,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 0.2,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 24 C0 10.745167 10.745167 0 24 0 L24 0 C37.254833 0 48 10.745167 48 24 L48 24 C48 37.254833 37.254833 48 24 48 L24 48 C10.745167 48 0 37.254833 0 24 L0 24 Z",
        "sourceNodeId": "270:26552"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 24 M48 24 M48 24 M0 24 M24 0 M48 24 M24 48 M0 24 M24 48 L24 46.017391 C11.840131 46.017391 1.982609 36.15987 1.982609 24 L0 24 L-1.982609 24 C-1.982609 38.3498 9.650202 49.982609 24 49.982609 L24 48 Z M48 24 L46.017391 24 C46.017391 36.15987 36.15987 46.017391 24 46.017391 L24 48 L24 49.982609 C38.3498 49.982609 49.982609 38.3498 49.982609 24 L48 24 Z M24 0 L24 1.982609 C36.15987 1.982609 46.017391 11.840131 46.017391 24 L48 24 L49.982609 24 C49.982609 9.650202 38.3498 -1.982609 24 -1.982609 L24 0 Z M24 0 L24 -1.982609 C9.650202 -1.982609 -1.982609 9.650202 -1.982609 24 L0 24 L1.982609 24 C1.982609 11.840131 11.840131 1.982609 24 1.982609 L24 0 Z",
        "sourceNodeId": "270:26552",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter"
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
    "sourceClipsContent": false,
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
    ],
    "surfaceEffects": [
      {
        "bevelSize": 0.66087,
        "blendMode": "NORMAL",
        "clipToShape": false,
        "color": "#000000",
        "chromaticAberration": 0.31,
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "opacity": 0.15,
        "radius": 2.643479,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "GLASS",
          "offset": {
            "x": 0,
            "y": 2.6434786319732666
          },
          "radius": 2.6434786319732666,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 3832,
          "clipToShape": false,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448,
          "refractionRadius": 11.895652770996094,
          "specularAngle": -45,
          "specularIntensity": 0.800000011920929,
          "bevelSize": 0.6608696579933167,
          "chromaticAberration": 0.3100000023841858,
          "reflectionDistance": 0,
          "refractionIntensity": 0.7400000095367432
        },
        "rawType": "GLASS",
        "reflectionDistance": 0,
        "refractionIntensity": 0.74,
        "refractionRadius": 11.895653,
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 3832,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "270:26552",
        "spread": 0,
        "specularAngle": -45,
        "specularIntensity": 0.8,
        "type": "GLASS",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "opacity": 0.25,
        "radius": 3.965218,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 2.6434786319732666
          },
          "radius": 3.9652180671691895,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.72998046875,
            "g": 0.72998046875,
            "b": 0.72998046875,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.72998,
          "g": 0.72998,
          "r": 0.72998
        },
        "sourceNodeId": "270:26552",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
      }
    ],
    "surfaceFills": [
      {
        "color": "#FFFFFF",
        "opacity": 0.2,
        "type": "SOLID",
        "variableIds": []
      }
    ],
    "surfaceNodeId": "270:26552",
    "surfaceStrokes": [
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ]
  },
  "brandMark": {
    "borderWidths": {
      "bottom": 0.521739,
      "left": 0.521739,
      "right": 0.521739,
      "top": 0.521739
    },
    "componentValues": [],
    "derivedValues": [],
    "effects": [
      {
        "blendMode": "NORMAL",
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.086957
        },
        "opacity": 0.25,
        "radius": 3.130435,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 2.08695650100708
          },
          "radius": 3.1304352283477783,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.72998046875,
            "g": 0.72998046875,
            "b": 0.72998046875,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.72998,
          "g": 0.72998,
          "r": 0.72998
        },
        "sourceNodeId": "270:26269",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
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
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 0.170463 L2.506987 0.170463 L2.506987 9.677019 L0 9.677019 L0 0.170463 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826057 10.434731)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M1.073462 0.322826 C1.457564 0.322826 1.756759 0.360326 1.971047 0.435326 C2.189378 0.510326 2.343019 0.624457 2.431968 0.777717 C2.520918 0.927717 2.565393 1.128261 2.565393 1.379348 C2.565393 1.640217 2.516875 1.848913 2.419839 2.005435 C2.326846 2.161957 2.171184 2.276087 1.952852 2.347826 C1.738564 2.419565 1.445434 2.455435 1.073462 2.455435 L0.400274 2.455435 L0.400274 3.717391 L0 3.717391 L0 0.322826 L1.073462 0.322826 Z M1.024944 2.17663 C1.320096 2.17663 1.546514 2.153804 1.704197 2.108152 C1.865924 2.059239 1.981155 1.979348 2.049889 1.868478 C2.118623 1.754348 2.15299 1.591304 2.15299 1.379348 C2.15299 1.186957 2.118623 1.035326 2.049889 0.924456 C1.981155 0.813587 1.863903 0.733696 1.698133 0.684783 C1.536406 0.632609 1.31201 0.606522 1.024944 0.606522 L0.400274 0.606522 L0.400274 2.17663 L1.024944 2.17663 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.782583 25.565201)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M104.30909 0 C105.619186 0 106.735207 0.236025 107.592438 0.708075 C109.048103 1.507936 109.905327 3.002761 109.905327 4.851622 C109.905327 6.490683 109.242188 8.116632 107.883568 8.982056 C106.977814 9.559006 105.764755 9.913043 104.30909 9.913043 C100.815483 9.913043 98.696671 8.182194 98.696671 5.061421 C98.696671 2.150449 100.491997 0 104.30909 0 Z M101.316872 4.904071 C101.316872 6.53002 101.818283 8.41822 104.260567 8.41822 C105.376587 8.41822 105.958847 8.116632 106.395554 7.657695 C106.977821 7.028295 107.285126 6.110421 107.285126 4.799171 C107.285126 3.21256 106.589638 1.455486 104.341438 1.455486 C102.012367 1.455486 101.316872 3.133885 101.316872 4.904071 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826057 10.434731)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M109.632393 0.236025 L112.559898 0.236025 L114.969849 4.550034 L117.428307 0.236025 L119.999992 0.236025 L116.053513 6.228433 L116.053513 9.677019 L113.578873 9.677019 L113.578873 6.202208 L109.632393 0.236025 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826057 10.434731)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M14.346992 2.396739 L12.072708 2.519022 C12.076751 2.753804 12.11314 2.941304 12.181874 3.081522 C12.254651 3.221739 12.371902 3.324456 12.533629 3.389674 C12.695356 3.454891 12.91571 3.4875 13.194689 3.4875 C13.372588 3.4875 13.554531 3.472826 13.740517 3.443478 C13.930546 3.410869 14.090252 3.370109 14.219633 3.321196 L14.219633 3.614674 C14.114511 3.653804 13.958848 3.688043 13.752646 3.717391 C13.550488 3.75 13.34833 3.766304 13.146171 3.766304 C12.802501 3.766304 12.523521 3.723913 12.309234 3.63913 C12.094945 3.554348 11.93524 3.4125 11.830117 3.213587 C11.724995 3.011413 11.672434 2.73913 11.672434 2.396739 C11.672434 2.054348 11.724995 1.783696 11.830117 1.584783 C11.93524 1.382609 12.090902 1.23913 12.297104 1.154348 C12.507349 1.069565 12.780264 1.027174 13.115847 1.027174 C13.609114 1.027174 13.940654 1.129891 14.110467 1.335326 C14.28028 1.5375 14.365187 1.79837 14.365187 2.117935 C14.365187 2.189674 14.359122 2.282609 14.346992 2.396739 Z M13.989172 2.157065 C13.989172 1.964674 13.968956 1.808152 13.928524 1.6875 C13.888092 1.566848 13.803185 1.470652 13.673804 1.398913 C13.548466 1.327174 13.360458 1.291304 13.109781 1.291304 C12.846975 1.291304 12.640774 1.327174 12.491177 1.398913 C12.341579 1.467391 12.236456 1.571739 12.175809 1.711956 C12.115161 1.852174 12.080794 2.039674 12.072708 2.274457 L13.989172 2.157065 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.782583 25.565201)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M16.346209 0.196687 L25.824236 0.196687 L25.824236 1.770186 L22.346802 1.770186 L22.346802 9.677019 L19.823643 9.677019 L19.823643 1.770186 L16.346209 1.770186 L16.346209 0.196687 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826057 10.434731)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M16.769579 1.027174 L16.75745 1.31087 L16.684673 1.31087 C16.442083 1.31087 16.231836 1.354891 16.053938 1.442935 C15.876038 1.530978 15.744636 1.68587 15.659729 1.907609 L15.659729 3.717391 L15.271584 3.717391 L15.271584 1.076087 L15.659729 1.076087 L15.659729 1.550543 C15.809326 1.20163 16.15906 1.027174 16.708931 1.027174 L16.769579 1.027174 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.782583 25.565201)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M19.75292 2.396739 L17.478636 2.519022 C17.482677 2.753804 17.519068 2.941304 17.587801 3.081522 C17.660578 3.221739 17.77783 3.324456 17.939556 3.389674 C18.101284 3.454891 18.321636 3.4875 18.600616 3.4875 C18.778515 3.4875 18.960459 3.472826 19.146444 3.443478 C19.336473 3.410869 19.496178 3.370109 19.625561 3.321196 L19.625561 3.614674 C19.520437 3.653804 19.364775 3.688043 19.158573 3.717391 C18.956415 3.75 18.754255 3.766304 18.552097 3.766304 C18.208427 3.766304 17.929449 3.723913 17.71516 3.63913 C17.500872 3.554348 17.341167 3.4125 17.236044 3.213587 C17.130922 3.011413 17.078362 2.73913 17.078362 2.396739 C17.078362 2.054348 17.130922 1.783696 17.236044 1.584783 C17.341167 1.382609 17.49683 1.23913 17.703032 1.154348 C17.913277 1.069565 18.18619 1.027174 18.521774 1.027174 C19.015041 1.027174 19.346581 1.129891 19.516394 1.335326 C19.686207 1.5375 19.771114 1.79837 19.771114 2.117935 C19.771114 2.189674 19.765049 2.282609 19.75292 2.396739 Z M19.395098 2.157065 C19.395098 1.964674 19.374884 1.808152 19.334452 1.6875 C19.29402 1.566848 19.209112 1.470652 19.079731 1.398913 C18.954393 1.327174 18.766386 1.291304 18.515709 1.291304 C18.252903 1.291304 18.046701 1.327174 17.897104 1.398913 C17.747505 1.467391 17.642384 1.571739 17.581736 1.711956 C17.521088 1.852174 17.486721 2.039674 17.478636 2.274457 L19.395098 2.157065 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.782583 25.565201)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M23.315681 0 L23.315681 3.717391 L22.994249 3.717391 L22.939665 3.194021 C22.870932 3.373369 22.743572 3.513587 22.557587 3.614674 C22.371601 3.715761 22.120924 3.766304 21.805555 3.766304 C21.316332 3.766304 20.974684 3.653804 20.780611 3.428804 C20.590582 3.200543 20.495567 2.856522 20.495567 2.396739 C20.495567 1.966304 20.592606 1.630435 20.786676 1.38913 C20.984793 1.147826 21.324419 1.027174 21.805555 1.027174 C22.124966 1.027174 22.373623 1.077717 22.551523 1.178804 C22.729422 1.27663 22.856781 1.413587 22.933601 1.589674 L22.933601 0 L23.315681 0 Z M22.945732 2.396739 C22.945732 2.047826 22.862846 1.777174 22.697077 1.584783 C22.535349 1.392391 22.256371 1.296196 21.86014 1.296196 C21.601377 1.296196 21.401239 1.343478 21.259727 1.438043 C21.118217 1.529348 21.023203 1.653261 20.974684 1.809783 C20.926167 1.966304 20.901907 2.161957 20.901907 2.396739 C20.901907 2.638043 20.926167 2.838587 20.974684 2.998369 C21.027245 3.154891 21.122259 3.277174 21.259727 3.365217 C21.401239 3.453261 21.601377 3.497283 21.86014 3.497283 C22.256371 3.497283 22.535349 3.402717 22.697077 3.213587 C22.862846 3.024457 22.945732 2.752174 22.945732 2.396739 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.782583 25.565201)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M27.20434 0.196687 L35.032608 0.196687 L35.032608 1.743961 L29.711329 1.743961 L29.711329 3.99931 L34.692951 3.99931 L34.692951 5.546584 L29.711329 5.546584 L29.711329 8.103519 L35.210526 8.103519 L35.210526 9.677019 L27.20434 9.677019 L27.20434 0.196687 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826057 10.434731)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M28.684414 2.396739 C28.684414 2.827174 28.587378 3.163043 28.393305 3.404348 C28.199232 3.645652 27.861628 3.766304 27.380491 3.766304 C27.061081 3.766304 26.812426 3.717391 26.634527 3.619565 C26.456627 3.521739 26.329266 3.386413 26.252445 3.213587 L26.197863 3.717391 L25.864302 3.717391 L25.864302 0 L26.252445 0 L26.252445 1.609239 C26.32118 1.423369 26.444496 1.279891 26.622396 1.178804 C26.804338 1.077717 27.057037 1.027174 27.380491 1.027174 C27.869715 1.027174 28.209341 1.141304 28.39937 1.369565 C28.589399 1.594565 28.684414 1.936956 28.684414 2.396739 Z M28.28414 2.396739 C28.28414 2.155435 28.257858 1.956522 28.205297 1.8 C28.152737 1.640217 28.0557 1.516304 27.91419 1.428261 C27.776722 1.340217 27.580627 1.296196 27.325907 1.296196 C26.925632 1.296196 26.642612 1.390761 26.476843 1.579891 C26.315115 1.769022 26.234251 2.041304 26.234251 2.396739 C26.234251 2.745652 26.317137 3.016304 26.482906 3.208695 C26.648676 3.401087 26.929676 3.497283 27.325907 3.497283 C27.701921 3.497283 27.95462 3.404348 28.084002 3.218478 C28.217426 3.029348 28.28414 2.755435 28.28414 2.396739 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.782583 25.565201)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M29.317425 4.42663 C29.50341 4.42663 29.655029 4.403804 29.772282 4.358152 C29.893578 4.3125 29.994658 4.2375 30.07552 4.133152 C30.160427 4.032065 30.241291 3.890217 30.318111 3.707608 L29.008123 1.076087 L29.420527 1.076087 L30.506119 3.355434 L30.542505 3.355434 L31.549257 1.076087 L31.943466 1.076087 L30.742641 3.688043 C30.629433 3.926087 30.520267 4.113587 30.415146 4.250543 C30.310022 4.39076 30.170534 4.5 29.996677 4.578261 C29.822821 4.656521 29.596405 4.695652 29.317425 4.695652 L29.317425 4.42663 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.782583 25.565201)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M3.258245 2.396739 C3.258245 2.054348 3.308784 1.783696 3.409863 1.584783 C3.514986 1.382609 3.672669 1.23913 3.882914 1.154348 C4.093159 1.069565 4.368095 1.027174 4.707722 1.027174 C5.047348 1.027174 5.322284 1.069565 5.532529 1.154348 C5.742774 1.23913 5.900458 1.382609 6.00558 1.584783 C6.110703 1.783696 6.163264 2.054348 6.163264 2.396739 C6.163264 2.73913 6.110703 3.011413 6.00558 3.213587 C5.900458 3.4125 5.742774 3.554348 5.532529 3.63913 C5.322284 3.723913 5.047348 3.766304 4.707722 3.766304 C4.368095 3.766304 4.093159 3.723913 3.882914 3.63913 C3.672669 3.554348 3.514986 3.4125 3.409863 3.213587 C3.308784 3.011413 3.258245 2.73913 3.258245 2.396739 Z M5.756925 2.396739 C5.756925 2.116304 5.724579 1.897826 5.659889 1.741304 C5.595198 1.581522 5.486032 1.467391 5.332392 1.398913 C5.182795 1.330435 4.974571 1.296196 4.707722 1.296196 C4.436829 1.296196 4.226584 1.330435 4.076987 1.398913 C3.927389 1.467391 3.820245 1.581522 3.755555 1.741304 C3.694907 1.897826 3.664583 2.116304 3.664583 2.396739 C3.664583 2.677174 3.696929 2.897282 3.761619 3.057065 C3.82631 3.213587 3.933454 3.326087 4.083052 3.394565 C4.232649 3.463043 4.440872 3.497283 4.707722 3.497283 C4.982657 3.497283 5.194924 3.463043 5.344522 3.394565 C5.494119 3.326087 5.599241 3.213587 5.659889 3.057065 C5.724579 2.900543 5.756925 2.680435 5.756925 2.396739 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.782583 25.565201)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M33.727642 3.629348 L33.727642 3.316304 C33.865108 3.358695 34.049072 3.396195 34.279533 3.428804 C34.509995 3.461413 34.742477 3.477717 34.976982 3.477717 C35.328735 3.477717 35.593567 3.427174 35.771465 3.326087 C35.949364 3.221739 36.038315 3.053804 36.038315 2.822282 C36.038315 2.669022 36.00597 2.548369 35.941277 2.460326 C35.88063 2.369022 35.777531 2.295652 35.631973 2.240217 C35.490463 2.181522 35.28022 2.124456 35.00124 2.069022 C34.693958 2.010326 34.457436 1.948369 34.291664 1.883152 C34.129936 1.814674 34.010662 1.725 33.933842 1.61413 C33.861065 1.503261 33.824677 1.35163 33.824677 1.159239 C33.824677 0.565761 34.27549 0.269022 35.17712 0.269022 C35.359062 0.269022 35.551113 0.282065 35.753269 0.308152 C35.955429 0.330978 36.111092 0.358696 36.220257 0.391304 L36.220257 0.694565 C36.08279 0.655435 35.921062 0.622826 35.735077 0.596739 C35.549091 0.570652 35.361084 0.557609 35.171055 0.557609 C34.843559 0.557609 34.602985 0.603261 34.449345 0.694565 C34.295708 0.782609 34.218887 0.9375 34.218887 1.159239 C34.218887 1.286413 34.241123 1.3875 34.285599 1.4625 C34.334118 1.534239 34.423065 1.596196 34.552448 1.64837 C34.685871 1.697283 34.883987 1.746196 35.146793 1.795109 C35.474289 1.857065 35.72699 1.925543 35.904888 2.000543 C36.08683 2.075543 36.220257 2.17663 36.305164 2.303804 C36.390072 2.430978 36.432522 2.602174 36.432522 2.817391 C36.432522 3.140217 36.309208 3.379891 36.062572 3.536413 C35.819984 3.689674 35.458118 3.766304 34.976982 3.766304 C34.730347 3.766304 34.487759 3.75163 34.24921 3.722282 C34.010666 3.692935 33.836807 3.661956 33.727642 3.629348 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.782583 25.565201)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M37.011158 0.209799 L39.566666 0.209799 L39.566666 8.064182 L44.580639 8.064182 L44.580639 9.677019 L37.011158 9.677019 L37.011158 0.209799 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826057 10.434731)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M39.748619 2.396739 L37.474335 2.519022 C37.478374 2.753804 37.514767 2.941304 37.5835 3.081522 C37.656277 3.221739 37.773529 3.324456 37.935257 3.389674 C38.096981 3.454891 38.317333 3.4875 38.596313 3.4875 C38.774212 3.4875 38.956158 3.472826 39.142143 3.443478 C39.332172 3.410869 39.491875 3.370109 39.621258 3.321196 L39.621258 3.614674 C39.516136 3.653804 39.360474 3.688043 39.15427 3.717391 C38.952114 3.75 38.749954 3.766304 38.547798 3.766304 C38.204128 3.766304 37.925148 3.723913 37.710861 3.63913 C37.496571 3.554348 37.336868 3.4125 37.231743 3.213587 C37.126621 3.011413 37.074059 2.73913 37.074059 2.396739 C37.074059 2.054348 37.126621 1.783696 37.231743 1.584783 C37.336868 1.382609 37.492527 1.23913 37.69873 1.154348 C37.908974 1.069565 38.181889 1.027174 38.517471 1.027174 C39.010738 1.027174 39.342281 1.129891 39.512093 1.335326 C39.681908 1.5375 39.766811 1.79837 39.766811 2.117935 C39.766811 2.189674 39.760746 2.282609 39.748619 2.396739 Z M39.390797 2.157065 C39.390797 1.964674 39.370583 1.808152 39.330151 1.6875 C39.289719 1.566848 39.204815 1.470652 39.075432 1.398913 C38.950092 1.327174 38.762085 1.291304 38.511406 1.291304 C38.2486 1.291304 38.0424 1.327174 37.892803 1.398913 C37.743206 1.467391 37.638081 1.571739 37.577435 1.711956 C37.516785 1.852174 37.482418 2.039674 37.474335 2.274457 L39.390797 2.157065 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.782583 25.565201)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M4.695672 0.196687 L8.318671 0.196687 L12.701856 7.657695 L12.701856 0.196687 L15.030926 0.196687 L15.030926 9.677019 L11.585842 9.677019 L7.057091 1.809524 L7.057091 9.677019 L4.695672 9.677019 L4.695672 0.196687 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826057 10.434731)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M43.184021 1.848913 L43.184021 3.717391 L42.856525 3.717391 L42.795879 3.277174 C42.702885 3.430434 42.543179 3.551087 42.316761 3.63913 C42.094387 3.723913 41.843712 3.766304 41.564732 3.766304 C40.820789 3.766304 40.448814 3.507065 40.448814 2.988587 C40.448814 2.682065 40.562027 2.466848 40.788445 2.342935 C41.014862 2.219022 41.332249 2.157065 41.740608 2.157065 L42.795879 2.157065 L42.795879 1.902717 C42.795879 1.697283 42.735229 1.545652 42.613934 1.447826 C42.492641 1.346739 42.264198 1.296196 41.928616 1.296196 C41.67794 1.296196 41.435349 1.317391 41.200848 1.359783 L41.200848 1.076087 C41.471737 1.043478 41.722412 1.027174 41.952873 1.027174 C42.417839 1.027174 42.739273 1.098913 42.917175 1.242391 C43.095074 1.382609 43.184021 1.584782 43.184021 1.848913 Z M42.795879 2.929891 L42.795879 2.416304 L41.776997 2.416304 C41.558666 2.416304 41.38279 2.432609 41.249363 2.465217 C41.11594 2.494565 41.014858 2.55163 40.946125 2.636413 C40.877392 2.717935 40.843025 2.835326 40.843025 2.988587 C40.843025 3.158152 40.903671 3.285326 41.024967 3.370108 C41.146263 3.45163 41.332249 3.492391 41.582924 3.492391 C41.886162 3.492391 42.142906 3.443478 42.353149 3.345652 C42.567436 3.247826 42.715015 3.109239 42.795879 2.929891 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.782583 25.565201)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M44.279518 3.233152 L44.279518 0 L44.66766 0 L44.66766 3.15 C44.66766 3.280435 44.689899 3.368478 44.734371 3.41413 C44.78289 3.459782 44.863754 3.482609 44.976963 3.482609 C45.086128 3.482609 45.177101 3.474456 45.249878 3.458152 L45.249878 3.717391 C45.160927 3.736956 45.049744 3.746739 44.916317 3.746739 C44.710117 3.746739 44.552429 3.707608 44.443264 3.629348 C44.334099 3.551087 44.279518 3.419022 44.279518 3.233152 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.782583 25.565201)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M45.654224 2.396739 C45.654224 2.054348 45.704762 1.783696 45.805843 1.584783 C45.910965 1.382609 46.068649 1.23913 46.278896 1.154348 C46.48914 1.069565 46.764076 1.027174 47.103703 1.027174 C47.443329 1.027174 47.718266 1.069565 47.928509 1.154348 C48.138752 1.23913 48.296436 1.382609 48.401558 1.584783 C48.50668 1.783696 48.559242 2.054348 48.559242 2.396739 C48.559242 2.73913 48.50668 3.011413 48.401558 3.213587 C48.296436 3.4125 48.138752 3.554348 47.928509 3.63913 C47.718266 3.723913 47.443329 3.766304 47.103703 3.766304 C46.764076 3.766304 46.48914 3.723913 46.278896 3.63913 C46.068649 3.554348 45.910965 3.4125 45.805843 3.213587 C45.704762 3.011413 45.654224 2.73913 45.654224 2.396739 Z M48.152905 2.396739 C48.152905 2.116304 48.12056 1.897826 48.05587 1.741304 C47.99118 1.581522 47.882015 1.467391 47.728374 1.398913 C47.578777 1.330435 47.370552 1.296196 47.103703 1.296196 C46.832809 1.296196 46.622562 1.330435 46.472965 1.398913 C46.323368 1.467391 46.216225 1.581522 46.151535 1.741304 C46.090885 1.897826 46.060562 2.116304 46.060562 2.396739 C46.060562 2.677174 46.092911 2.897282 46.1576 3.057065 C46.22229 3.213587 46.329433 3.326087 46.479031 3.394565 C46.628628 3.463043 46.836853 3.497283 47.103703 3.497283 C47.378639 3.497283 47.590904 3.463043 47.740501 3.394565 C47.890099 3.326087 47.995224 3.213587 48.05587 3.057065 C48.12056 2.900543 48.152905 2.680435 48.152905 2.396739 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.782583 25.565201)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M45.998531 0.209799 L48.554039 0.209799 L48.554039 8.064182 L53.568008 8.064182 L53.568008 9.677019 L45.998531 9.677019 L45.998531 0.209799 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826057 10.434731)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M49.25404 3.668478 L49.25404 3.389674 C49.379375 3.415761 49.526951 3.438587 49.696766 3.458152 C49.870621 3.474456 50.036388 3.482609 50.194073 3.482609 C50.473053 3.482609 50.67926 3.446739 50.812683 3.375 C50.94611 3.3 51.012817 3.179348 51.012817 3.013043 C51.012817 2.905435 50.992599 2.820652 50.952168 2.758695 C50.911736 2.696739 50.836937 2.644565 50.727772 2.602174 C50.62265 2.559782 50.462944 2.517391 50.248657 2.475 C50.006065 2.426087 49.818062 2.373913 49.684635 2.318478 C49.555256 2.263043 49.460243 2.191304 49.399593 2.103261 C49.342991 2.011956 49.314682 1.889674 49.314682 1.736413 C49.314682 1.511413 49.411724 1.336957 49.605797 1.213044 C49.79987 1.089131 50.072781 1.027174 50.424538 1.027174 C50.582222 1.027174 50.739906 1.036957 50.897591 1.056522 C51.055275 1.072826 51.176563 1.092391 51.261471 1.115218 L51.237217 1.394022 C51.136135 1.364674 51.012817 1.340217 50.867264 1.320652 C50.72171 1.301087 50.574135 1.291304 50.424538 1.291304 C50.181946 1.291304 49.997982 1.325544 49.872643 1.394022 C49.747307 1.4625 49.684635 1.578261 49.684635 1.741304 C49.684635 1.845652 49.706875 1.927174 49.751347 1.98587 C49.795822 2.041304 49.862534 2.085326 49.951485 2.117935 C50.040432 2.147283 50.17588 2.179891 50.357826 2.215761 C50.616589 2.264674 50.816723 2.320108 50.958237 2.382065 C51.10379 2.440761 51.210934 2.519022 51.279667 2.616848 C51.3484 2.711413 51.382767 2.840217 51.382767 3.003261 C51.382767 3.244565 51.283714 3.428804 51.085598 3.555978 C50.891525 3.683152 50.596371 3.746739 50.200142 3.746739 C50.038414 3.746739 49.868603 3.738587 49.690704 3.722282 C49.512802 3.709239 49.367249 3.691304 49.25404 3.668478 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.782583 25.565201)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M53.450619 4.695652 L53.450619 0 L53.826633 0 L53.826633 4.695652 L53.450619 4.695652 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.782583 25.565201)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M54.840332 0.170463 L57.347317 0.170463 L57.347317 9.677019 L54.840332 9.677019 L54.840332 0.170463 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826057 10.434731)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M55.999046 2.020109 C55.999046 1.390761 56.166836 0.942391 56.502422 0.675 C56.842049 0.407609 57.341377 0.273913 58.000416 0.273913 C58.202576 0.273913 58.40271 0.285326 58.600826 0.308152 C58.802986 0.330978 58.964714 0.361956 59.086006 0.401087 L59.086006 0.704348 C58.798943 0.609783 58.443142 0.5625 58.018612 0.5625 C57.674942 0.5625 57.387875 0.603261 57.157413 0.684783 C56.926952 0.766304 56.745007 0.914674 56.611584 1.129891 C56.482201 1.341848 56.417515 1.638587 56.417515 2.020109 C56.417515 2.421196 56.480183 2.727717 56.605522 2.939674 C56.730862 3.15163 56.904716 3.295108 57.127094 3.370108 C57.353512 3.445108 57.644615 3.482609 58.000416 3.482609 C58.29961 3.482609 58.556351 3.454891 58.770638 3.399457 L58.770638 2.230435 L57.87912 2.230435 L57.87912 1.95163 L59.164848 1.95163 L59.164848 3.629348 C58.813091 3.720652 58.402714 3.766304 57.933704 3.766304 C57.505127 3.766304 57.151348 3.717391 56.872368 3.619565 C56.593391 3.521739 56.377083 3.345652 56.223442 3.091304 C56.073845 2.833695 55.999046 2.47663 55.999046 2.020109 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.782583 25.565201)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M59.422787 0.222913 L63.514832 0.236025 C64.986679 0.236025 66.409996 0.5245 67.445145 1.167011 C68.593506 1.888198 69.305168 3.199448 69.305168 4.812284 C69.305168 7.015183 68.189148 8.719806 65.989471 9.388543 C65.310158 9.598343 64.485283 9.677019 63.644226 9.677019 L59.422787 9.677019 L59.422787 0.222913 Z M61.96212 1.757074 L61.96212 8.116632 C62.301773 8.116632 62.64143 8.142857 62.981087 8.142857 C63.54718 8.142857 64.048576 8.116632 64.372055 8.051069 C66.296776 7.697032 66.717308 6.057971 66.717308 4.799171 C66.717308 3.52726 66.215912 2.097999 64.177971 1.809524 C63.838314 1.757074 63.304573 1.743961 62.819347 1.743961 C62.528214 1.743961 62.23708 1.743961 61.96212 1.757074 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826057 10.434731)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M60.116398 0.332609 C60.116398 0.247826 60.132576 0.194022 60.164921 0.171196 C60.201309 0.145109 60.268021 0.132065 60.365055 0.132065 C60.454006 0.132065 60.514652 0.145109 60.546997 0.171196 C60.583385 0.194022 60.601582 0.247826 60.601582 0.332609 C60.601582 0.417391 60.583385 0.472826 60.546997 0.498913 C60.514652 0.521739 60.454006 0.533152 60.365055 0.533152 C60.268021 0.533152 60.201309 0.521739 60.164921 0.498913 C60.132576 0.472826 60.116398 0.417391 60.116398 0.332609 Z M60.164921 3.717391 L60.164921 1.076087 L60.553062 1.076087 L60.553062 3.717391 L60.164921 3.717391 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.782583 25.565201)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M62.948643 3.443478 L62.948643 3.717391 C62.778831 3.736956 62.645409 3.746739 62.548374 3.746739 C62.317913 3.746739 62.140015 3.725543 62.014675 3.683152 C61.889336 3.640761 61.798359 3.560869 61.741756 3.443478 C61.68515 3.326087 61.656849 3.15163 61.656849 2.920109 L61.656849 1.345109 L61.147411 1.345109 L61.147411 1.076087 L61.656849 1.076087 L61.656849 0.45 L62.038929 0.45 L62.038929 1.076087 L62.906193 1.076087 L62.906193 1.345109 L62.038929 1.345109 L62.038929 2.915217 C62.038929 3.068478 62.053085 3.184239 62.081387 3.2625 C62.109688 3.34076 62.158203 3.396195 62.226936 3.428804 C62.299713 3.461413 62.406864 3.477717 62.548374 3.477717 C62.697971 3.477717 62.83139 3.466304 62.948643 3.443478 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.782583 25.565201)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M66.189407 0.322826 L66.601807 0.322826 L66.601807 3.717391 L66.189407 3.717391 L66.189407 2.025 L63.945442 2.025 L63.945442 3.717391 L63.545166 3.717391 L63.545166 0.322826 L63.945442 0.322826 L63.945442 1.746196 L66.189407 1.746196 L66.189407 0.322826 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.782583 25.565201)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M7.513052 3.717391 L6.615467 1.076087 L7.003612 1.076087 L7.755642 3.389674 L7.79203 3.389674 L8.689614 1.076087 L9.162666 1.076087 L10.078445 3.389674 L10.114834 3.389674 L10.872929 1.076087 L11.248943 1.076087 L10.333164 3.717391 L9.854049 3.717391 L8.944335 1.413587 L8.907947 1.413587 L7.992167 3.717391 L7.513052 3.717391 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.782583 25.565201)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M70.182899 1.076087 L70.182899 3.717391 L69.855408 3.717391 L69.800827 3.291848 C69.732094 3.458152 69.598671 3.578804 69.400551 3.653804 C69.206482 3.728804 68.986122 3.766304 68.739494 3.766304 C68.339218 3.766304 68.060242 3.694565 67.902557 3.551087 C67.744873 3.407609 67.666031 3.195652 67.666031 2.915217 L67.666031 1.076087 L68.048111 1.076087 L68.048111 2.768478 C68.048111 2.941304 68.068329 3.079891 68.108757 3.184239 C68.149193 3.285326 68.22197 3.361956 68.327087 3.41413 C68.432213 3.463043 68.583832 3.4875 68.781944 3.4875 C69.032623 3.4875 69.244888 3.446739 69.418747 3.365217 C69.596649 3.283695 69.721985 3.130435 69.794762 2.905435 L69.794762 1.076087 L70.182899 1.076087 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.782583 25.565201)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M71.240875 0.196687 L79.069145 0.196687 L79.069145 1.743961 L73.747864 1.743961 L73.747864 3.99931 L78.729485 3.99931 L78.729485 5.546584 L73.747864 5.546584 L73.747864 8.103519 L79.247063 8.103519 L79.247063 9.677019 L71.240875 9.677019 L71.240875 0.196687 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826057 10.434731)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M74.086952 2.396739 C74.086952 2.827174 73.989914 3.163043 73.795845 3.404348 C73.601768 3.645652 73.264168 3.766304 72.783028 3.766304 C72.463615 3.766304 72.214966 3.717391 72.037064 3.619565 C71.859161 3.521739 71.731804 3.386413 71.654984 3.213587 L71.600403 3.717391 L71.266838 3.717391 L71.266838 0 L71.654984 0 L71.654984 1.609239 C71.723717 1.423369 71.847038 1.279891 72.024933 1.178804 C72.206879 1.077717 72.459572 1.027174 72.783028 1.027174 C73.272255 1.027174 73.611877 1.141304 73.80191 1.369565 C73.991936 1.594565 74.086952 1.936956 74.086952 2.396739 Z M73.686684 2.396739 C73.686684 2.155435 73.6604 1.956522 73.607834 1.8 C73.555275 1.640217 73.458237 1.516304 73.316727 1.428261 C73.17926 1.340217 72.983162 1.296196 72.728447 1.296196 C72.328171 1.296196 72.045151 1.390761 71.879379 1.579891 C71.717651 1.769022 71.636795 2.041304 71.636795 2.396739 C71.636795 2.745652 71.719673 3.016304 71.885445 3.208695 C72.051216 3.401087 72.332214 3.497283 72.728447 3.497283 C73.104462 3.497283 73.357162 3.404348 73.486542 3.218478 C73.619965 3.029348 73.686684 2.755435 73.686684 2.396739 Z",
        "sourceNodeId": "270:26278",
        "transform": "matrix(1 0 0 1 66.782583 25.565201)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M80.982994 0.222913 L84.719215 0.222913 C85.948448 0.222913 86.854195 0.327812 87.436462 0.537612 C88.617172 0.9441 89.361183 1.770186 89.361183 3.028985 C89.361183 3.658385 89.183266 4.222222 88.859779 4.681159 C88.115776 5.717046 86.951241 5.992408 85.495567 5.992408 L83.522331 5.992408 L83.522331 9.677019 L80.982994 9.677019 L80.982994 0.222913 Z M83.457634 4.484472 L84.638344 4.484472 C86.142532 4.484472 86.773331 3.99931 86.773331 3.042098 C86.773331 2.176673 86.174881 1.757074 84.880951 1.757074 L83.457634 1.757074 L83.457634 4.484472 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826057 10.434731)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M90.935379 0.209799 L93.490883 0.209799 L93.490883 8.064182 L98.50486 8.064182 L98.50486 9.677019 L90.935379 9.677019 L90.935379 0.209799 Z",
        "sourceNodeId": "270:26277",
        "transform": "matrix(1 0 0 1 43.826057 10.434731)"
      },
      {
        "fill": "#7C62FF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#7C62FF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 15.652172 C0 7.007719 7.007719 0 15.652172 0 L15.652172 0 C24.296625 0 31.304344 7.007719 31.304344 15.652172 L31.304344 15.652172 C31.304344 24.296625 24.296625 31.304344 15.652172 31.304344 L15.652172 31.304344 C7.007719 31.304344 0 24.296625 0 15.652172 L0 15.652172 Z",
        "sourceNodeId": "270:26269",
        "transform": "matrix(1 0 0 1 6.782676 1.043489)"
      },
      {
        "fill": "#F5F8FF",
        "fillRule": "evenodd",
        "opacity": 1,
        "paint": {
          "color": "#F5F8FF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M1.196484 0.277054 C1.536737 0.611264 1.714246 0.954965 1.867458 1.576045 C1.990205 2.073688 2.069631 2.240287 2.278821 2.438848 C2.536607 2.683492 2.674322 2.735778 3.063131 2.73663 C3.485162 2.737563 3.638172 2.672133 3.959198 2.353298 C4.192118 2.122041 4.287401 1.923802 4.344962 1.550895 L4.371572 1.378497 L4.164696 1.378497 L3.957819 1.378497 L4.291337 0.851527 C4.47477 0.561695 4.633984 0.324637 4.645139 0.324677 C4.656294 0.324758 4.814981 0.557314 4.997804 0.841507 L5.330188 1.358215 L5.154505 1.370384 L4.978821 1.382554 L4.950993 1.694898 C4.883493 2.452315 4.697831 2.905946 4.282006 3.329234 C4.07667 3.538261 3.928814 3.645473 3.68843 3.759662 C3.402168 3.895593 3.327529 3.91328 2.982489 3.926909 C1.875692 3.970556 1.039663 3.342053 0.730846 2.234201 C0.569117 1.65405 0.402641 1.392005 0.094474 1.232668 C-0.011764 1.177703 -0.019715 1.161803 0.027786 1.098522 C0.696123 0.20769 0.857407 0.000569 0.883084 0 C0.899959 -0.000364 1.041001 0.124289 1.196484 0.277054 Z",
        "sourceNodeId": "270:26272",
        "transform": "matrix(1 0 0 1 23.752341 19.161766)"
      },
      {
        "fill": "#F5F8FF",
        "fillRule": "evenodd",
        "opacity": 1,
        "paint": {
          "color": "#F5F8FF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M3.112619 2.070565 C3.155941 1.2766 2.814189 0.544292 2.214527 0.146235 C2.093321 0.065796 1.983594 0 1.970654 0 C1.957673 0 1.947047 0.086686 1.946965 0.19268 C1.946154 1.567973 1.227152 2.976852 0.172398 3.669974 C0.077599 3.732281 0 3.786718 0 3.790977 C0 3.795196 0.125952 3.76668 0.279934 3.727576 C0.928557 3.562885 1.381659 3.589739 1.838859 3.820103 C2.294842 4.049778 2.587557 4.449012 2.701826 4.996955 C2.852482 5.719527 2.499005 6.477512 1.832533 6.861087 C1.717737 6.927167 1.658025 6.995883 1.627237 7.097497 C1.555925 7.332688 1.272056 7.72673 0.977641 7.999119 L0.701316 8.254837 L1.476339 8.230336 C2.317886 8.203726 2.47864 8.171598 2.966182 7.932674 C3.473033 7.6843 3.942647 7.256103 4.239172 6.772048 C4.315068 6.648125 4.437329 6.374316 4.510872 6.163584 C4.640272 5.792867 4.644573 5.759929 4.643315 5.151667 C4.642098 4.571192 4.633335 4.498013 4.529409 4.198406 C4.309348 3.564102 3.83799 2.941034 3.328746 2.611327 L3.091485 2.45767 L3.112619 2.070565 Z",
        "sourceNodeId": "270:26273",
        "transform": "matrix(1 0 0 1 27.200796 14.821357)"
      },
      {
        "fill": "#F5F8FF",
        "fillRule": "evenodd",
        "opacity": 1,
        "paint": {
          "color": "#F5F8FF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M3.146923 0.715906 C2.808089 0.475522 2.39981 0.274688 1.982322 0.143017 C1.794915 0.083914 1.536805 0.024609 1.408703 0.011223 C1.190872 -0.011534 1.171401 -0.006422 1.107715 0.09081 C0.820195 0.529635 0.685482 1.478515 0.820317 2.114887 L0.877918 2.386587 L0.696029 2.662506 C-0.126291 3.910101 -0.226689 5.50152 0.430656 6.869632 C0.691484 7.412464 1.000787 7.797704 1.441275 8.128425 C1.998872 8.547048 2.543326 8.782766 3.330517 8.946403 L3.682169 9.01946 L3.863775 8.841261 C3.963645 8.743258 4.03666 8.654341 4.026032 8.643713 C4.015405 8.633085 3.837814 8.581812 3.631382 8.529727 C2.796772 8.319158 2.185427 8.011559 1.863671 7.640274 C1.321042 7.014204 1.127957 5.928094 1.440505 5.260121 C1.588565 4.943761 1.794225 4.706703 2.02824 4.582738 L2.201369 4.491023 C2.201369 4.491023 2.715175 4.122406 3.402884 3.853609 C4.074226 3.591209 4.911293 3.428484 5.597874 3.427684 C6.201845 3.426979 7.08115 3.606329 7.818998 3.853609 C8.403217 4.049401 8.992158 4.479867 8.992158 4.479867 L9.146141 4.575842 C9.410012 4.740331 9.634089 4.987733 9.753023 5.245843 C9.850702 5.457832 9.869362 5.555998 9.881125 5.9199 C9.897229 6.418922 9.828796 6.771305 9.637698 7.173337 C9.471141 7.523732 9.033331 7.963449 8.683707 8.131507 L8.432371 8.252348 L8.430181 8.526157 C8.428801 8.696445 8.444541 8.799966 8.47176 8.799966 C8.569439 8.799966 9.077708 8.571304 9.401533 8.381666 C9.872323 8.105991 10.408014 7.56312 10.669938 7.096265 C11.046212 6.425696 11.208916 5.691888 11.173624 4.824664 C11.138212 3.953424 10.957783 3.357899 10.532588 2.70883 L10.329078 2.398067 L10.372358 2.163889 C10.481193 1.575018 10.39406 0.738054 10.169294 0.213679 C10.078308 0.001447 9.987364 -0.028084 9.621027 0.035724 C9.147358 0.118232 8.354122 0.473332 7.977767 0.771398 L7.818998 0.897188 L7.302047 0.772899 C6.138339 0.493168 4.854762 0.505742 3.735025 0.807865 L3.402884 0.897512 L3.146923 0.715906 Z",
        "sourceNodeId": "270:26271",
        "transform": "matrix(1 0 0 1 17.464988 9.913199)"
      },
      {
        "fill": "#F5F8FF",
        "fillRule": "evenodd",
        "opacity": 1,
        "paint": {
          "color": "#F5F8FF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M4.161834 0.000003 C4.021563 0.003695 3.518849 0.33259 3.265363 0.586523 C2.937846 0.914607 2.746829 1.266583 2.647243 1.725447 L2.583112 2.020876 L2.336075 2.110198 C1.5572 2.391836 0.824893 3.053522 0.430324 3.832154 C-0.56837 5.802889 0.22811 8.179023 2.230973 9.204042 C3.006522 9.600924 3.563186 9.714666 4.571534 9.682296 C5.316173 9.658363 5.777509 9.573096 6.49785 9.326262 C6.913634 9.183801 7.615114 8.844724 8.028951 8.586167 C9.146254 7.888137 10.419365 6.606874 11.31182 5.282328 C11.405767 5.142908 11.498334 5.0288 11.517521 5.0288 C11.536708 5.0288 11.727685 5.148506 11.941946 5.294781 L12.331485 5.560761 L12.331485 3.77362 C12.331485 2.790706 12.322073 1.986478 12.310594 1.986478 C12.299114 1.986478 11.565388 2.343281 10.680113 2.779388 L9.070519 3.572299 L9.527679 3.792765 L9.984839 4.013232 L9.849963 4.20141 C9.196959 5.112282 8.474468 5.878056 7.768 6.408069 C7.06137 6.938203 6.728743 7.148082 6.187899 7.405179 C5.411092 7.774436 4.79269 7.913166 4.204386 7.850169 L3.934674 7.821287 L3.691287 7.766891 L3.488466 7.670671 L3.320125 7.576806 C3.227557 7.525167 3.020233 7.360314 2.859395 7.210469 C2.536138 6.909279 2.317862 6.549191 2.211827 6.14221 C2.13232 5.836923 2.132361 5.275147 2.211948 4.969657 C2.440691 4.091521 3.231937 3.446793 4.080908 3.446793 C4.223572 3.446793 4.340317 3.438355 4.340317 3.428011 C4.340317 3.417667 4.304011 3.31719 4.259675 3.204665 C3.915811 2.332208 3.858291 1.200909 4.113075 0.321273 C4.172137 0.117356 4.190067 -0.000727 4.161834 0.000003 Z",
        "sourceNodeId": "270:26274",
        "transform": "matrix(1 0 0 1 13.043449 13.400353)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 15.652172 M31.304344 15.652172 M31.304344 15.652172 M0 15.652172 M15.652172 0 M31.304344 15.652172 M15.652172 31.304344 M0 15.652172 M15.652172 31.304344 L15.652172 29.739126 C7.872165 29.739126 1.565218 23.432178 1.565218 15.652172 L0 15.652172 L-1.565218 15.652172 C-1.565218 25.161072 6.143273 32.86956 15.652172 32.86956 L15.652172 31.304344 Z M31.304344 15.652172 L29.739126 15.652172 C29.739126 23.432178 23.432178 29.739126 15.652172 29.739126 L15.652172 31.304344 L15.652172 32.86956 C25.161072 32.86956 32.86956 25.161072 32.86956 15.652172 L31.304344 15.652172 Z M15.652172 0 L15.652172 1.565218 C23.432178 1.565218 29.739126 7.872165 29.739126 15.652172 L31.304344 15.652172 L32.86956 15.652172 C32.86956 6.143273 25.161072 -1.565218 15.652172 -1.565218 L15.652172 0 Z M15.652172 0 L15.652172 -1.565218 C6.143273 -1.565218 -1.565218 6.143273 -1.565218 15.652172 L0 15.652172 L1.565218 15.652172 C1.565218 7.872165 7.872165 1.565218 15.652172 1.565218 L15.652172 0 Z",
        "sourceNodeId": "270:26269",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 6.782676 1.043489)"
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
    "sourceClipsContent": false,
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
    ],
    "surfaceEffects": [],
    "surfaceFills": [],
    "surfaceNodeId": "270:26268",
    "surfaceStrokes": []
  },
  "circleAction": {
    "borderWidths": {
      "bottom": 1.652174,
      "left": 1.652174,
      "right": 1.652174,
      "top": 1.652174
    },
    "componentValues": [],
    "cornerRadii": {
      "bottomLeft": 55.072464,
      "bottomRight": 55.072464,
      "topLeft": 55.072464,
      "topRight": 55.072464
    },
    "derivedValues": [],
    "effects": [
      {
        "bevelSize": 0.550725,
        "blendMode": "NORMAL",
        "clipToShape": false,
        "color": "#000000",
        "chromaticAberration": 0.31,
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 2.202899
        },
        "opacity": 0.15,
        "radius": 2.202899,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "GLASS",
          "offset": {
            "x": 0,
            "y": 2.2028987407684326
          },
          "radius": 2.2028987407684326,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 3832,
          "clipToShape": false,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448,
          "refractionRadius": 9.913043975830078,
          "specularAngle": -45,
          "specularIntensity": 0.800000011920929,
          "bevelSize": 0.5507246851921082,
          "chromaticAberration": 0.3100000023841858,
          "reflectionDistance": 0,
          "refractionIntensity": 0.7400000095367432
        },
        "rawType": "GLASS",
        "reflectionDistance": 0,
        "refractionIntensity": 0.74,
        "refractionRadius": 9.913044,
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 3832,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "845:3504",
        "spread": 0,
        "specularAngle": -45,
        "specularIntensity": 0.8,
        "type": "GLASS",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.202899
        },
        "opacity": 0.25,
        "radius": 3.304348,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 2.2028987407684326
          },
          "radius": 3.3043482303619385,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.72998046875,
            "g": 0.72998046875,
            "b": 0.72998046875,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.72998,
          "g": 0.72998,
          "r": 0.72998
        },
        "sourceNodeId": "845:3504",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
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
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.75 -1.5 C0.335786 -1.5 0 -1.164214 0 -0.75 C0 -0.335786 0.335786 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M12.25 0 C12.664213 0 13 -0.335786 13 -0.75 C13 -1.164214 12.664213 -1.5 12.25 -1.5 L12.25 -0.75 L12.25 0 Z M0.75 -0.75 L0.75 0 L12.25 0 L12.25 -0.75 L12.25 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "845:3508",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "transform": "matrix(-1 0 0 -1 25.999979 18)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.75 -1.5 C0.335786 -1.5 0 -1.164214 0 -0.75 C0 -0.335786 0.335786 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711104 0 C8.125318 0 8.461104 -0.335786 8.461104 -0.75 C8.461104 -1.164214 8.125318 -1.5 7.711104 -1.5 L7.711104 -0.75 L7.711104 0 Z M0.75 -0.75 L0.75 0 L7.711104 0 L7.711104 -0.75 L7.711104 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "845:3506",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "transform": "matrix(-0.640184 0.768221 -0.768221 -0.640184 18.416666 12)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.75 -1.5 C0.335786 -1.5 0 -1.164214 0 -0.75 C0 -0.335786 0.335786 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711104 0 C8.125318 0 8.461104 -0.335786 8.461104 -0.75 C8.461104 -1.164214 8.125318 -1.5 7.711104 -1.5 L7.711104 -0.75 L7.711104 0 Z M0.75 -0.75 L0.75 0 L7.711104 0 L7.711104 -0.75 L7.711104 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "845:3507",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "transform": "matrix(-0.640184 -0.768221 -0.768221 0.640184 18.416666 25.5)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 0.2,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 0.2,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M33.04348 16.52174 C33.04348 25.646444 25.646444 33.04348 16.52174 33.04348 C7.397035 33.04348 0 25.646444 0 16.52174 C0 7.397035 7.397035 0 16.52174 0 C25.646444 0 33.04348 7.397035 33.04348 16.52174 Z",
        "sourceNodeId": "845:3504",
        "transform": "matrix(1 0 0 1 1.999991 2.202872)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M33.04348 16.52174 L31.391306 16.52174 C31.391306 24.733974 24.733974 31.391306 16.52174 31.391306 L16.52174 33.04348 L16.52174 34.695656 C26.558916 34.695656 34.695656 26.558916 34.695656 16.52174 L33.04348 16.52174 Z M16.52174 33.04348 L16.52174 31.391306 C8.309505 31.391306 1.652174 24.733974 1.652174 16.52174 L0 16.52174 L-1.652174 16.52174 C-1.652174 26.558916 6.484564 34.695656 16.52174 34.695656 L16.52174 33.04348 Z M0 16.52174 L1.652174 16.52174 C1.652174 8.309505 8.309505 1.652174 16.52174 1.652174 L16.52174 0 L16.52174 -1.652174 C6.484564 -1.652174 -1.652174 6.484564 -1.652174 16.52174 L0 16.52174 Z M16.52174 0 L16.52174 1.652174 C24.733974 1.652174 31.391306 8.309505 31.391306 16.52174 L33.04348 16.52174 L34.695656 16.52174 C34.695656 6.484564 26.558916 -1.652174 16.52174 -1.652174 L16.52174 0 Z",
        "sourceNodeId": "845:3504",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 1.999991 2.202872)"
      }
    ],
    "instanceNodeIds": [],
    "key": "circleAction",
    "noSymbolReason": "no-instance-or-symbol-in-audited-subtree",
    "overrides": [],
    "size": {
      "height": 33.04348,
      "width": 33.04348
    },
    "sourceClipsContent": false,
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
    ],
    "surfaceEffects": [
      {
        "bevelSize": 0.550725,
        "blendMode": "NORMAL",
        "clipToShape": false,
        "color": "#000000",
        "chromaticAberration": 0.31,
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 2.202899
        },
        "opacity": 0.15,
        "radius": 2.202899,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "GLASS",
          "offset": {
            "x": 0,
            "y": 2.2028987407684326
          },
          "radius": 2.2028987407684326,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 3832,
          "clipToShape": false,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448,
          "refractionRadius": 9.913043975830078,
          "specularAngle": -45,
          "specularIntensity": 0.800000011920929,
          "bevelSize": 0.5507246851921082,
          "chromaticAberration": 0.3100000023841858,
          "reflectionDistance": 0,
          "refractionIntensity": 0.7400000095367432
        },
        "rawType": "GLASS",
        "reflectionDistance": 0,
        "refractionIntensity": 0.74,
        "refractionRadius": 9.913044,
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 3832,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "845:3504",
        "spread": 0,
        "specularAngle": -45,
        "specularIntensity": 0.8,
        "type": "GLASS",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.202899
        },
        "opacity": 0.25,
        "radius": 3.304348,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 2.2028987407684326
          },
          "radius": 3.3043482303619385,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.72998046875,
            "g": 0.72998046875,
            "b": 0.72998046875,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.72998,
          "g": 0.72998,
          "r": 0.72998
        },
        "sourceNodeId": "845:3504",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
      }
    ],
    "surfaceFills": [
      {
        "color": "#FFFFFF",
        "opacity": 0.2,
        "type": "SOLID",
        "variableIds": []
      }
    ],
    "surfaceNodeId": "845:3504",
    "surfaceStrokes": [
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ]
  },
  "bottomNav": {
    "borderWidths": {
      "bottom": 1.339601,
      "left": 1.339601,
      "right": 1.339601,
      "top": 1.339601
    },
    "componentValues": [],
    "cornerRadii": {
      "bottomLeft": 44.653347,
      "bottomRight": 44.653347,
      "topLeft": 44.653347,
      "topRight": 44.653347
    },
    "derivedValues": [],
    "effects": [
      {
        "blendMode": "NORMAL",
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 1.786134
        },
        "opacity": 0.25,
        "radius": 2.679201,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 1.786134123802185
          },
          "radius": 2.679201364517212,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.72998046875,
            "g": 0.72998046875,
            "b": 0.72998046875,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.72998,
          "g": 0.72998,
          "r": 0.72998
        },
        "sourceNodeId": "270:26530",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
      },
      {
        "bevelSize": 0.446534,
        "blendMode": "NORMAL",
        "clipToShape": false,
        "color": "#000000",
        "chromaticAberration": 0.31,
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 1.786134
        },
        "opacity": 0.15,
        "radius": 1.786134,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "GLASS",
          "offset": {
            "x": 0,
            "y": 1.786134123802185
          },
          "radius": 1.786134123802185,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 3832,
          "clipToShape": false,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448,
          "refractionRadius": 8.037603378295898,
          "specularAngle": -45,
          "specularIntensity": 0.800000011920929,
          "bevelSize": 0.44653353095054626,
          "chromaticAberration": 0.3100000023841858,
          "reflectionDistance": 0,
          "refractionIntensity": 0.7400000095367432
        },
        "rawType": "GLASS",
        "reflectionDistance": 0,
        "refractionIntensity": 0.74,
        "refractionRadius": 8.037603,
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 3832,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "270:26530",
        "spread": 0,
        "specularAngle": -45,
        "specularIntensity": 0.8,
        "type": "GLASS",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#9B82E9",
        "offset": {
          "x": 2,
          "y": 2
        },
        "opacity": 0.25,
        "radius": 4,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.6096577048301697,
            "c1": 0.5080081820487976,
            "c2": 0.9146071076393127,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 2,
            "y": 2
          },
          "radius": 4,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.6096577048301697,
            "g": 0.5080081820487976,
            "b": 0.9146071076393127,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.6096577048301697,
            "c1": 0.5080081820487976,
            "c2": 0.9146071076393127,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.914607,
          "g": 0.508008,
          "r": 0.609658
        },
        "sourceNodeId": "270:26531",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
      },
      {
        "bevelSize": 0.66087,
        "blendMode": "NORMAL",
        "clipToShape": false,
        "color": "#000000",
        "chromaticAberration": 0.31,
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "opacity": 0.15,
        "radius": 2.643479,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "GLASS",
          "offset": {
            "x": 0,
            "y": 2.6434786319732666
          },
          "radius": 2.6434786319732666,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 3832,
          "clipToShape": false,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448,
          "refractionRadius": 11.895652770996094,
          "specularAngle": -45,
          "specularIntensity": 0.800000011920929,
          "bevelSize": 0.6608696579933167,
          "chromaticAberration": 0.3100000023841858,
          "reflectionDistance": 0,
          "refractionIntensity": 0.7400000095367432
        },
        "rawType": "GLASS",
        "reflectionDistance": 0,
        "refractionIntensity": 0.74,
        "refractionRadius": 11.895653,
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 3832,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "270:26552",
        "spread": 0,
        "specularAngle": -45,
        "specularIntensity": 0.8,
        "type": "GLASS",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "opacity": 0.25,
        "radius": 3.965218,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 2.6434786319732666
          },
          "radius": 3.9652180671691895,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.72998046875,
            "g": 0.72998046875,
            "b": 0.72998046875,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.72998,
          "g": 0.72998,
          "r": 0.72998
        },
        "sourceNodeId": "270:26552",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
      },
      {
        "bevelSize": 0.66087,
        "blendMode": "NORMAL",
        "clipToShape": false,
        "color": "#000000",
        "chromaticAberration": 0.31,
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "opacity": 0.15,
        "radius": 2.643479,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "GLASS",
          "offset": {
            "x": 0,
            "y": 2.6434786319732666
          },
          "radius": 2.6434786319732666,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 3832,
          "clipToShape": false,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448,
          "refractionRadius": 11.895652770996094,
          "specularAngle": -45,
          "specularIntensity": 0.800000011920929,
          "bevelSize": 0.6608696579933167,
          "chromaticAberration": 0.3100000023841858,
          "reflectionDistance": 0,
          "refractionIntensity": 0.7400000095367432
        },
        "rawType": "GLASS",
        "reflectionDistance": 0,
        "refractionIntensity": 0.74,
        "refractionRadius": 11.895653,
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 3832,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "270:26546",
        "spread": 0,
        "specularAngle": -45,
        "specularIntensity": 0.8,
        "type": "GLASS",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "opacity": 0.25,
        "radius": 3.965218,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 2.6434786319732666
          },
          "radius": 3.9652180671691895,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.72998046875,
            "g": 0.72998046875,
            "b": 0.72998046875,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.72998,
          "g": 0.72998,
          "r": 0.72998
        },
        "sourceNodeId": "270:26546",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
      },
      {
        "bevelSize": 0.66087,
        "blendMode": "NORMAL",
        "clipToShape": false,
        "color": "#000000",
        "chromaticAberration": 0.31,
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "opacity": 0.15,
        "radius": 2.643479,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "GLASS",
          "offset": {
            "x": 0,
            "y": 2.6434786319732666
          },
          "radius": 2.6434786319732666,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 3832,
          "clipToShape": false,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448,
          "refractionRadius": 11.895652770996094,
          "specularAngle": -45,
          "specularIntensity": 0.800000011920929,
          "bevelSize": 0.6608696579933167,
          "chromaticAberration": 0.3100000023841858,
          "reflectionDistance": 0,
          "refractionIntensity": 0.7400000095367432
        },
        "rawType": "GLASS",
        "reflectionDistance": 0,
        "refractionIntensity": 0.74,
        "refractionRadius": 11.895653,
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 3832,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "270:26538",
        "spread": 0,
        "specularAngle": -45,
        "specularIntensity": 0.8,
        "type": "GLASS",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 2.643479
        },
        "opacity": 0.25,
        "radius": 3.965218,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 2.6434786319732666
          },
          "radius": 3.9652178287506104,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.72998046875,
            "g": 0.72998046875,
            "b": 0.72998046875,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.72998,
          "g": 0.72998,
          "r": 0.72998
        },
        "sourceNodeId": "270:26538",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#939393",
        "offset": {
          "x": 0,
          "y": 4
        },
        "opacity": 0.25,
        "radius": 10,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.5753831267356873,
            "c1": 0.5753831267356873,
            "c2": 0.5753831267356873,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 4
          },
          "radius": 10,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.5753831267356873,
            "g": 0.5753831267356873,
            "b": 0.5753831267356873,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.5753831267356873,
            "c1": 0.5753831267356873,
            "c2": 0.5753831267356873,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.575383,
          "g": 0.575383,
          "r": 0.575383
        },
        "sourceNodeId": "270:26532",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
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
        "end": {
          "x": 0.486304,
          "y": -0.091011
        },
        "gradientStops": [
          {
            "color": "#C05CF6",
            "opacity": 1,
            "position": 0,
            "variableIds": [
              "153:2325"
            ]
          },
          {
            "color": "#7C62FF",
            "opacity": 1,
            "position": 1,
            "variableIds": [
              "106:76525"
            ]
          }
        ],
        "opacity": 1,
        "start": {
          "x": -0.230402,
          "y": 0.675698
        },
        "transform": "matrix(0.716706 -0.766709 0.766709 0.716706 -0.230402 0.675698)",
        "type": "GRADIENT_LINEAR",
        "variableIds": [
          "106:76525",
          "153:2325"
        ]
      }
    ],
    "geometry": [
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.582954 0 L0.582954 0.75 L3.497723 0.75 L3.497723 0 L3.497723 -0.75 L0.582954 -0.75 L0.582954 0 Z M3.497723 0 L3.497723 0.75 C3.405466 0.75 3.330677 0.675211 3.330677 0.582954 L4.080677 0.582954 L4.830677 0.582954 C4.830677 -0.153216 4.233893 -0.75 3.497723 -0.75 L3.497723 0 Z M4.080677 0.582954 L3.330677 0.582954 L3.330677 3.497723 L4.080677 3.497723 L4.830677 3.497723 L4.830677 0.582954 L4.080677 0.582954 Z M4.080677 3.497723 L3.330677 3.497723 C3.330677 3.405466 3.405466 3.330677 3.497723 3.330677 L3.497723 4.080677 L3.497723 4.830677 C4.233893 4.830677 4.830677 4.233893 4.830677 3.497723 L4.080677 3.497723 Z M3.497723 4.080677 L3.497723 3.330677 L0.582954 3.330677 L0.582954 4.080677 L0.582954 4.830677 L3.497723 4.830677 L3.497723 4.080677 Z M0.582954 4.080677 L0.582954 3.330677 C0.675211 3.330677 0.75 3.405466 0.75 3.497723 L0 3.497723 L-0.75 3.497723 C-0.75 4.233893 -0.153216 4.830677 0.582954 4.830677 L0.582954 4.080677 Z M0 3.497723 L0.75 3.497723 L0.75 0.582954 L0 0.582954 L-0.75 0.582954 L-0.75 3.497723 L0 3.497723 Z M0 0.582954 L0.75 0.582954 C0.75 0.675211 0.675211 0.75 0.582954 0.75 L0.582954 0 L0.582954 -0.75 C-0.153216 -0.75 -0.75 -0.153216 -0.75 0.582954 L0 0.582954 Z",
        "sourceNodeId": "270:26541",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 126.68045 15.457418)"
      },
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.582954 0 L0.582954 0.75 L3.497723 0.75 L3.497723 0 L3.497723 -0.75 L0.582954 -0.75 L0.582954 0 Z M3.497723 0 L3.497723 0.75 C3.405466 0.75 3.330677 0.675211 3.330677 0.582954 L4.080677 0.582954 L4.830677 0.582954 C4.830677 -0.153216 4.233893 -0.75 3.497723 -0.75 L3.497723 0 Z M4.080677 0.582954 L3.330677 0.582954 L3.330677 3.497723 L4.080677 3.497723 L4.830677 3.497723 L4.830677 0.582954 L4.080677 0.582954 Z M4.080677 3.497723 L3.330677 3.497723 C3.330677 3.405466 3.405466 3.330677 3.497723 3.330677 L3.497723 4.080677 L3.497723 4.830677 C4.233893 4.830677 4.830677 4.233893 4.830677 3.497723 L4.080677 3.497723 Z M3.497723 4.080677 L3.497723 3.330677 L0.582954 3.330677 L0.582954 4.080677 L0.582954 4.830677 L3.497723 4.830677 L3.497723 4.080677 Z M0.582954 4.080677 L0.582954 3.330677 C0.675211 3.330677 0.75 3.405466 0.75 3.497723 L0 3.497723 L-0.75 3.497723 C-0.75 4.233893 -0.153216 4.830677 0.582954 4.830677 L0.582954 4.080677 Z M0 3.497723 L0.75 3.497723 L0.75 0.582954 L0 0.582954 L-0.75 0.582954 L-0.75 3.497723 L0 3.497723 Z M0 0.582954 L0.75 0.582954 C0.75 0.675211 0.675211 0.75 0.582954 0.75 L0.582954 0 L0.582954 -0.75 C-0.153216 -0.75 -0.75 -0.153216 -0.75 0.582954 L0 0.582954 Z",
        "sourceNodeId": "270:26542",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 133.092958 15.457418)"
      },
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.582954 0 L0.582954 0.75 L3.497723 0.75 L3.497723 0 L3.497723 -0.75 L0.582954 -0.75 L0.582954 0 Z M3.497723 0 L3.497723 0.75 C3.405466 0.75 3.330677 0.675211 3.330677 0.582954 L4.080677 0.582954 L4.830677 0.582954 C4.830677 -0.153216 4.233893 -0.75 3.497723 -0.75 L3.497723 0 Z M4.080677 0.582954 L3.330677 0.582954 L3.330677 3.497723 L4.080677 3.497723 L4.830677 3.497723 L4.830677 0.582954 L4.080677 0.582954 Z M4.080677 3.497723 L3.330677 3.497723 C3.330677 3.405466 3.405466 3.330677 3.497723 3.330677 L3.497723 4.080677 L3.497723 4.830677 C4.233893 4.830677 4.830677 4.233893 4.830677 3.497723 L4.080677 3.497723 Z M3.497723 4.080677 L3.497723 3.330677 L0.582954 3.330677 L0.582954 4.080677 L0.582954 4.830677 L3.497723 4.830677 L3.497723 4.080677 Z M0.582954 4.080677 L0.582954 3.330677 C0.675211 3.330677 0.75 3.405466 0.75 3.497723 L0 3.497723 L-0.75 3.497723 C-0.75 4.233893 -0.153216 4.830677 0.582954 4.830677 L0.582954 4.080677 Z M0 3.497723 L0.75 3.497723 L0.75 0.582954 L0 0.582954 L-0.75 0.582954 L-0.75 3.497723 L0 3.497723 Z M0 0.582954 L0.75 0.582954 C0.75 0.675211 0.675211 0.75 0.582954 0.75 L0.582954 0 L0.582954 -0.75 C-0.153216 -0.75 -0.75 -0.153216 -0.75 0.582954 L0 0.582954 Z",
        "sourceNodeId": "270:26543",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 133.092958 21.870014)"
      },
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.582954 0 L0.582954 0.75 L3.497723 0.75 L3.497723 0 L3.497723 -0.75 L0.582954 -0.75 L0.582954 0 Z M3.497723 0 L3.497723 0.75 C3.405466 0.75 3.330677 0.675211 3.330677 0.582954 L4.080677 0.582954 L4.830677 0.582954 C4.830677 -0.153216 4.233893 -0.75 3.497723 -0.75 L3.497723 0 Z M4.080677 0.582954 L3.330677 0.582954 L3.330677 3.497723 L4.080677 3.497723 L4.830677 3.497723 L4.830677 0.582954 L4.080677 0.582954 Z M4.080677 3.497723 L3.330677 3.497723 C3.330677 3.405466 3.405466 3.330677 3.497723 3.330677 L3.497723 4.080677 L3.497723 4.830677 C4.233893 4.830677 4.830677 4.233893 4.830677 3.497723 L4.080677 3.497723 Z M3.497723 4.080677 L3.497723 3.330677 L0.582954 3.330677 L0.582954 4.080677 L0.582954 4.830677 L3.497723 4.830677 L3.497723 4.080677 Z M0.582954 4.080677 L0.582954 3.330677 C0.675211 3.330677 0.75 3.405466 0.75 3.497723 L0 3.497723 L-0.75 3.497723 C-0.75 4.233893 -0.153216 4.830677 0.582954 4.830677 L0.582954 4.080677 Z M0 3.497723 L0.75 3.497723 L0.75 0.582954 L0 0.582954 L-0.75 0.582954 L-0.75 3.497723 L0 3.497723 Z M0 0.582954 L0.75 0.582954 C0.75 0.675211 0.675211 0.75 0.582954 0.75 L0.582954 0 L0.582954 -0.75 C-0.153216 -0.75 -0.75 -0.153216 -0.75 0.582954 L0 0.582954 Z",
        "sourceNodeId": "270:26544",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 126.68045 21.870014)"
      },
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M11.659077 5.829538 L10.909077 5.829538 C10.909077 8.63489 8.63489 10.909077 5.829538 10.909077 L5.829538 11.659077 L5.829538 12.409077 C9.463317 12.409077 12.409077 9.463317 12.409077 5.829538 L11.659077 5.829538 Z M5.829538 11.659077 L5.829538 10.909077 C3.024187 10.909077 0.75 8.63489 0.75 5.829538 L0 5.829538 L-0.75 5.829538 C-0.75 9.463317 2.19576 12.409077 5.829538 12.409077 L5.829538 11.659077 Z M0 5.829538 L0.75 5.829538 C0.75 3.024187 3.024187 0.75 5.829538 0.75 L5.829538 0 L5.829538 -0.75 C2.19576 -0.75 -0.75 2.19576 -0.75 5.829538 L0 5.829538 Z M5.829538 0 L5.829538 0.75 C8.63489 0.75 10.909077 3.024187 10.909077 5.829538 L11.659077 5.829538 L12.409077 5.829538 C12.409077 2.19576 9.463317 -0.75 5.829538 -0.75 L5.829538 0 Z",
        "sourceNodeId": "270:26550",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 200.097477 14.874444)"
      },
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M4.66363 2.331815 L3.91363 2.331815 C3.91363 3.205428 3.205428 3.91363 2.331815 3.91363 L2.331815 4.66363 L2.331815 5.41363 C4.033855 5.41363 5.41363 4.033855 5.41363 2.331815 L4.66363 2.331815 Z M2.331815 4.66363 L2.331815 3.91363 C1.458203 3.91363 0.75 3.205428 0.75 2.331815 L0 2.331815 L-0.75 2.331815 C-0.75 4.033855 0.629776 5.41363 2.331815 5.41363 L2.331815 4.66363 Z M0 2.331815 L0.75 2.331815 C0.75 1.458203 1.458203 0.75 2.331815 0.75 L2.331815 0 L2.331815 -0.75 C0.629776 -0.75 -0.75 0.629776 -0.75 2.331815 L0 2.331815 Z M2.331815 0 L2.331815 0.75 C3.205428 0.75 3.91363 1.458203 3.91363 2.331815 L4.66363 2.331815 L5.41363 2.331815 C5.41363 0.629776 4.033855 -0.75 2.331815 -0.75 L2.331815 0 Z",
        "sourceNodeId": "270:26556",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 277.59517 15.457242)"
      },
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M4.943448 0 L5.654947 0.23721 L6.129434 -1.185986 L4.706238 -0.711499 L4.943448 0 Z M3.891799 3.154363 L3.1803 2.917152 L3.180279 2.917217 L3.891799 3.154363 Z M3.154363 3.891799 L2.917217 3.180279 L2.917152 3.1803 L3.154363 3.891799 Z M0 4.943448 L-0.711499 4.706238 L-1.185986 6.129434 L0.23721 5.654947 L0 4.943448 Z M1.051649 1.789085 L1.763148 2.026296 L1.763169 2.026231 L1.051649 1.789085 Z M1.789085 1.051649 L2.026231 1.763169 L2.026296 1.763148 L1.789085 1.051649 Z M4.943448 0 L4.231949 -0.23721 L3.1803 2.917152 L3.891799 3.154363 L4.603299 3.391573 L5.654947 0.23721 L4.943448 0 Z M3.891799 3.154363 L3.180279 2.917217 C3.159861 2.978477 3.12546 3.034141 3.0798 3.0798 L3.610131 3.610131 L4.14046 4.14046 C4.350795 3.930126 4.509266 3.673705 4.60332 3.391509 L3.891799 3.154363 Z M3.610131 3.610131 L3.0798 3.0798 C3.034141 3.12546 2.978477 3.159861 2.917217 3.180279 L3.154363 3.891799 L3.391509 4.60332 C3.673705 4.509266 3.930126 4.350795 4.14046 4.14046 L3.610131 3.610131 Z M3.154363 3.891799 L2.917152 3.1803 L-0.23721 4.231949 L0 4.943448 L0.23721 5.654947 L3.391573 4.603299 L3.154363 3.891799 Z M0 4.943448 L0.711499 5.180658 L1.763148 2.026296 L1.051649 1.789085 L0.340149 1.551875 L-0.711499 4.706238 L0 4.943448 Z M1.051649 1.789085 L1.763169 2.026231 C1.783587 1.964971 1.817988 1.909307 1.863648 1.863648 L1.333318 1.333318 L0.802987 0.802987 C0.592653 1.013322 0.434182 1.269743 0.340128 1.55194 L1.051649 1.789085 Z M1.333318 1.333318 L1.863648 1.863648 C1.909307 1.817988 1.964971 1.783587 2.026231 1.763169 L1.789085 1.051649 L1.55194 0.340128 C1.269743 0.434182 1.013322 0.592653 0.802987 0.802987 L1.333318 1.333318 Z M1.789085 1.051649 L2.026296 1.763148 L5.180658 0.711499 L4.943448 0 L4.706238 -0.711499 L1.551875 0.340149 L1.789085 1.051649 Z",
        "sourceNodeId": "270:26549",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 203.455304 18.232121)"
      },
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M5.829538 0 L5.829538 -0.75 L5.829538 0 Z M2.331815 0 L2.331815 -0.75 L2.331815 0 Z M0 2.331815 L-0.75 2.331815 L0 2.331815 Z M8.161353 3.497723 L8.911353 3.497723 L8.911353 2.331815 L8.161353 2.331815 L7.411353 2.331815 L7.411353 3.497723 L8.161353 3.497723 Z M8.161353 2.331815 L8.911353 2.331815 C8.911353 1.514467 8.586662 0.730595 8.00871 0.152643 L7.47838 0.682973 L6.94805 1.213303 C7.244698 1.509952 7.411353 1.912292 7.411353 2.331815 L8.161353 2.331815 Z M7.47838 0.682973 L8.00871 0.152643 C7.430758 -0.425309 6.646887 -0.75 5.829538 -0.75 L5.829538 0 L5.829538 0.75 C6.249061 0.75 6.651402 0.916655 6.94805 1.213303 L7.47838 0.682973 Z M5.829538 0 L5.829538 -0.75 L2.331815 -0.75 L2.331815 0 L2.331815 0.75 L5.829538 0.75 L5.829538 0 Z M2.331815 0 L2.331815 -0.75 C1.514467 -0.75 0.730595 -0.425309 0.152643 0.152643 L0.682973 0.682973 L1.213303 1.213303 C1.509951 0.916655 1.912292 0.75 2.331815 0.75 L2.331815 0 Z M0.682973 0.682973 L0.152643 0.152643 C-0.42531 0.730596 -0.75 1.514467 -0.75 2.331815 L0 2.331815 L0.75 2.331815 C0.75 1.912292 0.916655 1.509951 1.213303 1.213303 L0.682973 0.682973 Z M0 2.331815 L-0.75 2.331815 L-0.75 3.497723 L0 3.497723 L0.75 3.497723 L0.75 2.331815 L0 2.331815 Z",
        "sourceNodeId": "270:26555",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 275.846303 22.452707)"
      },
      {
        "fill": "#D9D9D9",
        "fillRule": "nonzero",
        "opacity": 0.1,
        "paint": {
          "color": "#D9D9D9",
          "opacity": 0.1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 24 C0 10.745167 10.745167 0 24 0 L24 0 C37.254833 0 48 10.745167 48 24 L48 24 C48 37.254833 37.254833 48 24 48 L24 48 C10.745167 48 0 37.254833 0 24 L0 24 Z",
        "sourceNodeId": "270:26532",
        "transform": "matrix(1 0 0 1 34.527027 3)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 0.2,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 0.2,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 24 C0 10.745167 10.745167 0 24 0 L24 0 C37.254833 0 48 10.745167 48 24 L48 24 C48 37.254833 37.254833 48 24 48 L24 48 C10.745167 48 0 37.254833 0 24 L0 24 Z",
        "sourceNodeId": "270:26538",
        "transform": "matrix(1 0 0 1 108.527027 3)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 0.2,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 0.2,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 24 C0 10.745167 10.745167 0 24 0 L24 0 C37.254833 0 48 10.745167 48 24 L48 24 C48 37.254833 37.254833 48 24 48 L24 48 C10.745167 48 0 37.254833 0 24 L0 24 Z",
        "sourceNodeId": "270:26546",
        "transform": "matrix(1 0 0 1 182.527027 3)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 0.2,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 0.2,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 24 C0 10.745167 10.745167 0 24 0 L24 0 C37.254833 0 48 10.745167 48 24 L48 24 C48 37.254833 37.254833 48 24 48 L24 48 C10.745167 48 0 37.254833 0 24 L0 24 Z",
        "sourceNodeId": "270:26552",
        "transform": "matrix(1 0 0 1 256.527027 3)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 0.7,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 0.7,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 27 C0 12.088311 12.088313 0 27.000002 0 L308 0 C322.911682 0 335 12.088311 335 27 L335 27 C335 41.91169 322.911682 54 308 54 L27.00001 54 C12.088321 54 0 41.91169 0 27 L0 27 Z",
        "sourceNodeId": "270:26530"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 24 M48 24 M48 24 M0 24 M24 0 M48 24 M24 48 M0 24 M24 48 L24 46.017391 C11.840131 46.017391 1.982609 36.15987 1.982609 24 L0 24 L-1.982609 24 C-1.982609 38.3498 9.650202 49.982609 24 49.982609 L24 48 Z M48 24 L46.017391 24 C46.017391 36.15987 36.15987 46.017391 24 46.017391 L24 48 L24 49.982609 C38.3498 49.982609 49.982609 38.3498 49.982609 24 L48 24 Z M24 0 L24 1.982609 C36.15987 1.982609 46.017391 11.840131 46.017391 24 L48 24 L49.982609 24 C49.982609 9.650202 38.3498 -1.982609 24 -1.982609 L24 0 Z M24 0 L24 -1.982609 C9.650202 -1.982609 -1.982609 9.650202 -1.982609 24 L0 24 L1.982609 24 C1.982609 11.840131 11.840131 1.982609 24 1.982609 L24 0 Z",
        "sourceNodeId": "270:26538",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 108.527027 3)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 24 M48 24 M48 24 M0 24 M24 0 M48 24 M24 48 M0 24 M24 48 L24 46.017391 C11.840131 46.017391 1.982609 36.15987 1.982609 24 L0 24 L-1.982609 24 C-1.982609 38.3498 9.650202 49.982609 24 49.982609 L24 48 Z M48 24 L46.017391 24 C46.017391 36.15987 36.15987 46.017391 24 46.017391 L24 48 L24 49.982609 C38.3498 49.982609 49.982609 38.3498 49.982609 24 L48 24 Z M24 0 L24 1.982609 C36.15987 1.982609 46.017391 11.840131 46.017391 24 L48 24 L49.982609 24 C49.982609 9.650202 38.3498 -1.982609 24 -1.982609 L24 0 Z M24 0 L24 -1.982609 C9.650202 -1.982609 -1.982609 9.650202 -1.982609 24 L0 24 L1.982609 24 C1.982609 11.840131 11.840131 1.982609 24 1.982609 L24 0 Z",
        "sourceNodeId": "270:26546",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 182.527027 3)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 24 M48 24 M48 24 M0 24 M24 0 M48 24 M24 48 M0 24 M24 48 L24 46.017391 C11.840131 46.017391 1.982609 36.15987 1.982609 24 L0 24 L-1.982609 24 C-1.982609 38.3498 9.650202 49.982609 24 49.982609 L24 48 Z M48 24 L46.017391 24 C46.017391 36.15987 36.15987 46.017391 24 46.017391 L24 48 L24 49.982609 C38.3498 49.982609 49.982609 38.3498 49.982609 24 L48 24 Z M24 0 L24 1.982609 C36.15987 1.982609 46.017391 11.840131 46.017391 24 L48 24 L49.982609 24 C49.982609 9.650202 38.3498 -1.982609 24 -1.982609 L24 0 Z M24 0 L24 -1.982609 C9.650202 -1.982609 -1.982609 9.650202 -1.982609 24 L0 24 L1.982609 24 C1.982609 11.840131 11.840131 1.982609 24 1.982609 L24 0 Z",
        "sourceNodeId": "270:26552",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 256.527027 3)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 27 M335 27 M335 27 M0 27 M27.000002 0 L27.000002 1.339601 L308 1.339601 L308 0 L308 -1.339601 L27.000002 -1.339601 L27.000002 0 Z M335 27 M308 54 L308 52.6604 L27.00001 52.6604 L27.00001 54 L27.00001 55.3396 L308 55.3396 L308 54 Z M0 27 M27.00001 54 L27.00001 52.6604 C12.828161 52.6604 1.339601 41.171848 1.339601 27 L0 27 L-1.339601 27 C-1.339601 42.651531 11.34848 55.3396 27.00001 55.3396 L27.00001 54 Z M335 27 L333.6604 27 C333.6604 41.171848 322.171844 52.6604 308 52.6604 L308 54 L308 55.3396 C323.65152 55.3396 336.3396 42.651531 336.3396 27 L335 27 Z M308 0 L308 1.339601 C322.171844 1.339601 333.6604 12.828153 333.6604 27 L335 27 L336.3396 27 C336.3396 11.34847 323.65152 -1.339601 308 -1.339601 L308 0 Z M27.000002 0 L27.000002 -1.339601 C11.348473 -1.339601 -1.339601 11.34847 -1.339601 27 L0 27 L1.339601 27 C1.339601 12.828153 12.828154 1.339601 27.000002 1.339601 L27.000002 0 Z",
        "sourceNodeId": "270:26530",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 4.663327 L0.75 4.663327 L0.75 4.663147 L0 4.663327 Z M0.413314 3.772573 L0.897451 4.345407 L0.901361 4.342056 L0.413314 3.772573 Z M4.49399 0.275434 L4.009854 -0.2974 L4.005944 -0.294049 L4.49399 0.275434 Z M5.246584 0 L5.246584 -0.75 L5.246584 0 Z M5.999177 0.275434 L6.487236 -0.294062 L6.483302 -0.297386 L5.999177 0.275434 Z M10.079853 3.772573 L9.591795 4.34207 L9.595729 4.345394 L10.079853 3.772573 Z M10.493168 4.663327 L9.743168 4.663147 L9.743168 4.663327 L10.493168 4.663327 Z M0 9.909911 L-0.75 9.909911 L0 9.909911 Z M0 4.663327 L0.75 4.663147 C0.749986 4.602647 0.76317 4.542871 0.788635 4.487991 L0.108306 4.172315 L-0.572024 3.856638 C-0.689329 4.109448 -0.750067 4.384807 -0.75 4.663507 L0 4.663327 Z M0.108306 4.172315 L0.788635 4.487991 C0.8141 4.433111 0.851231 4.384447 0.897439 4.345394 L0.413314 3.772573 L-0.070811 3.199753 C-0.28367 3.379654 -0.454719 3.603828 -0.572024 3.856638 L0.108306 4.172315 Z M0.413314 3.772573 L0.901361 4.342056 L4.982037 0.844916 L4.49399 0.275434 L4.005944 -0.294049 L-0.074732 3.203091 L0.413314 3.772573 Z M4.49399 0.275434 L4.978115 0.848254 C5.053184 0.784809 5.148296 0.75 5.246584 0.75 L5.246584 0 L5.246584 -0.75 C4.793813 -0.75 4.355673 -0.58965 4.009865 -0.297386 L4.49399 0.275434 Z M5.246584 0 L5.246584 0.75 C5.344872 0.75 5.439984 0.784809 5.515052 0.848254 L5.999177 0.275434 L6.483302 -0.297386 C6.137494 -0.58965 5.699354 -0.75 5.246584 -0.75 L5.246584 0 Z M5.999177 0.275434 L5.511131 0.844916 L9.591806 4.342056 L10.079853 3.772573 L10.5679 3.203091 L6.487224 -0.294049 L5.999177 0.275434 Z M10.079853 3.772573 L9.595729 4.345394 C9.641936 4.384447 9.679068 4.433111 9.704533 4.487991 L10.384862 4.172315 L11.065192 3.856638 C10.947886 3.603828 10.776838 3.379654 10.563978 3.199753 L10.079853 3.772573 Z M10.384862 4.172315 L9.704533 4.487991 C9.729997 4.542871 9.743182 4.602646 9.743168 4.663147 L10.493168 4.663327 L11.243168 4.663507 C11.243235 4.384808 11.182497 4.109449 11.065192 3.856638 L10.384862 4.172315 Z M10.493168 4.663327 L9.743168 4.663327 L9.743168 9.909911 L10.493168 9.909911 L11.243168 9.909911 L11.243168 4.663327 L10.493168 4.663327 Z M10.493168 9.909911 L9.743168 9.909911 C9.743168 10.020216 9.699349 10.126004 9.621351 10.204002 L10.151681 10.734332 L10.682011 11.264662 C11.041313 10.90536 11.243168 10.418042 11.243168 9.909911 L10.493168 9.909911 Z M10.151681 10.734332 L9.621351 10.204002 C9.543353 10.282001 9.437565 10.325819 9.32726 10.325819 L9.32726 11.075819 L9.32726 11.825819 C9.835391 11.825819 10.322709 11.623964 10.682011 11.264662 L10.151681 10.734332 Z M9.32726 11.075819 L9.32726 10.325819 L1.165908 10.325819 L1.165908 11.075819 L1.165908 11.825819 L9.32726 11.825819 L9.32726 11.075819 Z M1.165908 11.075819 L1.165908 10.325819 C1.055602 10.325819 0.949815 10.282001 0.871817 10.204002 L0.341486 10.734332 L-0.188844 11.264662 C0.170458 11.623964 0.657777 11.825819 1.165908 11.825819 L1.165908 11.075819 Z M0.341486 10.734332 L0.871817 10.204002 C0.793819 10.126004 0.75 10.020217 0.75 9.909911 L0 9.909911 L-0.75 9.909911 C-0.75 10.418041 -0.548146 10.90536 -0.188844 11.264662 L0.341486 10.734332 Z M0 9.909911 L0.75 9.909911 L0.75 4.663327 L0 4.663327 L-0.75 4.663327 L-0.75 9.909911 L0 9.909911 Z",
        "sourceNodeId": "270:26536",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 52.780492 13.370568)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M3.497723 5.246584 L4.247723 5.246584 L4.247723 0.582954 L3.497723 0.582954 L2.747723 0.582954 L2.747723 5.246584 L3.497723 5.246584 Z M3.497723 0.582954 L4.247723 0.582954 C4.247723 0.229432 4.107287 -0.10961 3.85731 -0.359587 L3.32698 0.170743 L2.79665 0.701073 C2.765323 0.669747 2.747723 0.627258 2.747723 0.582954 L3.497723 0.582954 Z M3.32698 0.170743 L3.85731 -0.359587 C3.607333 -0.609564 3.268291 -0.75 2.914769 -0.75 L2.914769 0 L2.914769 0.75 C2.870466 0.75 2.827977 0.7324 2.79665 0.701073 L3.32698 0.170743 Z M2.914769 0 L2.914769 -0.75 L0.582954 -0.75 L0.582954 0 L0.582954 0.75 L2.914769 0.75 L2.914769 0 Z M0.582954 0 L0.582954 -0.75 C0.229432 -0.75 -0.10961 -0.609564 -0.359587 -0.359587 L0.170743 0.170743 L0.701073 0.701073 C0.669747 0.7324 0.627258 0.75 0.582954 0.75 L0.582954 0 Z M0.170743 0.170743 L-0.359587 -0.359587 C-0.609564 -0.10961 -0.75 0.229432 -0.75 0.582954 L0 0.582954 L0.75 0.582954 C0.75 0.627258 0.7324 0.669747 0.701073 0.701073 L0.170743 0.170743 Z M0 0.582954 L-0.75 0.582954 L-0.75 5.246584 L0 5.246584 L0.75 5.246584 L0.75 0.582954 L0 0.582954 Z",
        "sourceNodeId": "270:26535",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 56.278173 19.20006)"
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
    "sourceClipsContent": false,
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
    ],
    "surfaceEffects": [
      {
        "blendMode": "NORMAL",
        "color": "#BABABA",
        "offset": {
          "x": 0,
          "y": 1.786134
        },
        "opacity": 0.25,
        "radius": 2.679201,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 1.786134123802185
          },
          "radius": 2.679201364517212,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.72998046875,
            "g": 0.72998046875,
            "b": 0.72998046875,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.72998046875,
            "c1": 0.72998046875,
            "c2": 0.72998046875,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.72998,
          "g": 0.72998,
          "r": 0.72998
        },
        "sourceNodeId": "270:26530",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
      },
      {
        "bevelSize": 0.446534,
        "blendMode": "NORMAL",
        "clipToShape": false,
        "color": "#000000",
        "chromaticAberration": 0.31,
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 1.786134
        },
        "opacity": 0.15,
        "radius": 1.786134,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "GLASS",
          "offset": {
            "x": 0,
            "y": 1.786134123802185
          },
          "radius": 1.786134123802185,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 3832,
          "clipToShape": false,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448,
          "refractionRadius": 8.037603378295898,
          "specularAngle": -45,
          "specularIntensity": 0.800000011920929,
          "bevelSize": 0.44653353095054626,
          "chromaticAberration": 0.3100000023841858,
          "reflectionDistance": 0,
          "refractionIntensity": 0.7400000095367432
        },
        "rawType": "GLASS",
        "reflectionDistance": 0,
        "refractionIntensity": 0.74,
        "refractionRadius": 8.037603,
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 3832,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "270:26530",
        "spread": 0,
        "specularAngle": -45,
        "specularIntensity": 0.8,
        "type": "GLASS",
        "visible": true
      }
    ],
    "surfaceFills": [
      {
        "color": "#FFFFFF",
        "opacity": 0.7,
        "type": "SOLID",
        "variableIds": []
      }
    ],
    "surfaceNodeId": "270:26530",
    "surfaceStrokes": [
      {
        "color": "#FFFFFF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      }
    ]
  },
  "glassCard": {
    "borderWidths": {
      "bottom": 1,
      "left": 1,
      "right": 1,
      "top": 1
    },
    "componentValues": [],
    "cornerRadii": {
      "bottomLeft": 24,
      "bottomRight": 24,
      "topLeft": 24,
      "topRight": 24
    },
    "derivedValues": [],
    "effects": [
      {
        "blendMode": "NORMAL",
        "color": "#1F2687",
        "offset": {
          "x": 0,
          "y": 8
        },
        "opacity": 0.07,
        "radius": 32,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.12156862765550613,
            "c1": 0.14901961386203766,
            "c2": 0.529411792755127,
            "c3": 0.07000000029802322
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 8
          },
          "radius": 32,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.12156862765550613,
            "g": 0.14901961386203766,
            "b": 0.529411792755127,
            "a": 0.07000000029802322
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.12156862765550613,
            "c1": 0.14901961386203766,
            "c2": 0.529411792755127,
            "c3": 0.07000000029802322
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.07,
          "b": 0.529412,
          "g": 0.14902,
          "r": 0.121569
        },
        "sourceNodeId": "825:6570",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "blurOpType": "NORMAL",
        "color": "#000000",
        "offset": {
          "x": 0,
          "y": 0
        },
        "opacity": 1,
        "radius": 16,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 1
          }
        },
        "rawPayload": {
          "type": "BACKGROUND_BLUR",
          "offset": {
            "x": 0,
            "y": 0
          },
          "radius": 16,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": true,
          "blurOpType": "NORMAL",
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 1
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 1
          }
        },
        "rawType": "BACKGROUND_BLUR",
        "showShadowBehindNode": true,
        "sourceColor": {
          "a": 1,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "825:6570",
        "spread": 0,
        "type": "BACKGROUND_BLUR",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "blurOpType": "NORMAL",
        "color": "#000000",
        "offset": {
          "x": 0,
          "y": 0
        },
        "opacity": 1,
        "radius": 64,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 1
          }
        },
        "rawPayload": {
          "type": "FOREGROUND_BLUR",
          "offset": {
            "x": 0,
            "y": 0
          },
          "radius": 64,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": true,
          "blurOpType": "NORMAL",
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 1
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 1
          }
        },
        "rawType": "FOREGROUND_BLUR",
        "showShadowBehindNode": true,
        "sourceColor": {
          "a": 1,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "825:6571",
        "spread": 0,
        "type": "FOREGROUND_BLUR",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#BDBDBD",
        "offset": {
          "x": 0.584624,
          "y": 0.584624
        },
        "opacity": 0.25,
        "radius": 0.584624,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.740159273147583,
            "c1": 0.740159273147583,
            "c2": 0.740159273147583,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0.5846242308616638,
            "y": 0.5846242308616638
          },
          "radius": 0.5846242308616638,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.740159273147583,
            "g": 0.740159273147583,
            "b": 0.740159273147583,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.740159273147583,
            "c1": 0.740159273147583,
            "c2": 0.740159273147583,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.740159,
          "g": 0.740159,
          "r": 0.740159
        },
        "sourceNodeId": "825:6589",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#FBB8FF",
        "offset": {
          "x": 1.502452,
          "y": 1.502452
        },
        "opacity": 0.5,
        "radius": 6.009809,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.9861647486686707,
            "c1": 0.7232947945594788,
            "c2": 1,
            "c3": 0.5
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 1.5024521350860596,
            "y": 1.5024521350860596
          },
          "radius": 6.009808540344238,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.9861647486686707,
            "g": 0.7232947945594788,
            "b": 1,
            "a": 0.5
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.9861647486686707,
            "c1": 0.7232947945594788,
            "c2": 1,
            "c3": 0.5
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.5,
          "b": 1,
          "g": 0.723295,
          "r": 0.986165
        },
        "sourceNodeId": "825:6590",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#FCCCFF",
        "offset": {
          "x": -0.584624,
          "y": -0.584624
        },
        "opacity": 0.25,
        "radius": 4.063138,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.9865372180938721,
            "c1": 0.7980581521987915,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": -0.5846242308616638,
            "y": -0.5846242308616638
          },
          "radius": 4.063138484954834,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.9865372180938721,
            "g": 0.7980581521987915,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.9865372180938721,
            "c1": 0.7980581521987915,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 0.798058,
          "r": 0.986537
        },
        "sourceNodeId": "825:6590",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#FFBB7B",
        "offset": {
          "x": -1.529694,
          "y": -0.382424
        },
        "opacity": 0.3,
        "radius": 3.059388,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 0.7332929372787476,
            "c2": 0.48379281163215637,
            "c3": 0.30000001192092896
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": -1.5296941995620728,
            "y": -0.3824235498905182
          },
          "radius": 3.0593883991241455,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 1,
            "g": 0.7332929372787476,
            "b": 0.48379281163215637,
            "a": 0.30000001192092896
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 0.7332929372787476,
            "c2": 0.48379281163215637,
            "c3": 0.30000001192092896
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.3,
          "b": 0.483793,
          "g": 0.733293,
          "r": 1
        },
        "sourceNodeId": "825:6592",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#FFFFFF",
        "offset": {
          "x": 0,
          "y": 0
        },
        "opacity": 1,
        "radius": 3.824236,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 1
          }
        },
        "rawPayload": {
          "type": "INNER_SHADOW",
          "offset": {
            "x": 0,
            "y": 0
          },
          "radius": 3.8242359161376953,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 1
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 1
          }
        },
        "rawType": "INNER_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 1,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "sourceNodeId": "825:6598",
        "spread": 0,
        "type": "INNER_SHADOW",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#FFFFFF",
        "offset": {
          "x": 0,
          "y": 0
        },
        "opacity": 1,
        "radius": 3.824236,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 1
          }
        },
        "rawPayload": {
          "type": "INNER_SHADOW",
          "offset": {
            "x": 0,
            "y": 0
          },
          "radius": 3.8242359161376953,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 1
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 1
          }
        },
        "rawType": "INNER_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 1,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "sourceNodeId": "825:6599",
        "spread": 0,
        "type": "INNER_SHADOW",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#FFFFFF",
        "offset": {
          "x": 0,
          "y": 0
        },
        "opacity": 1,
        "radius": 3.059389,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 1
          }
        },
        "rawPayload": {
          "type": "INNER_SHADOW",
          "offset": {
            "x": 0,
            "y": 0
          },
          "radius": 3.0593886375427246,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 1
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 1
          }
        },
        "rawType": "INNER_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 1,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "sourceNodeId": "825:6593",
        "spread": 0,
        "type": "INNER_SHADOW",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#000000",
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 4
        },
        "opacity": 0.15,
        "radius": 2.294541,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "FOREGROUND_BLUR",
          "offset": {
            "x": 0,
            "y": 4
          },
          "radius": 2.294541358947754,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 9231,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448
        },
        "rawType": "FOREGROUND_BLUR",
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 9231,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "825:6600",
        "spread": 0,
        "type": "FOREGROUND_BLUR",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#000000",
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 4
        },
        "opacity": 0.15,
        "radius": 6.118777,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "FOREGROUND_BLUR",
          "offset": {
            "x": 0,
            "y": 4
          },
          "radius": 6.118777275085449,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 8172,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448
        },
        "rawType": "FOREGROUND_BLUR",
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 8172,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "825:6597",
        "spread": 0,
        "type": "FOREGROUND_BLUR",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#FFFFFF",
        "offset": {
          "x": 0,
          "y": 0
        },
        "opacity": 1,
        "radius": 4.170177,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 1
          }
        },
        "rawPayload": {
          "type": "INNER_SHADOW",
          "offset": {
            "x": 0,
            "y": 0
          },
          "radius": 4.170177459716797,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 1
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 1
          }
        },
        "rawType": "INNER_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 1,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "sourceNodeId": "825:6594",
        "spread": 0,
        "type": "INNER_SHADOW",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#000000",
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 4
        },
        "opacity": 0.15,
        "radius": 6.118777,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "FOREGROUND_BLUR",
          "offset": {
            "x": 0,
            "y": 4
          },
          "radius": 6.118777275085449,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 8172,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448
        },
        "rawType": "FOREGROUND_BLUR",
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 8172,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "825:6596",
        "spread": 0,
        "type": "FOREGROUND_BLUR",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#000000",
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 4
        },
        "opacity": 0.15,
        "radius": 6.118777,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "FOREGROUND_BLUR",
          "offset": {
            "x": 0,
            "y": 4
          },
          "radius": 6.118777275085449,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 8172,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448
        },
        "rawType": "FOREGROUND_BLUR",
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 8172,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "825:6595",
        "spread": 0,
        "type": "FOREGROUND_BLUR",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#BDBDBD",
        "offset": {
          "x": 0.547619,
          "y": 0.547619
        },
        "opacity": 0.25,
        "radius": 0.547619,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.740159273147583,
            "c1": 0.740159273147583,
            "c2": 0.740159273147583,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0.5476185083389282,
            "y": 0.5476185083389282
          },
          "radius": 0.5476185083389282,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.740159273147583,
            "g": 0.740159273147583,
            "b": 0.740159273147583,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.740159273147583,
            "c1": 0.740159273147583,
            "c2": 0.740159273147583,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0.740159,
          "g": 0.740159,
          "r": 0.740159
        },
        "sourceNodeId": "825:6607",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#FBB8FF",
        "offset": {
          "x": 1.407349,
          "y": 1.407349
        },
        "opacity": 0.5,
        "radius": 5.629398,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.9861647486686707,
            "c1": 0.7232947945594788,
            "c2": 1,
            "c3": 0.5
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 1.4073494672775269,
            "y": 1.4073494672775269
          },
          "radius": 5.629397869110107,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.9861647486686707,
            "g": 0.7232947945594788,
            "b": 1,
            "a": 0.5
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.9861647486686707,
            "c1": 0.7232947945594788,
            "c2": 1,
            "c3": 0.5
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.5,
          "b": 1,
          "g": 0.723295,
          "r": 0.986165
        },
        "sourceNodeId": "825:6608",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#FCCCFF",
        "offset": {
          "x": -0.547619,
          "y": -0.547619
        },
        "opacity": 0.25,
        "radius": 3.805948,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.9865372180938721,
            "c1": 0.7980581521987915,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": -0.5476185083389282,
            "y": -0.5476185083389282
          },
          "radius": 3.805948495864868,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.9865372180938721,
            "g": 0.7980581521987915,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.9865372180938721,
            "c1": 0.7980581521987915,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 0.798058,
          "r": 0.986537
        },
        "sourceNodeId": "825:6608",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#59A4FF",
        "offset": {
          "x": -1.384791,
          "y": -0.346198
        },
        "opacity": 0.25,
        "radius": 2.769582,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.34990984201431274,
            "c1": 0.6424503922462463,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": -1.3847908973693848,
            "y": -0.3461977243423462
          },
          "radius": 2.7695817947387695,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.34990984201431274,
            "g": 0.6424503922462463,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.34990984201431274,
            "c1": 0.6424503922462463,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 0.64245,
          "r": 0.34991
        },
        "sourceNodeId": "825:6610",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#FFFFFF",
        "offset": {
          "x": 0,
          "y": 0
        },
        "opacity": 1,
        "radius": 2.769581,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 1
          }
        },
        "rawPayload": {
          "type": "INNER_SHADOW",
          "offset": {
            "x": 0,
            "y": 0
          },
          "radius": 2.769580602645874,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 1
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 1
          }
        },
        "rawType": "INNER_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 1,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "sourceNodeId": "825:6611",
        "spread": 0,
        "type": "INNER_SHADOW",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#FFFFFF",
        "offset": {
          "x": 0,
          "y": 0
        },
        "opacity": 1,
        "radius": 3.461976,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 1
          }
        },
        "rawPayload": {
          "type": "INNER_SHADOW",
          "offset": {
            "x": 0,
            "y": 0
          },
          "radius": 3.4619760513305664,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 1
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 1
          }
        },
        "rawType": "INNER_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 1,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "sourceNodeId": "825:6617",
        "spread": 0,
        "type": "INNER_SHADOW",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#FFFFFF",
        "offset": {
          "x": 0,
          "y": 0
        },
        "opacity": 1,
        "radius": 3.775148,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 1
          }
        },
        "rawPayload": {
          "type": "INNER_SHADOW",
          "offset": {
            "x": 0,
            "y": 0
          },
          "radius": 3.775148391723633,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 1
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 1
          }
        },
        "rawType": "INNER_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 1,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "sourceNodeId": "825:6612",
        "spread": 0,
        "type": "INNER_SHADOW",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#000000",
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 4
        },
        "opacity": 0.15,
        "radius": 2.077186,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "FOREGROUND_BLUR",
          "offset": {
            "x": 0,
            "y": 4
          },
          "radius": 2.077185869216919,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 9231,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448
        },
        "rawType": "FOREGROUND_BLUR",
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 9231,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "825:6618",
        "spread": 0,
        "type": "FOREGROUND_BLUR",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#FFFFFF",
        "offset": {
          "x": 0,
          "y": 0
        },
        "opacity": 1,
        "radius": 3.461976,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 1
          }
        },
        "rawPayload": {
          "type": "INNER_SHADOW",
          "offset": {
            "x": 0,
            "y": 0
          },
          "radius": 3.4619760513305664,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 1
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 1
          }
        },
        "rawType": "INNER_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 1,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "sourceNodeId": "825:6616",
        "spread": 0,
        "type": "INNER_SHADOW",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#000000",
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 4
        },
        "opacity": 0.15,
        "radius": 5.539163,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "FOREGROUND_BLUR",
          "offset": {
            "x": 0,
            "y": 4
          },
          "radius": 5.539163112640381,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 8172,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448
        },
        "rawType": "FOREGROUND_BLUR",
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 8172,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "825:6613",
        "spread": 0,
        "type": "FOREGROUND_BLUR",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#000000",
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 4
        },
        "opacity": 0.15,
        "radius": 5.539163,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "FOREGROUND_BLUR",
          "offset": {
            "x": 0,
            "y": 4
          },
          "radius": 5.539163112640381,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 8172,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448
        },
        "rawType": "FOREGROUND_BLUR",
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 8172,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "825:6615",
        "spread": 0,
        "type": "FOREGROUND_BLUR",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#000000",
        "offset": {
          "x": 0,
          "y": 4
        },
        "opacity": 0.25,
        "radius": 1.783959,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "FOREGROUND_BLUR",
          "offset": {
            "x": 0,
            "y": 4
          },
          "radius": 1.7839587926864624,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          }
        },
        "rawType": "FOREGROUND_BLUR",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "825:6623",
        "spread": 0,
        "type": "FOREGROUND_BLUR",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "color": "#000000",
        "density": 1,
        "noiseSize": {
          "x": 0.5,
          "y": 0.5
        },
        "noiseType": "MONOTONE",
        "offset": {
          "x": 0,
          "y": 4
        },
        "opacity": 0.15,
        "radius": 5.539163,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          }
        },
        "rawPayload": {
          "type": "FOREGROUND_BLUR",
          "offset": {
            "x": 0,
            "y": 4
          },
          "radius": 5.539163112640381,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 0.25
          },
          "secondaryColor": {
            "r": 1,
            "g": 1,
            "b": 1,
            "a": 0.25
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 0.25
          },
          "secondaryAuthoredColor": {
            "space": "DEFAULT",
            "c0": 1,
            "c1": 1,
            "c2": 1,
            "c3": 0.25
          },
          "noiseSize": {
            "x": 0.5,
            "y": 0.5
          },
          "seed": 8172,
          "density": 1,
          "noiseType": "MONOTONE",
          "opacity": 0.15000000596046448
        },
        "rawType": "FOREGROUND_BLUR",
        "secondaryColor": "#FFFFFF",
        "secondaryOpacity": 0.25,
        "seed": 8172,
        "secondarySourceColor": {
          "a": 0.25,
          "b": 1,
          "g": 1,
          "r": 1
        },
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.25,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "825:6614",
        "spread": 0,
        "type": "FOREGROUND_BLUR",
        "visible": true
      }
    ],
    "fills": [
      {
        "color": "#191C1E",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#494553",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#64748B",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#6646C6",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#886CDB",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#886CDB",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#886CDB",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#886CDB",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#94ACF6",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#94ACF6",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#94ACF6",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#95ABF5",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#BC13FE",
        "opacity": 0.2,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#C05CF6",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": [
          "153:2325"
        ]
      },
      {
        "color": "#D0C7FE",
        "opacity": 0.001,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#D0C7FE",
        "opacity": 0.001,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#D0C7FE",
        "opacity": 0.001,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#D0C7FE",
        "opacity": 0.001,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#D5E1FF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#D5E1FF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#E0D4FF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#E0D4FF",
        "opacity": 1,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#EDAFF6",
        "opacity": 0.6,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#EDAFF6",
        "opacity": 0.6,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 0.6,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 0.6,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 0.65,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 0.8,
        "type": "SOLID",
        "variableIds": []
      },
      {
        "color": "#FFFFFF",
        "opacity": 0.8,
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
        "end": {
          "x": 0,
          "y": 0
        },
        "gradientStops": [
          {
            "color": "#A899F2",
            "opacity": 1,
            "position": 0,
            "variableIds": []
          },
          {
            "color": "#A5D8FF",
            "opacity": 1,
            "position": 1,
            "variableIds": []
          }
        ],
        "opacity": 1,
        "start": {
          "x": 0,
          "y": 1
        },
        "transform": "matrix(0 -1 0.920607 0 0 1)",
        "type": "GRADIENT_LINEAR",
        "variableIds": []
      },
      {
        "end": {
          "x": 0,
          "y": 0
        },
        "gradientStops": [
          {
            "color": "#A899F2",
            "opacity": 1,
            "position": 0,
            "variableIds": []
          },
          {
            "color": "#A5D8FF",
            "opacity": 1,
            "position": 1,
            "variableIds": []
          }
        ],
        "opacity": 1,
        "start": {
          "x": 0,
          "y": 1
        },
        "transform": "matrix(0 -1 0.920607 0 0 1)",
        "type": "GRADIENT_LINEAR",
        "variableIds": []
      },
      {
        "end": {
          "x": 0,
          "y": 0
        },
        "gradientStops": [
          {
            "color": "#C2B5FF",
            "opacity": 1,
            "position": 0,
            "variableIds": []
          },
          {
            "color": "#78F8FF",
            "opacity": 1,
            "position": 1,
            "variableIds": []
          }
        ],
        "opacity": 1,
        "start": {
          "x": 0,
          "y": 1
        },
        "transform": "matrix(0 -1 0.920607 0 0 1)",
        "type": "GRADIENT_LINEAR",
        "variableIds": []
      },
      {
        "end": {
          "x": 0,
          "y": 0
        },
        "gradientStops": [
          {
            "color": "#FFB5E3",
            "opacity": 1,
            "position": 0,
            "variableIds": []
          },
          {
            "color": "#FFDF78",
            "opacity": 1,
            "position": 1,
            "variableIds": []
          }
        ],
        "opacity": 1,
        "start": {
          "x": 0,
          "y": 1
        },
        "transform": "matrix(0 -1 0.920607 0 0 1)",
        "type": "GRADIENT_LINEAR",
        "variableIds": []
      },
      {
        "end": {
          "x": 0.150863,
          "y": -0.40305
        },
        "gradientStops": [
          {
            "color": "#FFFFFF",
            "opacity": 1,
            "position": 0,
            "variableIds": []
          },
          {
            "color": "#FFF0FD",
            "opacity": 1,
            "position": 1,
            "variableIds": []
          },
          {
            "color": "#FFF4FD",
            "opacity": 0.8,
            "position": 1,
            "variableIds": []
          }
        ],
        "opacity": 1,
        "start": {
          "x": -0.231922,
          "y": 0.637479
        },
        "transform": "matrix(0.382785 -1.04053 1.04053 0.382785 -0.231922 0.637479)",
        "type": "GRADIENT_LINEAR",
        "variableIds": []
      },
      {
        "end": {
          "x": 0.150863,
          "y": -0.40305
        },
        "gradientStops": [
          {
            "color": "#FFFFFF",
            "opacity": 1,
            "position": 0,
            "variableIds": []
          },
          {
            "color": "#FFF0FD",
            "opacity": 1,
            "position": 1,
            "variableIds": []
          },
          {
            "color": "#FFF4FD",
            "opacity": 0.8,
            "position": 1,
            "variableIds": []
          }
        ],
        "opacity": 1,
        "start": {
          "x": -0.231922,
          "y": 0.637479
        },
        "transform": "matrix(0.382785 -1.04053 1.04053 0.382785 -0.231922 0.637479)",
        "type": "GRADIENT_LINEAR",
        "variableIds": []
      },
      {
        "end": {
          "x": 1,
          "y": 0
        },
        "gradientStops": [
          {
            "color": "#7C62FF",
            "opacity": 1,
            "position": 0,
            "variableIds": [
              "106:76525"
            ]
          },
          {
            "color": "#C05CF6",
            "opacity": 1,
            "position": 1,
            "variableIds": [
              "153:2325"
            ]
          }
        ],
        "opacity": 1,
        "start": {
          "x": 0,
          "y": 0
        },
        "type": "GRADIENT_LINEAR",
        "variableIds": [
          "106:76525",
          "153:2325"
        ]
      },
      {
        "opacity": 1,
        "transform": "matrix(2.160336 0 0 1 -0.580168 0)",
        "type": "IMAGE",
        "variableIds": []
      },
      {
        "opacity": 1,
        "type": "IMAGE",
        "variableIds": []
      },
      {
        "opacity": 1,
        "type": "IMAGE",
        "variableIds": []
      }
    ],
    "geometry": [
      {
        "fill": "#886CDB",
        "fillRule": "evenodd",
        "opacity": 1,
        "paint": {
          "color": "#886CDB",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.058403 0.242163 C0.183394 0.014673 0.468438 -0.066958 0.695122 0.059546 L2.213676 0.907202 C2.243291 0.923729 2.270177 0.943304 2.294731 0.964819 C2.404783 1.026374 2.490325 1.131169 2.52227 1.263647 C2.583082 1.516465 2.427205 1.772213 2.174614 1.83396 L0.640434 2.20896 C0.387842 2.270706 0.133864 2.115098 0.073051 1.86228 C0.012478 1.609641 0.167372 1.354749 0.419731 1.292944 L0.805473 1.198217 L0.241997 0.883764 C0.015445 0.757154 -0.06649 0.469706 0.058403 0.242163 Z",
        "sourceNodeId": "825:6619",
        "transform": "matrix(0.979301 -0.218997 0.217237 0.971431 49.760101 163.21853)"
      },
      {
        "fill": "#886CDB",
        "fillRule": "nonzero",
        "opacity": 0.5,
        "paint": {
          "color": "#886CDB",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 0.47016 C0 0.210498 0.210498 0 0.47016 0 L2.209709 0 C2.469372 0 2.679869 0.210498 2.679869 0.47016 L2.679869 0.47016 C2.679869 0.729823 2.469371 0.940321 2.209709 0.940321 L0.47016 0.940321 C0.210498 0.940321 0 0.729823 0 0.47016 L0 0.47016 Z",
        "sourceNodeId": "825:6620",
        "transform": "matrix(0.961015 0.282157 -0.280763 0.956961 50.001851 162.991186)"
      },
      {
        "fill": "#886CDB",
        "fillRule": "nonzero",
        "opacity": 0.5,
        "paint": {
          "color": "#886CDB",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 0.470825 C0 0.210796 0.210795 0 0.470824 0 L2.050779 0 C2.310809 0 2.521603 0.210796 2.521603 0.470825 L2.521603 0.470825 C2.521603 0.730854 2.310808 0.941649 2.050779 0.941649 L0.470824 0.941649 C0.210795 0.941649 0 0.730854 0 0.470825 L0 0.470825 Z",
        "sourceNodeId": "825:6621",
        "transform": "matrix(-0.899705 0.443409 0.44024 0.893276 52.297611 163.473403)"
      },
      {
        "fill": "#886CDB",
        "fillRule": "nonzero",
        "opacity": 0.8,
        "paint": {
          "color": "#886CDB",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 0.618381 C0 0.276859 0.276859 0 0.618382 0 L0.618382 0 C0.959904 0 1.236763 0.276859 1.236763 0.618382 L1.236763 1.334705 C1.236763 1.676227 0.959904 1.953086 0.618382 1.953086 L0.618382 1.953086 C0.276859 1.953086 0 1.676227 0 1.334704 L0 0.618381 Z",
        "sourceNodeId": "825:6622",
        "transform": "matrix(0.982291 -0.202428 0.201023 0.975471 53.959002 162.610063)"
      },
      {
        "fill": "#94ACF6",
        "fillRule": "nonzero",
        "opacity": 0.7,
        "paint": {
          "color": "#94ACF6",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.89198 0.44599 C0.89198 0.692303 0.692303 0.891979 0.44599 0.891979 C0.199676 0.891979 0 0.692303 0 0.44599 C0 0.199676 0.199676 0 0.44599 0 C0.692303 0 0.89198 0.199676 0.89198 0.44599 Z",
        "sourceNodeId": "825:6623",
        "transform": "matrix(1 0 0 1 43.895338 155.857532)"
      },
      {
        "fill": "#94ACF6",
        "fillRule": "nonzero",
        "opacity": 0.8,
        "paint": {
          "color": "#94ACF6",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 0.517802 C0 0.231828 0.231828 0 0.517801 0 L2.27651 0 C2.562483 0 2.794311 0.231828 2.794311 0.517802 L2.794311 0.517802 C2.794311 0.803775 2.562483 1.035603 2.276509 1.035603 L0.517801 1.035603 C0.231827 1.035603 0 0.803775 0 0.517802 L0 0.517802 Z",
        "sourceNodeId": "825:6603",
        "transform": "matrix(0.936032 0.351916 -0.351916 0.936032 37.673203 164.027523)"
      },
      {
        "fill": "#94ACF6",
        "fillRule": "nonzero",
        "opacity": 0.8,
        "paint": {
          "color": "#94ACF6",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 0.517857 C0 0.231852 0.231852 0 0.517857 0 L2.447279 0 C2.733283 0 2.965136 0.231852 2.965136 0.517857 L2.965136 0.517857 C2.965136 0.803861 2.733284 1.035713 2.447279 1.035713 L0.517857 1.035713 C0.231853 1.035713 0 0.803861 0 0.517857 L0 0.517857 Z",
        "sourceNodeId": "825:6602",
        "transform": "matrix(0.966182 -0.257862 0.257862 0.966182 32.418901 164.539934)"
      },
      {
        "fill": "#95ABF5",
        "fillRule": "evenodd",
        "opacity": 1,
        "paint": {
          "color": "#95ABF5",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M4.817415 0.412184 C4.924284 0.147066 5.226017 0.01836 5.491243 0.125074 L7.281282 0.845777 C7.546348 0.952674 7.675096 1.254404 7.568392 1.519605 C7.461618 1.784716 7.159762 1.913216 6.894564 1.806715 L5.104525 1.086012 C4.839192 0.979255 4.710659 0.677516 4.817415 0.412184 Z M2.104525 0.014723 C2.382444 -0.052669 2.663109 0.117662 2.730501 0.395582 C2.797763 0.673436 2.626519 0.953206 2.348665 1.020582 L0.639681 1.435621 C0.361831 1.502874 0.082055 1.331634 0.014681 1.053785 C-0.05261 0.775978 0.117788 0.496257 0.39554 0.428785 L2.104525 0.014723 Z",
        "sourceNodeId": "825:6601",
        "transform": "matrix(-0.992601 -0.121422 -0.121422 0.992601 40.248918 164.451245)"
      },
      {
        "fill": "#BC13FE",
        "fillRule": "nonzero",
        "opacity": 0.2,
        "paint": {
          "color": "#BC13FE",
          "opacity": 0.2,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 64 C0 28.653776 28.653776 0 64 0 L64 0 C99.346222 0 128 28.653776 128 64 L128 64 C128 99.346222 99.346222 128 64 128 L64 128 C28.653776 128 0 99.346222 0 64 L0 64 Z",
        "sourceNodeId": "825:6571",
        "transform": "matrix(1 0 0 1 376.549988 -63)"
      },
      {
        "fill": "#C05CF6",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#C05CF6",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": [
            "153:2325"
          ]
        },
        "path": "M0 12 C0 5.372583 5.372583 0 12 0 L12 0 C18.627417 0 24 5.372583 24 12 L24 12 C24 18.627417 18.627417 24 12 24 L12 24 C5.372583 24 0 18.627417 0 12 L0 12 Z",
        "sourceNodeId": "825:6625",
        "transform": "matrix(1 0 0 1 57 151)"
      },
      {
        "fill": "#D0C7FE",
        "fillRule": "nonzero",
        "opacity": 0.0005,
        "paint": {
          "color": "#D0C7FE",
          "opacity": 0.001,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M2.687356 0.056852 C2.302185 0.277982 1.033849 3.354851 1.033849 3.354851 C0.323894 4.601456 0 7.155814 0 8.59287 C0 11.834505 3.648044 13.080112 8.034439 13.080113 C12.420839 13.080113 15.191437 11.942948 15.191438 8.701311 C15.191435 7.264255 14.133511 1.572036 12.973306 0.042553 C12.70294 -0.144159 12.222555 0.310816 11.836268 0.875449 L11.836263 0.875457 C11.456144 1.431073 11.065753 2.001704 10.755321 1.900986 C9.836197 1.602778 8.835165 1.472328 7.795031 1.472328 C6.909184 1.472328 6.006011 1.566949 5.145112 1.779236 C4.786552 1.867653 4.340128 1.36628 3.903639 0.876064 C3.451248 0.367985 3.009526 -0.128108 2.687356 0.056852 Z",
        "sourceNodeId": "825:6617",
        "transform": "matrix(0.982291 -0.202428 0.201023 0.975471 43.810081 158.232011)"
      },
      {
        "fill": "#D0C7FE",
        "fillRule": "nonzero",
        "opacity": 0.0005,
        "paint": {
          "color": "#D0C7FE",
          "opacity": 0.001,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M2.977263 0.062548 C2.550541 0.305832 1.145378 3.690964 1.145378 3.690964 C0.358836 5.062463 0 7.872734 0 9.453765 C0 13.02017 4.041588 14.390571 8.90118 14.390573 C13.760777 14.390573 16.830261 13.139478 16.830263 9.573071 C16.830259 7.992039 15.658208 1.729533 14.372842 0.046816 C14.073311 -0.158601 13.541102 0.341956 13.113144 0.963157 C12.692018 1.574442 12.259509 2.202249 11.915586 2.09144 C10.897308 1.763356 9.788286 1.619836 8.635945 1.619836 C7.654534 1.619837 6.653929 1.723937 5.700157 1.957492 C5.302917 2.054767 4.808333 1.503164 4.324756 0.963835 C3.823562 0.404852 3.334188 -0.140943 2.977263 0.062548 Z",
        "sourceNodeId": "825:6599",
        "transform": "matrix(-0.994498 -0.104756 -0.104756 0.994498 46.435427 157.346086)"
      },
      {
        "fill": "#D0C7FE",
        "fillRule": "nonzero",
        "opacity": 0.001,
        "paint": {
          "color": "#D0C7FE",
          "opacity": 0.001,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M2.687356 0.056852 C2.302185 0.277982 1.033849 3.354851 1.033849 3.354851 C0.323894 4.601456 0 7.155814 0 8.59287 C0 11.834505 3.648044 13.080112 8.034439 13.080113 C12.420839 13.080113 15.191437 11.942948 15.191438 8.701311 C15.191435 7.264255 14.133511 1.572036 12.973306 0.042553 C12.70294 -0.144159 12.222555 0.310816 11.836268 0.875449 L11.836263 0.875457 C11.456144 1.431073 11.065753 2.001704 10.755321 1.900986 C9.836197 1.602778 8.835165 1.472328 7.795031 1.472328 C6.909184 1.472328 6.006011 1.566949 5.145112 1.779236 C4.786552 1.867653 4.340128 1.36628 3.903639 0.876064 C3.451248 0.367985 3.009526 -0.128108 2.687356 0.056852 Z",
        "sourceNodeId": "825:6616",
        "transform": "matrix(0.982291 -0.202428 0.201023 0.975471 43.810081 158.232011)"
      },
      {
        "fill": "#D0C7FE",
        "fillRule": "nonzero",
        "opacity": 0.001,
        "paint": {
          "color": "#D0C7FE",
          "opacity": 0.001,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M2.977263 0.062548 C2.550541 0.305832 1.145378 3.690964 1.145378 3.690964 C0.358836 5.062463 0 7.872734 0 9.453765 C0 13.02017 4.041588 14.390571 8.90118 14.390573 C13.760777 14.390573 16.830261 13.139478 16.830263 9.573071 C16.830259 7.992039 15.658208 1.729533 14.372842 0.046816 C14.073311 -0.158601 13.541102 0.341956 13.113144 0.963157 C12.692018 1.574442 12.259509 2.202249 11.915586 2.09144 C10.897308 1.763356 9.788286 1.619836 8.635945 1.619836 C7.654534 1.619837 6.653929 1.723937 5.700157 1.957492 C5.302917 2.054767 4.808333 1.503164 4.324756 0.963835 C3.823562 0.404852 3.334188 -0.140943 2.977263 0.062548 Z",
        "sourceNodeId": "825:6598",
        "transform": "matrix(-0.994498 -0.104756 -0.104756 0.994498 46.435427 157.346086)"
      },
      {
        "fill": "#D5E1FF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#D5E1FF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M7.135913 3.567765 C7.135913 5.538187 5.538485 7.13553 3.567956 7.13553 C1.597429 7.13553 0 5.538187 0 3.567765 C0 1.597343 1.597429 0 3.567956 0 C5.538485 0 7.135913 1.597343 7.135913 3.567765 Z",
        "sourceNodeId": "825:6614",
        "transform": "matrix(0.994582 -0.098068 0.098073 0.994636 48.648966 156.184363)"
      },
      {
        "fill": "#D5E1FF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#D5E1FF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M7.877926 3.938963 C7.877926 6.114392 6.114392 7.877926 3.938963 7.877926 C1.763534 7.877926 0 6.114392 0 3.938963 C0 1.763534 1.763534 0 3.938963 0 C6.114392 0 7.877926 1.763534 7.877926 3.938963 Z",
        "sourceNodeId": "825:6596",
        "transform": "matrix(-1 0 0 1 40.894416 155.619442)"
      },
      {
        "fill": "#E0D4FF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#E0D4FF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M22.949196 11.474598 C22.949196 17.811844 17.811844 22.949196 11.474598 22.949196 C5.137352 22.949196 0 17.811844 0 11.474598 C0 5.137352 5.137352 0 11.474598 0 C17.811844 0 22.949196 5.137352 22.949196 11.474598 Z",
        "sourceNodeId": "825:6607",
        "transform": "matrix(1 0 0 1 41 151.550799)"
      },
      {
        "fill": "#E0D4FF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#E0D4FF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M24.5 12.25 C24.5 19.015488 19.015488 24.5 12.25 24.5 C5.484512 24.5 0 19.015488 0 12.25 C0 5.484512 5.484512 0 12.25 0 C19.015488 0 24.5 5.484512 24.5 12.25 Z",
        "sourceNodeId": "825:6589",
        "transform": "matrix(1 0 0 1 24.5 151.554122)"
      },
      {
        "fill": "#EDAFF6",
        "fillRule": "nonzero",
        "opacity": 0.6,
        "paint": {
          "color": "#EDAFF6",
          "opacity": 0.6,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M7.135913 3.567765 C7.135913 5.538187 5.538485 7.13553 3.567956 7.13553 C1.597429 7.13553 0 5.538187 0 3.567765 C0 1.597343 1.597429 0 3.567956 0 C5.538485 0 7.135913 1.597343 7.135913 3.567765 Z",
        "sourceNodeId": "825:6615",
        "transform": "matrix(0.994582 -0.098068 0.098073 0.994636 52.507542 155.803744)"
      },
      {
        "fill": "#EDAFF6",
        "fillRule": "nonzero",
        "opacity": 0.6,
        "paint": {
          "color": "#EDAFF6",
          "opacity": 0.6,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M7.877926 3.938963 C7.877926 6.114392 6.114392 7.877926 3.938963 7.877926 C1.763534 7.877926 0 6.114392 0 3.938963 C0 1.763534 1.763534 0 3.938963 0 C6.114392 0 7.877926 1.763534 7.877926 3.938963 Z",
        "sourceNodeId": "825:6597",
        "transform": "matrix(-1 0 0 1 36.611252 155.619442)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 0.4,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 0.4,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M24 0 L24 1 L417.549988 1 L417.549988 0 L417.549988 -1 L24 -1 L24 0 Z M441.549988 24 L440.549988 24 L440.549988 176.5 L441.549988 176.5 L442.549988 176.5 L442.549988 24 L441.549988 24 Z M417.549988 200.5 L417.549988 199.5 L24.000013 199.5 L24.000013 200.5 L24.000013 201.5 L417.549988 201.5 L417.549988 200.5 Z M0 176.5 L1 176.5 L1 23.999996 L0 23.999996 L-1 23.999996 L-1 176.5 L0 176.5 Z M24.000013 200.5 L24.000013 199.5 C11.297463 199.5 1 189.202545 1 176.5 L0 176.5 L-1 176.5 C-1 190.307114 10.192896 201.5 24.000013 201.5 L24.000013 200.5 Z M441.549988 176.5 L440.549988 176.5 C440.549988 189.202545 430.252533 199.5 417.549988 199.5 L417.549988 200.5 L417.549988 201.5 C431.357117 201.5 442.549988 190.307129 442.549988 176.5 L441.549988 176.5 Z M417.549988 0 L417.549988 1 C430.252533 1 440.549988 11.297451 440.549988 24 L441.549988 24 L442.549988 24 C442.549988 10.192881 431.357086 -1 417.549988 -1 L417.549988 0 Z M24 0 L24 -1 C10.192882 -1 -1 10.192878 -1 23.999996 L0 23.999996 L1 23.999996 C1 11.297448 11.297451 1 24 1 L24 0 Z",
        "sourceNodeId": "825:6570",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 0.6,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 0.6,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M7.135913 3.567765 C7.135913 5.538187 5.538485 7.13553 3.567956 7.13553 C1.597429 7.13553 0 5.538187 0 3.567765 C0 1.597343 1.597429 0 3.567956 0 C5.538485 0 7.135913 1.597343 7.135913 3.567765 Z",
        "sourceNodeId": "825:6613",
        "transform": "matrix(0.994582 -0.098068 0.098073 0.994636 42.879218 158.35378)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 0.6,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 0.6,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M7.877926 3.938963 C7.877926 6.114392 6.114392 7.877926 3.938963 7.877926 C1.763534 7.877926 0 6.114392 0 3.938963 C0 1.763534 1.763534 0 3.938963 0 C6.114392 0 7.877926 1.763534 7.877926 3.938963 Z",
        "sourceNodeId": "825:6595",
        "transform": "matrix(-1 0 0 1 47.472062 157.378386)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 0.65,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 0.65,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 23.999996 C0 10.745163 10.745167 0 24 0 L417.549988 0 C430.80481 0 441.549988 10.745166 441.549988 24 L441.549988 176.5 C441.549988 189.754837 430.80481 200.5 417.549988 200.5 L24.000013 200.5 C10.74518 200.5 0 189.754837 0 176.5 L0 23.999996 Z",
        "sourceNodeId": "825:6570"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 0.8,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 0.8,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M10.276405 2.75221 C10.276405 3.493861 6.979526 4.819948 5.145443 4.819948 C3.311361 4.819948 0 4.235198 0 3.493547 C0 2.751897 3.610616 0 5.444698 0 C7.27878 0 10.276405 2.01056 10.276405 2.75221 Z",
        "sourceNodeId": "825:6600",
        "transform": "matrix(-0.998078 -0.061968 -0.061968 0.998078 41.852793 167.393319)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 0.8,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 0.8,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M9.289066 2.498038 C9.289066 3.171196 6.308946 4.374816 4.651079 4.374816 C2.993212 4.374816 0 3.844069 0 3.170911 C0 2.497754 3.263714 0 4.921581 0 C6.579448 0 9.289066 1.824881 9.289066 2.498038 Z",
        "sourceNodeId": "825:6618",
        "transform": "matrix(0.988656 -0.159845 0.159189 0.984597 48.831245 166.876432)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 12 M24 12 M24 12 M0 12 M12 0 M24 12 M12 24 M0 12 M12 24 L12 23 C5.924868 23 1 18.075132 1 12 L0 12 L-1 12 C-1 19.179701 4.820299 25 12 25 L12 24 Z M24 12 L23 12 C23 18.075132 18.075132 23 12 23 L12 24 L12 25 C19.179701 25 25 19.179701 25 12 L24 12 Z M12 0 L12 1 C18.075132 1 23 5.924868 23 12 L24 12 L25 12 C25 4.820299 19.179701 -1 12 -1 L12 0 Z M12 0 L12 -1 C4.820299 -1 -1 4.820299 -1 12 L0 12 L1 12 C1 5.924868 5.924868 1 12 1 L12 0 Z",
        "sourceNodeId": "825:6587",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 25 151)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 12 M24 12 M24 12 M0 12 M12 0 M24 12 M12 24 M0 12 M12 24 L12 23 C5.924868 23 1 18.075132 1 12 L0 12 L-1 12 C-1 19.179701 4.820299 25 12 25 L12 24 Z M24 12 L23 12 C23 18.075132 18.075132 23 12 23 L12 24 L12 25 C19.179701 25 25 19.179701 25 12 L24 12 Z M12 0 L12 1 C18.075132 1 23 5.924868 23 12 L24 12 L25 12 C25 4.820299 19.179701 -1 12 -1 L12 0 Z M12 0 L12 -1 C4.820299 -1 -1 4.820299 -1 12 L0 12 L1 12 C1 5.924868 5.924868 1 12 1 L12 0 Z",
        "sourceNodeId": "825:6605",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 41 151)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 12 M24 12 M24 12 M0 12 M12 0 M24 12 M12 24 M0 12 M12 24 L12 23 C5.924868 23 1 18.075132 1 12 L0 12 L-1 12 C-1 19.179701 4.820299 25 12 25 L12 24 Z M24 12 L23 12 C23 18.075132 18.075132 23 12 23 L12 24 L12 25 C19.179701 25 25 19.179701 25 12 L24 12 Z M12 0 L12 1 C18.075132 1 23 5.924868 23 12 L24 12 L25 12 C25 4.820299 19.179701 -1 12 -1 L12 0 Z M12 0 L12 -1 C4.820299 -1 -1 4.820299 -1 12 L0 12 L1 12 C1 5.924868 5.924868 1 12 1 L12 0 Z",
        "sourceNodeId": "825:6625",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 57 151)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M2.333333 11.666667 L2.916667 7.583333 L0 7.583333 L5.25 0 L6.416667 0 L5.833333 4.666667 L9.333333 4.666667 L3.5 11.666667 L2.333333 11.666667 L2.333333 11.666667",
        "sourceNodeId": "825:6578",
        "transform": "matrix(1 0 0 1 32.333333 31.166667)"
      },
      {
        "fillRule": "nonzero",
        "opacity": 0.2,
        "paint": {
          "opacity": 1,
          "transform": "matrix(2.160336 0 0 1 -0.580168 0)",
          "type": "IMAGE",
          "variableIds": []
        },
        "path": "M0 0 L159.999924 0 L159.999924 159.999924 L0 159.999924 L0 0 Z",
        "sourceNodeId": "825:6573",
        "transform": "matrix(0.978148 0.207912 -0.207912 0.978148 342.880009 44.459999)"
      },
      {
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "end": {
            "x": 0,
            "y": 0
          },
          "gradientStops": [
            {
              "color": "#A899F2",
              "opacity": 1,
              "position": 0,
              "variableIds": []
            },
            {
              "color": "#A5D8FF",
              "opacity": 1,
              "position": 1,
              "variableIds": []
            }
          ],
          "opacity": 1,
          "start": {
            "x": 0,
            "y": 1
          },
          "transform": "matrix(0 -1 0.920607 0 0 1)",
          "type": "GRADIENT_LINEAR",
          "variableIds": []
        },
        "path": "M2.687356 0.056852 C2.302185 0.277982 1.033849 3.354851 1.033849 3.354851 C0.323894 4.601456 0 7.155814 0 8.59287 C0 11.834505 3.648044 13.080112 8.034439 13.080113 C12.420839 13.080113 15.191437 11.942948 15.191438 8.701311 C15.191435 7.264255 14.133511 1.572036 12.973306 0.042553 C12.70294 -0.144159 12.222555 0.310816 11.836268 0.875449 L11.836263 0.875457 C11.456144 1.431073 11.065753 2.001704 10.755321 1.900986 C9.836197 1.602778 8.835165 1.472328 7.795031 1.472328 C6.909184 1.472328 6.006011 1.566949 5.145112 1.779236 C4.786552 1.867653 4.340128 1.36628 3.903639 0.876064 C3.451248 0.367985 3.009526 -0.128108 2.687356 0.056852 Z",
        "sourceNodeId": "825:6612",
        "transform": "matrix(0.982291 -0.202428 0.201023 0.975471 43.810081 158.232011)"
      },
      {
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "end": {
            "x": 0,
            "y": 0
          },
          "gradientStops": [
            {
              "color": "#A899F2",
              "opacity": 1,
              "position": 0,
              "variableIds": []
            },
            {
              "color": "#A5D8FF",
              "opacity": 1,
              "position": 1,
              "variableIds": []
            }
          ],
          "opacity": 1,
          "start": {
            "x": 0,
            "y": 1
          },
          "transform": "matrix(0 -1 0.920607 0 0 1)",
          "type": "GRADIENT_LINEAR",
          "variableIds": []
        },
        "path": "M2.977263 0.062548 C2.550541 0.305832 1.145378 3.690964 1.145378 3.690964 C0.358836 5.062463 0 7.872734 0 9.453765 C0 13.02017 4.041588 14.390571 8.90118 14.390573 C13.760777 14.390573 16.830261 13.139478 16.830263 9.573071 C16.830259 7.992039 15.658208 1.729533 14.372842 0.046816 C14.073311 -0.158601 13.541102 0.341956 13.113144 0.963157 C12.692018 1.574442 12.259509 2.202249 11.915586 2.09144 C10.897308 1.763356 9.788286 1.619836 8.635945 1.619836 C7.654534 1.619837 6.653929 1.723937 5.700157 1.957492 C5.302917 2.054767 4.808333 1.503164 4.324756 0.963835 C3.823562 0.404852 3.334188 -0.140943 2.977263 0.062548 Z",
        "sourceNodeId": "825:6594",
        "transform": "matrix(-0.994498 -0.104756 -0.104756 0.994498 46.435427 157.346086)"
      },
      {
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "end": {
            "x": 0,
            "y": 0
          },
          "gradientStops": [
            {
              "color": "#C2B5FF",
              "opacity": 1,
              "position": 0,
              "variableIds": []
            },
            {
              "color": "#78F8FF",
              "opacity": 1,
              "position": 1,
              "variableIds": []
            }
          ],
          "opacity": 1,
          "start": {
            "x": 0,
            "y": 1
          },
          "transform": "matrix(0 -1 0.920607 0 0 1)",
          "type": "GRADIENT_LINEAR",
          "variableIds": []
        },
        "path": "M2.687356 0.056852 C2.302185 0.277982 1.033849 3.354851 1.033849 3.354851 C0.323894 4.601456 0 7.155814 0 8.59287 C0 11.834505 3.648044 13.080112 8.034439 13.080113 C12.420839 13.080113 15.191437 11.942948 15.191438 8.701311 C15.191435 7.264255 14.133511 1.572036 12.973306 0.042553 C12.70294 -0.144159 12.222555 0.310816 11.836268 0.875449 L11.836263 0.875457 C11.456144 1.431073 11.065753 2.001704 10.755321 1.900986 C9.836197 1.602778 8.835165 1.472328 7.795031 1.472328 C6.909184 1.472328 6.006011 1.566949 5.145112 1.779236 C4.786552 1.867653 4.340128 1.36628 3.903639 0.876064 C3.451248 0.367985 3.009526 -0.128108 2.687356 0.056852 Z",
        "sourceNodeId": "825:6611",
        "transform": "matrix(0.982291 -0.202428 0.201023 0.975471 43.810081 158.232011)"
      },
      {
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "end": {
            "x": 0,
            "y": 0
          },
          "gradientStops": [
            {
              "color": "#FFB5E3",
              "opacity": 1,
              "position": 0,
              "variableIds": []
            },
            {
              "color": "#FFDF78",
              "opacity": 1,
              "position": 1,
              "variableIds": []
            }
          ],
          "opacity": 1,
          "start": {
            "x": 0,
            "y": 1
          },
          "transform": "matrix(0 -1 0.920607 0 0 1)",
          "type": "GRADIENT_LINEAR",
          "variableIds": []
        },
        "path": "M2.977263 0.062548 C2.550541 0.305832 1.145378 3.690964 1.145378 3.690964 C0.358836 5.062463 0 7.872734 0 9.453765 C0 13.02017 4.041588 14.390571 8.90118 14.390573 C13.760777 14.390573 16.830261 13.139478 16.830263 9.573071 C16.830259 7.992039 15.658208 1.729533 14.372842 0.046816 C14.073311 -0.158601 13.541102 0.341956 13.113144 0.963157 C12.692018 1.574442 12.259509 2.202249 11.915586 2.09144 C10.897308 1.763356 9.788286 1.619836 8.635945 1.619836 C7.654534 1.619837 6.653929 1.723937 5.700157 1.957492 C5.302917 2.054767 4.808333 1.503164 4.324756 0.963835 C3.823562 0.404852 3.334188 -0.140943 2.977263 0.062548 Z",
        "sourceNodeId": "825:6593",
        "transform": "matrix(-0.994498 -0.104756 -0.104756 0.994498 46.435427 157.346086)"
      },
      {
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "end": {
            "x": 0,
            "y": 0
          },
          "gradientStops": [
            {
              "color": "#FFFFFF",
              "opacity": 1,
              "position": 0,
              "variableIds": []
            },
            {
              "color": "#F3B7FF",
              "opacity": 1,
              "position": 1,
              "variableIds": []
            }
          ],
          "opacity": 1,
          "start": {
            "x": 0,
            "y": 1
          },
          "transform": "matrix(0 -1 1 0 0 1)",
          "type": "GRADIENT_LINEAR",
          "variableIds": []
        },
        "path": "M22.949196 11.474598 L22.929066 11.474598 C22.929066 17.800726 17.800726 22.929066 11.474598 22.929066 L11.474598 22.949196 L11.474598 22.969326 C17.822962 22.969326 22.969326 17.822962 22.969326 11.474598 L22.949196 11.474598 Z M11.474598 22.949196 L11.474598 22.929066 C5.14847 22.929066 0.020131 17.800726 0.020131 11.474598 L0 11.474598 L-0.020131 11.474598 C-0.020131 17.822962 5.126235 22.969326 11.474598 22.969326 L11.474598 22.949196 Z M0 11.474598 L0.020131 11.474598 C0.020131 5.14847 5.14847 0.020131 11.474598 0.020131 L11.474598 0 L11.474598 -0.020131 C5.126235 -0.020131 -0.020131 5.126235 -0.020131 11.474598 L0 11.474598 Z M11.474598 0 L11.474598 0.020131 C17.800726 0.020131 22.929066 5.14847 22.929066 11.474598 L22.949196 11.474598 L22.969326 11.474598 C22.969326 5.126235 17.822962 -0.020131 11.474598 -0.020131 L11.474598 0 Z M1.639572 11.474598 L1.619441 11.474598 C1.619441 16.91745 6.031745 21.329754 11.474598 21.329754 L11.474598 21.309624 L11.474598 21.289494 C6.053981 21.289494 1.659703 16.895214 1.659703 11.474598 L1.639572 11.474598 Z M11.474598 21.309624 L11.474598 21.329754 C16.91745 21.329754 21.329754 16.91745 21.329754 11.474598 L21.309624 11.474598 L21.289494 11.474598 C21.289494 16.895214 16.895214 21.289494 11.474598 21.289494 L11.474598 21.309624 Z M21.309624 11.474598 L21.329754 11.474598 C21.329754 6.031745 16.91745 1.619441 11.474598 1.619441 L11.474598 1.639572 L11.474598 1.659703 C16.895214 1.659703 21.289494 6.053981 21.289494 11.474598 L21.309624 11.474598 Z M11.474598 1.639572 L11.474598 1.619441 C6.031745 1.619441 1.619441 6.031745 1.619441 11.474598 L1.639572 11.474598 L1.659703 11.474598 C1.659703 6.053981 6.053981 1.659703 11.474598 1.659703 L11.474598 1.639572 Z",
        "sourceNodeId": "825:6608",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 41 151.5)"
      },
      {
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "end": {
            "x": 0,
            "y": 0
          },
          "gradientStops": [
            {
              "color": "#FFFFFF",
              "opacity": 1,
              "position": 0,
              "variableIds": []
            },
            {
              "color": "#F3B7FF",
              "opacity": 1,
              "position": 1,
              "variableIds": []
            }
          ],
          "opacity": 1,
          "start": {
            "x": 0,
            "y": 1
          },
          "transform": "matrix(0 -1 1 0 0 1)",
          "type": "GRADIENT_LINEAR",
          "variableIds": []
        },
        "path": "M24.5 12.25 L24.478508 12.25 C24.478508 19.003618 19.003618 24.478508 12.25 24.478508 L12.25 24.5 L12.25 24.521492 C19.027357 24.521492 24.521492 19.027357 24.521492 12.25 L24.5 12.25 Z M12.25 24.5 L12.25 24.478508 C5.496381 24.478508 0.021491 19.003618 0.021491 12.25 L0 12.25 L-0.021491 12.25 C-0.021491 19.027357 5.472642 24.521492 12.25 24.521492 L12.25 24.5 Z M0 12.25 L0.021491 12.25 C0.021491 5.496381 5.496381 0.021491 12.25 0.021491 L12.25 0 L12.25 -0.021491 C5.472642 -0.021491 -0.021491 5.472642 -0.021491 12.25 L0 12.25 Z M12.25 0 L12.25 0.021491 C19.003618 0.021491 24.478508 5.496381 24.478508 12.25 L24.5 12.25 L24.521492 12.25 C24.521492 5.472642 19.027357 -0.021491 12.25 -0.021491 L12.25 0 Z M1.750367 12.25 L1.728876 12.25 C1.728876 18.060656 6.439343 22.771124 12.25 22.771124 L12.25 22.749634 L12.25 22.728142 C6.463082 22.728142 1.771858 18.036919 1.771858 12.25 L1.750367 12.25 Z M12.25 22.749634 L12.25 22.771124 C18.060656 22.771124 22.771124 18.060656 22.771124 12.25 L22.749634 12.25 L22.728142 12.25 C22.728142 18.036919 18.036919 22.728142 12.25 22.728142 L12.25 22.749634 Z M22.749634 12.25 L22.771124 12.25 C22.771124 6.439343 18.060656 1.728876 12.25 1.728876 L12.25 1.750367 L12.25 1.771858 C18.036919 1.771858 22.728142 6.463082 22.728142 12.25 L22.749634 12.25 Z M12.25 1.750367 L12.25 1.728876 C6.439343 1.728876 1.728876 6.439343 1.728876 12.25 L1.750367 12.25 L1.771858 12.25 C1.771858 6.463082 6.463082 1.771858 12.25 1.771858 L12.25 1.750367 Z",
        "sourceNodeId": "825:6590",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 24.5 151.5)"
      },
      {
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "end": {
            "x": 0.150863,
            "y": -0.40305
          },
          "gradientStops": [
            {
              "color": "#FFFFFF",
              "opacity": 1,
              "position": 0,
              "variableIds": []
            },
            {
              "color": "#FFF0FD",
              "opacity": 1,
              "position": 1,
              "variableIds": []
            },
            {
              "color": "#FFF4FD",
              "opacity": 0.8,
              "position": 1,
              "variableIds": []
            }
          ],
          "opacity": 1,
          "start": {
            "x": -0.231922,
            "y": 0.637479
          },
          "transform": "matrix(0.382785 -1.04053 1.04053 0.382785 -0.231922 0.637479)",
          "type": "GRADIENT_LINEAR",
          "variableIds": []
        },
        "path": "M22.949196 11.474598 C22.949196 17.811844 17.811844 22.949196 11.474598 22.949196 C5.137352 22.949196 0 17.811844 0 11.474598 C0 5.137352 5.137352 0 11.474598 0 C17.811844 0 22.949196 5.137352 22.949196 11.474598 Z M1.639572 11.474598 C1.639572 16.906332 6.042863 21.309624 11.474598 21.309624 C16.906332 21.309624 21.309624 16.906332 21.309624 11.474598 C21.309624 6.042863 16.906332 1.639572 11.474598 1.639572 C6.042863 1.639572 1.639572 6.042863 1.639572 11.474598 Z",
        "sourceNodeId": "825:6608",
        "transform": "matrix(1 0 0 1 41 151.5)"
      },
      {
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "end": {
            "x": 0.150863,
            "y": -0.40305
          },
          "gradientStops": [
            {
              "color": "#FFFFFF",
              "opacity": 1,
              "position": 0,
              "variableIds": []
            },
            {
              "color": "#FFF0FD",
              "opacity": 1,
              "position": 1,
              "variableIds": []
            },
            {
              "color": "#FFF4FD",
              "opacity": 0.8,
              "position": 1,
              "variableIds": []
            }
          ],
          "opacity": 1,
          "start": {
            "x": -0.231922,
            "y": 0.637479
          },
          "transform": "matrix(0.382785 -1.04053 1.04053 0.382785 -0.231922 0.637479)",
          "type": "GRADIENT_LINEAR",
          "variableIds": []
        },
        "path": "M24.5 12.25 C24.5 19.015488 19.015488 24.5 12.25 24.5 C5.484512 24.5 0 19.015488 0 12.25 C0 5.484512 5.484512 0 12.25 0 C19.015488 0 24.5 5.484512 24.5 12.25 Z M1.750367 12.25 C1.750367 18.048786 6.451213 22.749634 12.25 22.749634 C18.048786 22.749634 22.749634 18.048786 22.749634 12.25 C22.749634 6.451213 18.048786 1.750367 12.25 1.750367 C6.451213 1.750367 1.750367 6.451213 1.750367 12.25 Z",
        "sourceNodeId": "825:6590",
        "transform": "matrix(1 0 0 1 24.5 151.5)"
      },
      {
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "end": {
            "x": 1,
            "y": 0
          },
          "gradientStops": [
            {
              "color": "#7C62FF",
              "opacity": 1,
              "position": 0,
              "variableIds": [
                "106:76525"
              ]
            },
            {
              "color": "#C05CF6",
              "opacity": 1,
              "position": 1,
              "variableIds": [
                "153:2325"
              ]
            }
          ],
          "opacity": 1,
          "start": {
            "x": 0,
            "y": 0
          },
          "type": "GRADIENT_LINEAR",
          "variableIds": [
            "106:76525",
            "153:2325"
          ]
        },
        "path": "M0 12 C0 5.372583 5.372583 0 12 0 L12 0 C18.627417 0 24 5.372583 24 12 L24 12 C24 18.627417 18.627417 24 12 24 L12 24 C5.372583 24 0 18.627417 0 12 L0 12 Z",
        "sourceNodeId": "825:6576",
        "transform": "matrix(1 0 0 1 25 25)"
      },
      {
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "opacity": 1,
          "type": "IMAGE",
          "variableIds": []
        },
        "path": "M0 12 C0 5.372583 5.372583 0 12 0 L12 0 C18.627417 0 24 5.372583 24 12 L24 12 C24 18.627417 18.627417 24 12 24 L12 24 C5.372583 24 0 18.627417 0 12 L0 12 Z",
        "sourceNodeId": "825:6587",
        "transform": "matrix(1 0 0 1 25 151)"
      },
      {
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "opacity": 1,
          "type": "IMAGE",
          "variableIds": []
        },
        "path": "M0 12 C0 5.372583 5.372583 0 12 0 L12 0 C18.627417 0 24 5.372583 24 12 L24 12 C24 18.627417 18.627417 24 12 24 L12 24 C5.372583 24 0 18.627417 0 12 L0 12 Z",
        "sourceNodeId": "825:6605",
        "transform": "matrix(1 0 0 1 41 151)"
      }
    ],
    "instanceNodeIds": [],
    "key": "glassCard",
    "noSymbolReason": "no-instance-or-symbol-in-audited-subtree",
    "overrides": [],
    "size": {
      "height": 200.5,
      "width": 441.549988
    },
    "sourceClipsContent": true,
    "sourcePadding": {
      "bottom": 24,
      "left": 24,
      "right": 24,
      "top": 24
    },
    "sourceKind": "node",
    "sourceNodeIds": [
      "825:6570",
      "825:6571",
      "825:6573",
      "825:6575",
      "825:6576",
      "825:6578",
      "825:6587",
      "825:6589",
      "825:6590",
      "825:6592",
      "825:6593",
      "825:6594",
      "825:6595",
      "825:6596",
      "825:6597",
      "825:6598",
      "825:6599",
      "825:6600",
      "825:6601",
      "825:6602",
      "825:6603",
      "825:6605",
      "825:6607",
      "825:6608",
      "825:6610",
      "825:6611",
      "825:6612",
      "825:6613",
      "825:6614",
      "825:6615",
      "825:6616",
      "825:6617",
      "825:6618",
      "825:6619",
      "825:6620",
      "825:6621",
      "825:6622",
      "825:6623",
      "825:6625"
    ],
    "strokes": [
      {
        "color": "#FFFFFF",
        "opacity": 0.4,
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
        "end": {
          "x": 0,
          "y": 0
        },
        "gradientStops": [
          {
            "color": "#FFFFFF",
            "opacity": 1,
            "position": 0,
            "variableIds": []
          },
          {
            "color": "#F3B7FF",
            "opacity": 1,
            "position": 1,
            "variableIds": []
          }
        ],
        "opacity": 1,
        "start": {
          "x": 0,
          "y": 1
        },
        "transform": "matrix(0 -1 1 0 0 1)",
        "type": "GRADIENT_LINEAR",
        "variableIds": []
      },
      {
        "end": {
          "x": 0,
          "y": 0
        },
        "gradientStops": [
          {
            "color": "#FFFFFF",
            "opacity": 1,
            "position": 0,
            "variableIds": []
          },
          {
            "color": "#F3B7FF",
            "opacity": 1,
            "position": 1,
            "variableIds": []
          }
        ],
        "opacity": 1,
        "start": {
          "x": 0,
          "y": 1
        },
        "transform": "matrix(0 -1 1 0 0 1)",
        "type": "GRADIENT_LINEAR",
        "variableIds": []
      }
    ],
    "surfaceEffects": [
      {
        "blendMode": "NORMAL",
        "color": "#1F2687",
        "offset": {
          "x": 0,
          "y": 8
        },
        "opacity": 0.07,
        "radius": 32,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.12156862765550613,
            "c1": 0.14901961386203766,
            "c2": 0.529411792755127,
            "c3": 0.07000000029802322
          }
        },
        "rawPayload": {
          "type": "DROP_SHADOW",
          "offset": {
            "x": 0,
            "y": 8
          },
          "radius": 32,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": false,
          "color": {
            "r": 0.12156862765550613,
            "g": 0.14901961386203766,
            "b": 0.529411792755127,
            "a": 0.07000000029802322
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0.12156862765550613,
            "c1": 0.14901961386203766,
            "c2": 0.529411792755127,
            "c3": 0.07000000029802322
          }
        },
        "rawType": "DROP_SHADOW",
        "showShadowBehindNode": false,
        "sourceColor": {
          "a": 0.07,
          "b": 0.529412,
          "g": 0.14902,
          "r": 0.121569
        },
        "sourceNodeId": "825:6570",
        "spread": 0,
        "type": "DROP_SHADOW",
        "visible": true
      },
      {
        "blendMode": "NORMAL",
        "blurOpType": "NORMAL",
        "color": "#000000",
        "offset": {
          "x": 0,
          "y": 0
        },
        "opacity": 1,
        "radius": 16,
        "rawFields": {
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 1
          }
        },
        "rawPayload": {
          "type": "BACKGROUND_BLUR",
          "offset": {
            "x": 0,
            "y": 0
          },
          "radius": 16,
          "visible": true,
          "blendMode": "NORMAL",
          "spread": 0,
          "showShadowBehindNode": true,
          "blurOpType": "NORMAL",
          "color": {
            "r": 0,
            "g": 0,
            "b": 0,
            "a": 1
          },
          "authoredColor": {
            "space": "DEFAULT",
            "c0": 0,
            "c1": 0,
            "c2": 0,
            "c3": 1
          }
        },
        "rawType": "BACKGROUND_BLUR",
        "showShadowBehindNode": true,
        "sourceColor": {
          "a": 1,
          "b": 0,
          "g": 0,
          "r": 0
        },
        "sourceNodeId": "825:6570",
        "spread": 0,
        "type": "BACKGROUND_BLUR",
        "visible": true
      }
    ],
    "surfaceFills": [
      {
        "color": "#FFFFFF",
        "opacity": 0.65,
        "type": "SOLID",
        "variableIds": []
      }
    ],
    "surfaceNodeId": "825:6570",
    "surfaceStrokes": [
      {
        "color": "#FFFFFF",
        "opacity": 0.4,
        "type": "SOLID",
        "variableIds": []
      }
    ]
  }
} as const satisfies Readonly<Record<MobilePrimitiveKey, FigmaPrimitiveEvidence>>;

export const figmaMobileIcons = {
  "settings": {
    "layers": [
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.75 -1.5 C0.335786 -1.5 0 -1.164214 0 -0.75 C0 -0.335786 0.335786 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M12.25 0 C12.664213 0 13 -0.335786 13 -0.75 C13 -1.164214 12.664213 -1.5 12.25 -1.5 L12.25 -0.75 L12.25 0 Z M0.75 -0.75 L0.75 0 L12.25 0 L12.25 -0.75 L12.25 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "248:20528",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "transform": "matrix(-1 0 0 -1 13 6)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.75 -1.5 C0.335786 -1.5 0 -1.164214 0 -0.75 C0 -0.335786 0.335786 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711104 0 C8.125318 0 8.461104 -0.335786 8.461104 -0.75 C8.461104 -1.164214 8.125318 -1.5 7.711104 -1.5 L7.711104 -0.75 L7.711104 0 Z M0.75 -0.75 L0.75 0 L7.711104 0 L7.711104 -0.75 L7.711104 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "248:20526",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "transform": "matrix(-0.640184 0.768221 -0.768221 -0.640184 5.416687 0)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.75 -1.5 C0.335786 -1.5 0 -1.164214 0 -0.75 C0 -0.335786 0.335786 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711104 0 C8.125318 0 8.461104 -0.335786 8.461104 -0.75 C8.461104 -1.164214 8.125318 -1.5 7.711104 -1.5 L7.711104 -0.75 L7.711104 0 Z M0.75 -0.75 L0.75 0 L7.711104 0 L7.711104 -0.75 L7.711104 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "248:20527",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "transform": "matrix(-0.640184 -0.768221 -0.768221 0.640184 5.416687 13.5)"
      }
    ],
    "sourceNodeIds": [
      "248:20526",
      "248:20527",
      "248:20528"
    ],
    "viewBox": "0 0 13.000041 13.5"
  },
  "back": {
    "layers": [
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.75 -1.5 C0.335786 -1.5 0 -1.164214 0 -0.75 C0 -0.335786 0.335786 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M12.25 0 C12.664213 0 13 -0.335786 13 -0.75 C13 -1.164214 12.664213 -1.5 12.25 -1.5 L12.25 -0.75 L12.25 0 Z M0.75 -0.75 L0.75 0 L12.25 0 L12.25 -0.75 L12.25 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "845:3508",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "transform": "matrix(-1 0 0 -1 13 6)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.75 -1.5 C0.335786 -1.5 0 -1.164214 0 -0.75 C0 -0.335786 0.335786 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711104 0 C8.125318 0 8.461104 -0.335786 8.461104 -0.75 C8.461104 -1.164214 8.125318 -1.5 7.711104 -1.5 L7.711104 -0.75 L7.711104 0 Z M0.75 -0.75 L0.75 0 L7.711104 0 L7.711104 -0.75 L7.711104 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "845:3506",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "transform": "matrix(-0.640184 0.768221 -0.768221 -0.640184 5.416687 0)"
      },
      {
        "fill": "#494A64",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.75 -1.5 C0.335786 -1.5 0 -1.164214 0 -0.75 C0 -0.335786 0.335786 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711104 0 C8.125318 0 8.461104 -0.335786 8.461104 -0.75 C8.461104 -1.164214 8.125318 -1.5 7.711104 -1.5 L7.711104 -0.75 L7.711104 0 Z M0.75 -0.75 L0.75 0 L7.711104 0 L7.711104 -0.75 L7.711104 -1.5 L0.75 -1.5 L0.75 -0.75 Z",
        "sourceNodeId": "845:3507",
        "strokeLinecap": "round",
        "strokeLinejoin": "miter",
        "transform": "matrix(-0.640184 -0.768221 -0.768221 0.640184 5.416687 13.5)"
      }
    ],
    "sourceNodeIds": [
      "845:3506",
      "845:3507",
      "845:3508"
    ],
    "viewBox": "0 0 13.000041 13.5"
  },
  "share": {
    "layers": [
      {
        "fill": "#494A64",
        "fillRule": "evenodd",
        "opacity": 1,
        "paint": {
          "color": "#494A64",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M8.534293 2.839482 C8.534293 1.271304 9.805552 0.000045 11.373731 0.000045 C12.68594 -0.007323 13.832272 0.88545 14.146501 2.159501 C14.460729 3.433553 13.860991 4.756971 12.695846 5.360611 C11.530699 5.964251 10.103683 5.690854 9.244152 4.699313 L5.630969 6.502356 C5.71539 6.895394 5.71539 7.30188 5.630969 7.694919 L9.244152 9.497961 C10.1524 8.46817 11.667402 8.235836 12.842504 8.946133 C14.017605 9.65643 14.516076 11.105822 14.026447 12.388649 C13.536818 13.671477 12.199393 14.420144 10.849866 14.166843 C9.50034 13.913542 8.525421 12.730856 8.534293 11.357792 C8.533709 11.157292 8.555133 10.957335 8.598181 10.761511 L4.984997 8.958468 C4.208593 9.854152 2.957484 10.173295 1.84691 9.758955 C0.736336 9.344616 0 8.283986 0 7.098637 C0 5.913289 0.736336 4.852658 1.84691 4.438319 C2.957484 4.02398 4.208593 4.343122 4.984997 5.238806 L8.598181 3.435764 C8.555133 3.239939 8.533709 3.039982 8.534293 2.839482 Z M12.793436 2.839722 C12.793436 2.055633 12.157806 1.420003 11.373718 1.420003 C10.589629 1.420003 9.954 2.055633 9.954 2.839722 C9.954 3.623811 10.589629 4.25944 11.373718 4.25944 C12.157806 4.25944 12.793436 3.623811 12.793436 2.839722 Z M2.855408 5.679159 C3.639497 5.679159 4.275126 6.314788 4.275126 7.098877 C4.275126 7.882966 3.639497 8.518596 2.855408 8.518596 C2.071319 8.518596 1.435689 7.882966 1.435689 7.098877 C1.435689 6.314788 2.071319 5.679159 2.855408 5.679159 Z M12.793436 11.358032 C12.793436 10.573943 12.157806 9.938313 11.373718 9.938313 C10.589629 9.938313 9.954 10.573943 9.954 11.358032 C9.954 12.14212 10.589629 12.77775 11.373718 12.77775 C12.157806 12.77775 12.793436 12.14212 12.793436 11.358032 Z",
        "sourceNodeId": "845:3513"
      }
    ],
    "sourceNodeIds": [
      "845:3513"
    ],
    "viewBox": "0 0 14.22939 14.215859"
  },
  "search": {
    "layers": [
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M2.15 2.15 L2.503553 1.796446 L0.353553 -0.353553 L0 0 L-0.353553 0.353553 L1.796446 2.503553 L2.15 2.15 Z",
        "sourceNodeId": "270:26627",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 8.35 8.35)"
      },
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M8 4 L7.5 4 C7.5 5.932997 5.932997 7.5 4 7.5 L4 8 L4 8.5 C6.485281 8.5 8.5 6.485281 8.5 4 L8 4 Z M4 8 L4 7.5 C2.067003 7.5 0.5 5.932997 0.5 4 L0 4 L-0.5 4 C-0.5 6.485281 1.514719 8.5 4 8.5 L4 8 Z M0 4 L0.5 4 C0.5 2.067003 2.067003 0.5 4 0.5 L4 0 L4 -0.5 C1.514719 -0.5 -0.5 1.514719 -0.5 4 L0 4 Z M4 0 L4 0.5 C5.932997 0.5 7.5 2.067003 7.5 4 L8 4 L8.5 4 C8.5 1.514719 6.485281 -0.5 4 -0.5 L4 0 Z",
        "sourceNodeId": "270:26626",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
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
        "fillRule": "nonzero",
        "opacity": 0.0001,
        "paint": {
          "color": "#000000",
          "opacity": 0.0001,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 0 L15 0 L15 15 L0 15 L0 0 Z",
        "sourceNodeId": "825:6483"
      },
      {
        "fill": "#7C62FF",
        "fillRule": "evenodd",
        "opacity": 1,
        "paint": {
          "color": "#7C62FF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M5.625548 0.004515 C4.616284 -0.046226 3.63269 0.332541 2.918131 1.047099 C2.203573 1.761657 1.824806 2.745252 1.875548 3.754515 L1.875548 5.629516 C1.875548 5.829515 1.769298 5.967016 1.425548 6.254516 L1.175548 6.492016 C0.424802 6.997462 -0.017777 7.849662 0.000548 8.754516 C0.000548 9.598266 0.663048 9.898266 1.681798 10.004516 L2.500548 10.004516 L8.750547 10.004516 L9.569298 10.004516 C10.588047 9.917016 11.250547 9.617016 11.250547 8.754516 C11.268187 7.843007 10.826745 6.983603 10.075548 6.467015 L9.806797 6.254516 C9.463047 5.973266 9.375547 5.829515 9.375547 5.629516 L9.375547 3.754515 C9.42629 2.745252 9.047523 1.761657 8.332964 1.047099 C7.618406 0.332541 6.634811 -0.046226 5.625548 0.004515 Z M5.625538 1.25438 C6.302957 1.203281 6.968967 1.450215 7.449336 1.930583 C7.929704 2.410951 8.176638 3.076961 8.125539 3.75438 L8.125539 5.62938 C8.136566 6.270617 8.467237 6.863946 9.006788 7.21063 L9.300539 7.44813 C9.708921 7.71062 9.968639 8.151213 10.000539 8.63563 C9.828646 8.692267 9.650009 8.725893 9.469288 8.73563 L8.769288 8.73563 L2.500538 8.73563 L1.800538 8.73563 C1.613499 8.727567 1.428446 8.693921 1.250538 8.63563 C1.278176 8.15467 1.530546 7.714759 1.931788 7.44813 L2.206789 7.21063 C2.760682 6.872777 3.106324 6.277896 3.125538 5.62938 L3.125538 3.75438 C3.074439 3.076961 3.321373 2.410951 3.801742 1.930583 C4.28211 1.450215 4.94812 1.203281 5.625538 1.25438 Z M5.625541 11.254403 C5.265519 11.252372 4.923854 11.095206 4.688041 10.823153 C4.549197 10.630993 4.313585 10.53393 4.079676 10.572533 C3.845768 10.611135 3.653836 10.778755 3.584097 11.005338 C3.514359 11.231921 3.578821 11.478456 3.750541 11.641903 C4.2191 12.190081 4.9044 12.505319 5.625541 12.504403 C6.341644 12.50666 7.024334 12.201725 7.500541 11.666903 C7.710418 11.406331 7.677862 11.026694 7.426686 10.805659 C7.17551 10.584624 6.794815 10.600601 6.563041 10.841904 C6.323805 11.106998 5.982615 11.257122 5.625541 11.254403 Z",
        "sourceNodeId": "825:6484",
        "transform": "matrix(1 0 0 1 1.874444 1.24564)"
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
        "fillRule": "evenodd",
        "opacity": 1,
        "paint": {
          "color": "#7F80A1",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": [
            "170:6429"
          ]
        },
        "path": "M8.001953 0 C5.240529 0 3.001953 2.238576 3.001953 5 L3.001953 9 C3.001953 11.761424 5.240529 14 8.001953 14 C10.763377 14 13.001953 11.761424 13.001953 9 L13.001953 5 C13.001953 2.238576 10.763377 0 8.001953 0 Z M8.001953 2 C9.658808 2 11.001953 3.343146 11.001953 5 L11.001953 9 C11.001953 10.656855 9.658808 12 8.001953 12 C6.345099 12 5.001953 10.656855 5.001953 9 L5.001953 5 C5.001953 3.343146 6.345099 2 8.001953 2 Z M8.002259 16 C5.479276 16.026451 3.137286 14.693083 1.872259 12.509999 C1.750428 12.265094 1.533593 12.080784 1.272259 12 C1.011733 11.94 0.73803 11.986817 0.512259 12.13 C0.279117 12.260258 0.107765 12.478359 0.036384 12.735705 C-0.034997 12.993052 -0.000474 13.268258 0.132259 13.5 C1.578557 15.995284 4.133122 17.646269 7.002259 17.939999 L7.002259 19 C7.002259 19.552284 7.449975 20 8.002259 20 C8.554544 20 9.002259 19.552284 9.002259 19 L9.002259 17.939999 C11.862218 17.627605 14.406009 15.981187 15.862259 13.5 C16.123829 13.03175 15.969405 12.440525 15.512259 12.16 C15.283683 12.01751 15.007291 11.973256 14.745652 12.037253 C14.484014 12.101252 14.259256 12.26809 14.122259 12.5 C12.849475 14.67163 10.519388 16.004196 8.002259 16 Z",
        "sourceNodeId": "845:3535"
      }
    ],
    "sourceNodeIds": [
      "845:3535"
    ],
    "viewBox": "0 0 15.98938 20"
  },
  "send": {
    "layers": [
      {
        "fill": "#FFFFFF",
        "fillRule": "evenodd",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M8.482423 0.455559 C9.07339 0.164428 9.72186 0.008795 10.380588 0 C11.956063 0.031636 12.601439 1.436278 11.627048 3.574876 L7.931956 11.110587 C7.299234 12.540537 5.957865 12.37603 5.641504 10.870153 L4.850603 7.276296 L1.250418 6.485394 C-0.293422 6.143724 -0.432621 4.833991 0.972021 4.150652 L8.482423 0.455559 Z M10.481548 3.062507 C11.082634 1.733792 10.962417 1.145362 10.120897 1.265579 L10.120897 1.246597 C9.750363 1.318895 9.392301 1.444644 9.057925 1.619903 L1.560177 5.239069 L5.495704 6.105896 C5.731652 6.160249 5.915893 6.34449 5.970245 6.580438 L6.843401 10.515964 L10.481548 3.062507 Z",
        "sourceNodeId": "845:3540"
      }
    ],
    "sourceNodeIds": [
      "845:3540"
    ],
    "viewBox": "0 0 12.087507 12.096531"
  },
  "arrow-right": {
    "layers": [
      {
        "fill": "#8B8FAF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#8B8FAF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M2.576 2.576 L2.879585 2.879585 L3.183169 2.576 L2.879585 2.272415 L2.576 2.576 Z M0 5.152 L0.303584 5.455585 L2.879585 2.879585 L2.576 2.576 L2.272415 2.272415 L-0.303584 4.848415 L0 5.152 Z M2.576 2.576 L2.879585 2.272415 L0.303584 -0.303584 L0 0 L-0.303584 0.303584 L2.272415 2.879585 L2.576 2.576 Z",
        "sourceNodeId": "825:7025",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter"
      }
    ],
    "sourceNodeIds": [
      "825:7025"
    ],
    "viewBox": "0 0 2.576 5.152"
  },
  "house": {
    "layers": [
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0 4.663327 L0.75 4.663327 L0.75 4.663147 L0 4.663327 Z M0.413314 3.772573 L0.897451 4.345407 L0.901361 4.342056 L0.413314 3.772573 Z M4.49399 0.275434 L4.009854 -0.2974 L4.005944 -0.294049 L4.49399 0.275434 Z M5.246584 0 L5.246584 -0.75 L5.246584 0 Z M5.999177 0.275434 L6.487236 -0.294062 L6.483302 -0.297386 L5.999177 0.275434 Z M10.079853 3.772573 L9.591795 4.34207 L9.595729 4.345394 L10.079853 3.772573 Z M10.493168 4.663327 L9.743168 4.663147 L9.743168 4.663327 L10.493168 4.663327 Z M0 9.909911 L-0.75 9.909911 L0 9.909911 Z M0 4.663327 L0.75 4.663147 C0.749986 4.602647 0.76317 4.542871 0.788635 4.487991 L0.108306 4.172315 L-0.572024 3.856638 C-0.689329 4.109448 -0.750067 4.384807 -0.75 4.663507 L0 4.663327 Z M0.108306 4.172315 L0.788635 4.487991 C0.8141 4.433111 0.851231 4.384447 0.897439 4.345394 L0.413314 3.772573 L-0.070811 3.199753 C-0.28367 3.379654 -0.454719 3.603828 -0.572024 3.856638 L0.108306 4.172315 Z M0.413314 3.772573 L0.901361 4.342056 L4.982037 0.844916 L4.49399 0.275434 L4.005944 -0.294049 L-0.074732 3.203091 L0.413314 3.772573 Z M4.49399 0.275434 L4.978115 0.848254 C5.053184 0.784809 5.148296 0.75 5.246584 0.75 L5.246584 0 L5.246584 -0.75 C4.793813 -0.75 4.355673 -0.58965 4.009865 -0.297386 L4.49399 0.275434 Z M5.246584 0 L5.246584 0.75 C5.344872 0.75 5.439984 0.784809 5.515052 0.848254 L5.999177 0.275434 L6.483302 -0.297386 C6.137494 -0.58965 5.699354 -0.75 5.246584 -0.75 L5.246584 0 Z M5.999177 0.275434 L5.511131 0.844916 L9.591806 4.342056 L10.079853 3.772573 L10.5679 3.203091 L6.487224 -0.294049 L5.999177 0.275434 Z M10.079853 3.772573 L9.595729 4.345394 C9.641936 4.384447 9.679068 4.433111 9.704533 4.487991 L10.384862 4.172315 L11.065192 3.856638 C10.947886 3.603828 10.776838 3.379654 10.563978 3.199753 L10.079853 3.772573 Z M10.384862 4.172315 L9.704533 4.487991 C9.729997 4.542871 9.743182 4.602646 9.743168 4.663147 L10.493168 4.663327 L11.243168 4.663507 C11.243235 4.384808 11.182497 4.109449 11.065192 3.856638 L10.384862 4.172315 Z M10.493168 4.663327 L9.743168 4.663327 L9.743168 9.909911 L10.493168 9.909911 L11.243168 9.909911 L11.243168 4.663327 L10.493168 4.663327 Z M10.493168 9.909911 L9.743168 9.909911 C9.743168 10.020216 9.699349 10.126004 9.621351 10.204002 L10.151681 10.734332 L10.682011 11.264662 C11.041313 10.90536 11.243168 10.418042 11.243168 9.909911 L10.493168 9.909911 Z M10.151681 10.734332 L9.621351 10.204002 C9.543353 10.282001 9.437565 10.325819 9.32726 10.325819 L9.32726 11.075819 L9.32726 11.825819 C9.835391 11.825819 10.322709 11.623964 10.682011 11.264662 L10.151681 10.734332 Z M9.32726 11.075819 L9.32726 10.325819 L1.165908 10.325819 L1.165908 11.075819 L1.165908 11.825819 L9.32726 11.825819 L9.32726 11.075819 Z M1.165908 11.075819 L1.165908 10.325819 C1.055602 10.325819 0.949815 10.282001 0.871817 10.204002 L0.341486 10.734332 L-0.188844 11.264662 C0.170458 11.623964 0.657777 11.825819 1.165908 11.825819 L1.165908 11.075819 Z M0.341486 10.734332 L0.871817 10.204002 C0.793819 10.126004 0.75 10.020217 0.75 9.909911 L0 9.909911 L-0.75 9.909911 C-0.75 10.418041 -0.548146 10.90536 -0.188844 11.264662 L0.341486 10.734332 Z M0 9.909911 L0.75 9.909911 L0.75 4.663327 L0 4.663327 L-0.75 4.663327 L-0.75 9.909911 L0 9.909911 Z",
        "sourceNodeId": "270:26536",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 1.748901 1.165918)"
      },
      {
        "fill": "#FFFFFF",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#FFFFFF",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M3.497723 5.246584 L4.247723 5.246584 L4.247723 0.582954 L3.497723 0.582954 L2.747723 0.582954 L2.747723 5.246584 L3.497723 5.246584 Z M3.497723 0.582954 L4.247723 0.582954 C4.247723 0.229432 4.107287 -0.10961 3.85731 -0.359587 L3.32698 0.170743 L2.79665 0.701073 C2.765323 0.669747 2.747723 0.627258 2.747723 0.582954 L3.497723 0.582954 Z M3.32698 0.170743 L3.85731 -0.359587 C3.607333 -0.609564 3.268291 -0.75 2.914769 -0.75 L2.914769 0 L2.914769 0.75 C2.870466 0.75 2.827977 0.7324 2.79665 0.701073 L3.32698 0.170743 Z M2.914769 0 L2.914769 -0.75 L0.582954 -0.75 L0.582954 0 L0.582954 0.75 L2.914769 0.75 L2.914769 0 Z M0.582954 0 L0.582954 -0.75 C0.229432 -0.75 -0.10961 -0.609564 -0.359587 -0.359587 L0.170743 0.170743 L0.701073 0.701073 C0.669747 0.7324 0.627258 0.75 0.582954 0.75 L0.582954 0 Z M0.170743 0.170743 L-0.359587 -0.359587 C-0.609564 -0.10961 -0.75 0.229432 -0.75 0.582954 L0 0.582954 L0.75 0.582954 C0.75 0.627258 0.7324 0.669747 0.701073 0.701073 L0.170743 0.170743 Z M0 0.582954 L-0.75 0.582954 L-0.75 5.246584 L0 5.246584 L0.75 5.246584 L0.75 0.582954 L0 0.582954 Z",
        "sourceNodeId": "270:26535",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 5.246582 6.99541)"
      }
    ],
    "sourceNodeIds": [
      "270:26535",
      "270:26536"
    ],
    "viewBox": "0 0 13.990892 13.990892"
  },
  "layout-grid": {
    "layers": [
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.582954 0 L0.582954 0.75 L3.497723 0.75 L3.497723 0 L3.497723 -0.75 L0.582954 -0.75 L0.582954 0 Z M3.497723 0 L3.497723 0.75 C3.405466 0.75 3.330677 0.675211 3.330677 0.582954 L4.080677 0.582954 L4.830677 0.582954 C4.830677 -0.153216 4.233893 -0.75 3.497723 -0.75 L3.497723 0 Z M4.080677 0.582954 L3.330677 0.582954 L3.330677 3.497723 L4.080677 3.497723 L4.830677 3.497723 L4.830677 0.582954 L4.080677 0.582954 Z M4.080677 3.497723 L3.330677 3.497723 C3.330677 3.405466 3.405466 3.330677 3.497723 3.330677 L3.497723 4.080677 L3.497723 4.830677 C4.233893 4.830677 4.830677 4.233893 4.830677 3.497723 L4.080677 3.497723 Z M3.497723 4.080677 L3.497723 3.330677 L0.582954 3.330677 L0.582954 4.080677 L0.582954 4.830677 L3.497723 4.830677 L3.497723 4.080677 Z M0.582954 4.080677 L0.582954 3.330677 C0.675211 3.330677 0.75 3.405466 0.75 3.497723 L0 3.497723 L-0.75 3.497723 C-0.75 4.233893 -0.153216 4.830677 0.582954 4.830677 L0.582954 4.080677 Z M0 3.497723 L0.75 3.497723 L0.75 0.582954 L0 0.582954 L-0.75 0.582954 L-0.75 3.497723 L0 3.497723 Z M0 0.582954 L0.75 0.582954 C0.75 0.675211 0.675211 0.75 0.582954 0.75 L0.582954 0 L0.582954 -0.75 C-0.153216 -0.75 -0.75 -0.153216 -0.75 0.582954 L0 0.582954 Z",
        "sourceNodeId": "270:26541",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 1.748853 1.748819)"
      },
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.582954 0 L0.582954 0.75 L3.497723 0.75 L3.497723 0 L3.497723 -0.75 L0.582954 -0.75 L0.582954 0 Z M3.497723 0 L3.497723 0.75 C3.405466 0.75 3.330677 0.675211 3.330677 0.582954 L4.080677 0.582954 L4.830677 0.582954 C4.830677 -0.153216 4.233893 -0.75 3.497723 -0.75 L3.497723 0 Z M4.080677 0.582954 L3.330677 0.582954 L3.330677 3.497723 L4.080677 3.497723 L4.830677 3.497723 L4.830677 0.582954 L4.080677 0.582954 Z M4.080677 3.497723 L3.330677 3.497723 C3.330677 3.405466 3.405466 3.330677 3.497723 3.330677 L3.497723 4.080677 L3.497723 4.830677 C4.233893 4.830677 4.830677 4.233893 4.830677 3.497723 L4.080677 3.497723 Z M3.497723 4.080677 L3.497723 3.330677 L0.582954 3.330677 L0.582954 4.080677 L0.582954 4.830677 L3.497723 4.830677 L3.497723 4.080677 Z M0.582954 4.080677 L0.582954 3.330677 C0.675211 3.330677 0.75 3.405466 0.75 3.497723 L0 3.497723 L-0.75 3.497723 C-0.75 4.233893 -0.153216 4.830677 0.582954 4.830677 L0.582954 4.080677 Z M0 3.497723 L0.75 3.497723 L0.75 0.582954 L0 0.582954 L-0.75 0.582954 L-0.75 3.497723 L0 3.497723 Z M0 0.582954 L0.75 0.582954 C0.75 0.675211 0.675211 0.75 0.582954 0.75 L0.582954 0 L0.582954 -0.75 C-0.153216 -0.75 -0.75 -0.153216 -0.75 0.582954 L0 0.582954 Z",
        "sourceNodeId": "270:26542",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 8.161361 1.748819)"
      },
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.582954 0 L0.582954 0.75 L3.497723 0.75 L3.497723 0 L3.497723 -0.75 L0.582954 -0.75 L0.582954 0 Z M3.497723 0 L3.497723 0.75 C3.405466 0.75 3.330677 0.675211 3.330677 0.582954 L4.080677 0.582954 L4.830677 0.582954 C4.830677 -0.153216 4.233893 -0.75 3.497723 -0.75 L3.497723 0 Z M4.080677 0.582954 L3.330677 0.582954 L3.330677 3.497723 L4.080677 3.497723 L4.830677 3.497723 L4.830677 0.582954 L4.080677 0.582954 Z M4.080677 3.497723 L3.330677 3.497723 C3.330677 3.405466 3.405466 3.330677 3.497723 3.330677 L3.497723 4.080677 L3.497723 4.830677 C4.233893 4.830677 4.830677 4.233893 4.830677 3.497723 L4.080677 3.497723 Z M3.497723 4.080677 L3.497723 3.330677 L0.582954 3.330677 L0.582954 4.080677 L0.582954 4.830677 L3.497723 4.830677 L3.497723 4.080677 Z M0.582954 4.080677 L0.582954 3.330677 C0.675211 3.330677 0.75 3.405466 0.75 3.497723 L0 3.497723 L-0.75 3.497723 C-0.75 4.233893 -0.153216 4.830677 0.582954 4.830677 L0.582954 4.080677 Z M0 3.497723 L0.75 3.497723 L0.75 0.582954 L0 0.582954 L-0.75 0.582954 L-0.75 3.497723 L0 3.497723 Z M0 0.582954 L0.75 0.582954 C0.75 0.675211 0.675211 0.75 0.582954 0.75 L0.582954 0 L0.582954 -0.75 C-0.153216 -0.75 -0.75 -0.153216 -0.75 0.582954 L0 0.582954 Z",
        "sourceNodeId": "270:26543",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 8.161361 8.161415)"
      },
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M0.582954 0 L0.582954 0.75 L3.497723 0.75 L3.497723 0 L3.497723 -0.75 L0.582954 -0.75 L0.582954 0 Z M3.497723 0 L3.497723 0.75 C3.405466 0.75 3.330677 0.675211 3.330677 0.582954 L4.080677 0.582954 L4.830677 0.582954 C4.830677 -0.153216 4.233893 -0.75 3.497723 -0.75 L3.497723 0 Z M4.080677 0.582954 L3.330677 0.582954 L3.330677 3.497723 L4.080677 3.497723 L4.830677 3.497723 L4.830677 0.582954 L4.080677 0.582954 Z M4.080677 3.497723 L3.330677 3.497723 C3.330677 3.405466 3.405466 3.330677 3.497723 3.330677 L3.497723 4.080677 L3.497723 4.830677 C4.233893 4.830677 4.830677 4.233893 4.830677 3.497723 L4.080677 3.497723 Z M3.497723 4.080677 L3.497723 3.330677 L0.582954 3.330677 L0.582954 4.080677 L0.582954 4.830677 L3.497723 4.830677 L3.497723 4.080677 Z M0.582954 4.080677 L0.582954 3.330677 C0.675211 3.330677 0.75 3.405466 0.75 3.497723 L0 3.497723 L-0.75 3.497723 C-0.75 4.233893 -0.153216 4.830677 0.582954 4.830677 L0.582954 4.080677 Z M0 3.497723 L0.75 3.497723 L0.75 0.582954 L0 0.582954 L-0.75 0.582954 L-0.75 3.497723 L0 3.497723 Z M0 0.582954 L0.75 0.582954 C0.75 0.675211 0.675211 0.75 0.582954 0.75 L0.582954 0 L0.582954 -0.75 C-0.153216 -0.75 -0.75 -0.153216 -0.75 0.582954 L0 0.582954 Z",
        "sourceNodeId": "270:26544",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 1.748853 8.161415)"
      }
    ],
    "sourceNodeIds": [
      "270:26541",
      "270:26542",
      "270:26543",
      "270:26544"
    ],
    "viewBox": "0 0 13.990891 13.990891"
  },
  "compass": {
    "layers": [
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M11.659077 5.829538 L10.909077 5.829538 C10.909077 8.63489 8.63489 10.909077 5.829538 10.909077 L5.829538 11.659077 L5.829538 12.409077 C9.463317 12.409077 12.409077 9.463317 12.409077 5.829538 L11.659077 5.829538 Z M5.829538 11.659077 L5.829538 10.909077 C3.024187 10.909077 0.75 8.63489 0.75 5.829538 L0 5.829538 L-0.75 5.829538 C-0.75 9.463317 2.19576 12.409077 5.829538 12.409077 L5.829538 11.659077 Z M0 5.829538 L0.75 5.829538 C0.75 3.024187 3.024187 0.75 5.829538 0.75 L5.829538 0 L5.829538 -0.75 C2.19576 -0.75 -0.75 2.19576 -0.75 5.829538 L0 5.829538 Z M5.829538 0 L5.829538 0.75 C8.63489 0.75 10.909077 3.024187 10.909077 5.829538 L11.659077 5.829538 L12.409077 5.829538 C12.409077 2.19576 9.463317 -0.75 5.829538 -0.75 L5.829538 0 Z",
        "sourceNodeId": "270:26550",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 1.165908 1.165878)"
      },
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M4.943448 0 L5.654947 0.23721 L6.129434 -1.185986 L4.706238 -0.711499 L4.943448 0 Z M3.891799 3.154363 L3.1803 2.917152 L3.180279 2.917217 L3.891799 3.154363 Z M3.154363 3.891799 L2.917217 3.180279 L2.917152 3.1803 L3.154363 3.891799 Z M0 4.943448 L-0.711499 4.706238 L-1.185986 6.129434 L0.23721 5.654947 L0 4.943448 Z M1.051649 1.789085 L1.763148 2.026296 L1.763169 2.026231 L1.051649 1.789085 Z M1.789085 1.051649 L2.026231 1.763169 L2.026296 1.763148 L1.789085 1.051649 Z M4.943448 0 L4.231949 -0.23721 L3.1803 2.917152 L3.891799 3.154363 L4.603299 3.391573 L5.654947 0.23721 L4.943448 0 Z M3.891799 3.154363 L3.180279 2.917217 C3.159861 2.978477 3.12546 3.034141 3.0798 3.0798 L3.610131 3.610131 L4.14046 4.14046 C4.350795 3.930126 4.509266 3.673705 4.60332 3.391509 L3.891799 3.154363 Z M3.610131 3.610131 L3.0798 3.0798 C3.034141 3.12546 2.978477 3.159861 2.917217 3.180279 L3.154363 3.891799 L3.391509 4.60332 C3.673705 4.509266 3.930126 4.350795 4.14046 4.14046 L3.610131 3.610131 Z M3.154363 3.891799 L2.917152 3.1803 L-0.23721 4.231949 L0 4.943448 L0.23721 5.654947 L3.391573 4.603299 L3.154363 3.891799 Z M0 4.943448 L0.711499 5.180658 L1.763148 2.026296 L1.051649 1.789085 L0.340149 1.551875 L-0.711499 4.706238 L0 4.943448 Z M1.051649 1.789085 L1.763169 2.026231 C1.783587 1.964971 1.817988 1.909307 1.863648 1.863648 L1.333318 1.333318 L0.802987 0.802987 C0.592653 1.013322 0.434182 1.269743 0.340128 1.55194 L1.051649 1.789085 Z M1.333318 1.333318 L1.863648 1.863648 C1.909307 1.817988 1.964971 1.783587 2.026231 1.763169 L1.789085 1.051649 L1.55194 0.340128 C1.269743 0.434182 1.013322 0.592653 0.802987 0.802987 L1.333318 1.333318 Z M1.789085 1.051649 L2.026296 1.763148 L5.180658 0.711499 L4.943448 0 L4.706238 -0.711499 L1.551875 0.340149 L1.789085 1.051649 Z",
        "sourceNodeId": "270:26549",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 4.523735 4.523555)"
      }
    ],
    "sourceNodeIds": [
      "270:26549",
      "270:26550"
    ],
    "viewBox": "0 0 13.990891 13.990891"
  },
  "user": {
    "layers": [
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M4.66363 2.331815 L3.91363 2.331815 C3.91363 3.205428 3.205428 3.91363 2.331815 3.91363 L2.331815 4.66363 L2.331815 5.41363 C4.033855 5.41363 5.41363 4.033855 5.41363 2.331815 L4.66363 2.331815 Z M2.331815 4.66363 L2.331815 3.91363 C1.458203 3.91363 0.75 3.205428 0.75 2.331815 L0 2.331815 L-0.75 2.331815 C-0.75 4.033855 0.629776 5.41363 2.331815 5.41363 L2.331815 4.66363 Z M0 2.331815 L0.75 2.331815 C0.75 1.458203 1.458203 0.75 2.331815 0.75 L2.331815 0 L2.331815 -0.75 C0.629776 -0.75 -0.75 0.629776 -0.75 2.331815 L0 2.331815 Z M2.331815 0 L2.331815 0.75 C3.205428 0.75 3.91363 1.458203 3.91363 2.331815 L4.66363 2.331815 L5.41363 2.331815 C5.41363 0.629776 4.033855 -0.75 2.331815 -0.75 L2.331815 0 Z",
        "sourceNodeId": "270:26556",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 4.663591 1.748707)"
      },
      {
        "fill": "#6B7280",
        "fillRule": "nonzero",
        "opacity": 1,
        "paint": {
          "color": "#6B7280",
          "opacity": 1,
          "type": "SOLID",
          "variableIds": []
        },
        "path": "M5.829538 0 L5.829538 -0.75 L5.829538 0 Z M2.331815 0 L2.331815 -0.75 L2.331815 0 Z M0 2.331815 L-0.75 2.331815 L0 2.331815 Z M8.161353 3.497723 L8.911353 3.497723 L8.911353 2.331815 L8.161353 2.331815 L7.411353 2.331815 L7.411353 3.497723 L8.161353 3.497723 Z M8.161353 2.331815 L8.911353 2.331815 C8.911353 1.514467 8.586662 0.730595 8.00871 0.152643 L7.47838 0.682973 L6.94805 1.213303 C7.244698 1.509952 7.411353 1.912292 7.411353 2.331815 L8.161353 2.331815 Z M7.47838 0.682973 L8.00871 0.152643 C7.430758 -0.425309 6.646887 -0.75 5.829538 -0.75 L5.829538 0 L5.829538 0.75 C6.249061 0.75 6.651402 0.916655 6.94805 1.213303 L7.47838 0.682973 Z M5.829538 0 L5.829538 -0.75 L2.331815 -0.75 L2.331815 0 L2.331815 0.75 L5.829538 0.75 L5.829538 0 Z M2.331815 0 L2.331815 -0.75 C1.514467 -0.75 0.730595 -0.425309 0.152643 0.152643 L0.682973 0.682973 L1.213303 1.213303 C1.509951 0.916655 1.912292 0.75 2.331815 0.75 L2.331815 0 Z M0.682973 0.682973 L0.152643 0.152643 C-0.42531 0.730596 -0.75 1.514467 -0.75 2.331815 L0 2.331815 L0.75 2.331815 C0.75 1.912292 0.916655 1.509951 1.213303 1.213303 L0.682973 0.682973 Z M0 2.331815 L-0.75 2.331815 L-0.75 3.497723 L0 3.497723 L0.75 3.497723 L0.75 2.331815 L0 2.331815 Z",
        "sourceNodeId": "270:26555",
        "strokeLinecap": "butt",
        "strokeLinejoin": "miter",
        "transform": "matrix(1 0 0 1 2.914725 8.744172)"
      }
    ],
    "sourceNodeIds": [
      "270:26555",
      "270:26556"
    ],
    "viewBox": "0 0 13.990891 13.990891"
  }
} as const satisfies Readonly<Record<
  'settings' | 'back' | 'share' | 'search' | 'bell' | 'microphone' | 'send' | 'arrow-right' |
  'house' | 'layout-grid' | 'compass' | 'user',
  { sourceNodeIds: readonly FigmaNodeId[]; viewBox: string; layers: readonly FigmaVectorLayer[] }
>>;

export function getFigmaMobileIcon(name: keyof typeof figmaMobileIcons) {
  return figmaMobileIcons[name];
}
