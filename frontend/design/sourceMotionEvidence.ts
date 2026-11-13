export type SourceMotion = {
  nodeId: string;
  interactionId: string;
  event: 'ON_HOVER' | 'ON_PRESS' | 'ON_CLICK' | 'AFTER_TIMEOUT' | 'DRAG';
  navigation: 'NAVIGATE' | 'SWAP_STATE' | 'SCROLL_TO';
  targetNodeId: string | null;
  transition: string | null;
  durationMs: number;
  prototypeDelayMs: number;
  easingType: string | null;
  easingFunction: readonly number[];
};

export const sourceMotionFrameIds = [
  "119:76618",
  "270:26263",
  "188:16287",
  "188:16759",
  "266:21147",
  "268:22904",
  "268:23238",
  "268:23572",
  "268:23906",
  "270:26597",
  "825:6804",
  "845:3479",
  "846:3544",
  "849:3608",
  "849:3705",
  "849:3794",
  "849:3883",
  "849:3972",
  "852:4061",
  "852:4150",
  "852:4242",
  "852:4391",
  "168:6299",
  "380:147",
  "168:6358",
  "825:6452"
] as const;

const sourceMotions = [
  {
    "nodeId": "188:16337",
    "interactionId": "180:14868",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "164:6118",
    "transition": "SMART_ANIMATE",
    "durationMs": 600.0000238418579,
    "prototypeDelayMs": 0,
    "easingType": "IN_CUBIC",
    "easingFunction": [
      0.41999998688697815,
      0,
      1,
      1
    ]
  },
  {
    "nodeId": "188:16805",
    "interactionId": "180:14868",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "164:6118",
    "transition": "SMART_ANIMATE",
    "durationMs": 600.0000238418579,
    "prototypeDelayMs": 0,
    "easingType": "IN_CUBIC",
    "easingFunction": [
      0.41999998688697815,
      0,
      1,
      1
    ]
  },
  {
    "nodeId": "188:16806",
    "interactionId": "188:16753",
    "event": "ON_HOVER",
    "navigation": "NAVIGATE",
    "targetNodeId": "188:16287",
    "transition": "SMART_ANIMATE",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "266:21193",
    "interactionId": "180:14868",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "164:6118",
    "transition": "SLIDE_FROM_RIGHT",
    "durationMs": 600.0000238418579,
    "prototypeDelayMs": 0,
    "easingType": "IN_CUBIC",
    "easingFunction": [
      0.41999998688697815,
      0,
      1,
      1
    ]
  },
  {
    "nodeId": "266:21194",
    "interactionId": "188:16753",
    "event": "ON_HOVER",
    "navigation": "NAVIGATE",
    "targetNodeId": "188:16287",
    "transition": "SMART_ANIMATE",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "266:21221",
    "interactionId": "188:17009",
    "event": "ON_PRESS",
    "navigation": "NAVIGATE",
    "targetNodeId": "188:16759",
    "transition": "SMART_ANIMATE",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "266:21248",
    "interactionId": "268:24331",
    "event": "ON_HOVER",
    "navigation": "NAVIGATE",
    "targetNodeId": "268:22904",
    "transition": "SMART_ANIMATE",
    "durationMs": 638.8086080551147,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      256,
      24,
      0
    ]
  },
  {
    "nodeId": "266:21339",
    "interactionId": "268:24332",
    "event": "ON_HOVER",
    "navigation": "NAVIGATE",
    "targetNodeId": "268:23238",
    "transition": "SMART_ANIMATE",
    "durationMs": 638.8086080551147,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      256,
      24,
      0
    ]
  },
  {
    "nodeId": "266:21373",
    "interactionId": "268:24333",
    "event": "ON_HOVER",
    "navigation": "NAVIGATE",
    "targetNodeId": "268:23572",
    "transition": "SMART_ANIMATE",
    "durationMs": 638.8086080551147,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      256,
      24,
      0
    ]
  },
  {
    "nodeId": "266:21480",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "266:21480/248:20524",
    "interactionId": "268:24335",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "168:6258",
    "transition": "SLIDE_FROM_BOTTOM",
    "durationMs": 300.00001192092896,
    "prototypeDelayMs": 0,
    "easingType": "INOUT_CUBIC",
    "easingFunction": [
      0.41999998688697815,
      0,
      0.5799999833106995,
      1
    ]
  },
  {
    "nodeId": "266:21493",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "266:21500",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "266:21507",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "268:22898",
    "interactionId": "268:24334",
    "event": "ON_HOVER",
    "navigation": "NAVIGATE",
    "targetNodeId": "268:23906",
    "transition": "SMART_ANIMATE",
    "durationMs": 638.8086080551147,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      256,
      24,
      0
    ]
  },
  {
    "nodeId": "268:22950",
    "interactionId": "180:14868",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "164:6118",
    "transition": "SMART_ANIMATE",
    "durationMs": 600.0000238418579,
    "prototypeDelayMs": 0,
    "easingType": "IN_CUBIC",
    "easingFunction": [
      0.41999998688697815,
      0,
      1,
      1
    ]
  },
  {
    "nodeId": "268:22951",
    "interactionId": "188:16753",
    "event": "ON_HOVER",
    "navigation": "NAVIGATE",
    "targetNodeId": "188:16287",
    "transition": "SMART_ANIMATE",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "268:22978",
    "interactionId": "188:17009",
    "event": "ON_PRESS",
    "navigation": "NAVIGATE",
    "targetNodeId": "188:16759",
    "transition": "SMART_ANIMATE",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "268:23006",
    "interactionId": "268:24337",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "168:6258",
    "transition": "SLIDE_FROM_BOTTOM",
    "durationMs": 300.00001192092896,
    "prototypeDelayMs": 0,
    "easingType": "INOUT_CUBIC",
    "easingFunction": [
      0.41999998688697815,
      0,
      0.5799999833106995,
      1
    ]
  },
  {
    "nodeId": "268:23013",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "268:23099",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "268:23147",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "268:23189",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "268:23284",
    "interactionId": "180:14868",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "164:6118",
    "transition": "SMART_ANIMATE",
    "durationMs": 600.0000238418579,
    "prototypeDelayMs": 0,
    "easingType": "IN_CUBIC",
    "easingFunction": [
      0.41999998688697815,
      0,
      1,
      1
    ]
  },
  {
    "nodeId": "268:23285",
    "interactionId": "188:16753",
    "event": "ON_HOVER",
    "navigation": "NAVIGATE",
    "targetNodeId": "188:16287",
    "transition": "SMART_ANIMATE",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "268:23312",
    "interactionId": "188:17009",
    "event": "ON_PRESS",
    "navigation": "NAVIGATE",
    "targetNodeId": "188:16759",
    "transition": "SMART_ANIMATE",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "268:23347",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "268:23426",
    "interactionId": "268:24337",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "168:6299",
    "transition": "SLIDE_FROM_BOTTOM",
    "durationMs": 300.00001192092896,
    "prototypeDelayMs": 0,
    "easingType": "INOUT_CUBIC",
    "easingFunction": [
      0.41999998688697815,
      0,
      0.5799999833106995,
      1
    ]
  },
  {
    "nodeId": "268:23427",
    "interactionId": "825:5826",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "168:6299",
    "transition": "SLIDE_FROM_BOTTOM",
    "durationMs": 300.00001192092896,
    "prototypeDelayMs": 0,
    "easingType": "INOUT_CUBIC",
    "easingFunction": [
      0.41999998688697815,
      0,
      0.5799999833106995,
      1
    ]
  },
  {
    "nodeId": "268:23433",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "268:23481",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "268:23523",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "268:23618",
    "interactionId": "180:14868",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "164:6118",
    "transition": "SMART_ANIMATE",
    "durationMs": 600.0000238418579,
    "prototypeDelayMs": 0,
    "easingType": "IN_CUBIC",
    "easingFunction": [
      0.41999998688697815,
      0,
      1,
      1
    ]
  },
  {
    "nodeId": "268:23619",
    "interactionId": "188:16753",
    "event": "ON_HOVER",
    "navigation": "NAVIGATE",
    "targetNodeId": "188:16287",
    "transition": "SMART_ANIMATE",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "268:23646",
    "interactionId": "188:17009",
    "event": "ON_PRESS",
    "navigation": "NAVIGATE",
    "targetNodeId": "188:16759",
    "transition": "SMART_ANIMATE",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "268:23681",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "268:23767",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "268:23789",
    "interactionId": "825:6803",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "168:6358",
    "transition": "SLIDE_FROM_BOTTOM",
    "durationMs": 300.00001192092896,
    "prototypeDelayMs": 0,
    "easingType": "INOUT_CUBIC",
    "easingFunction": [
      0.41999998688697815,
      0,
      0.5799999833106995,
      1
    ]
  },
  {
    "nodeId": "268:23815",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "268:23857",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "268:23952",
    "interactionId": "180:14868",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "164:6118",
    "transition": "SMART_ANIMATE",
    "durationMs": 600.0000238418579,
    "prototypeDelayMs": 0,
    "easingType": "IN_CUBIC",
    "easingFunction": [
      0.41999998688697815,
      0,
      1,
      1
    ]
  },
  {
    "nodeId": "268:23953",
    "interactionId": "188:16753",
    "event": "ON_HOVER",
    "navigation": "NAVIGATE",
    "targetNodeId": "188:16287",
    "transition": "SMART_ANIMATE",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "268:23980",
    "interactionId": "188:17009",
    "event": "ON_PRESS",
    "navigation": "NAVIGATE",
    "targetNodeId": "188:16759",
    "transition": "SMART_ANIMATE",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "268:24015",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "268:24101",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "268:24149",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "268:24191",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "270:26353",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "270:26439",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "270:26487",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "270:26529",
    "interactionId": "248:20540",
    "event": "ON_HOVER",
    "navigation": "SWAP_STATE",
    "targetNodeId": "248:20537",
    "transition": "SMART_ANIMATE",
    "durationMs": 1287.339210510254,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      145,
      11.399999618530273,
      0
    ]
  },
  {
    "nodeId": "270:26760",
    "interactionId": "228:19806",
    "event": "ON_CLICK",
    "navigation": "SWAP_STATE",
    "targetNodeId": "228:19793",
    "transition": "SMART_ANIMATE",
    "durationMs": 63.307903707027435,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      29030,
      240,
      0
    ]
  },
  {
    "nodeId": "280:26959",
    "interactionId": "382:202",
    "event": "ON_CLICK",
    "navigation": "SCROLL_TO",
    "targetNodeId": null,
    "transition": null,
    "durationMs": 0,
    "prototypeDelayMs": 0,
    "easingType": null,
    "easingFunction": []
  },
  {
    "nodeId": "280:26962",
    "interactionId": "386:137",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "380:147",
    "transition": "SMART_ANIMATE",
    "durationMs": 1277.6172161102295,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      64,
      12,
      0
    ]
  },
  {
    "nodeId": "380:190",
    "interactionId": "382:201",
    "event": "ON_CLICK",
    "navigation": "SCROLL_TO",
    "targetNodeId": null,
    "transition": null,
    "durationMs": 0,
    "prototypeDelayMs": 0,
    "easingType": null,
    "easingFunction": []
  },
  {
    "nodeId": "380:196",
    "interactionId": "386:138",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "168:6299",
    "transition": "SMART_ANIMATE",
    "durationMs": 1277.6172161102295,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      64,
      12,
      0
    ]
  },
  {
    "nodeId": "825:5828",
    "interactionId": "825:5844",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "266:21147",
    "transition": "SLIDE_FROM_TOP",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "825:5849",
    "interactionId": "825:5867",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "266:21147",
    "transition": "SLIDE_FROM_TOP",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "825:5869",
    "interactionId": "825:5885",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "266:21147",
    "transition": "SLIDE_FROM_TOP",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "825:5887",
    "interactionId": "825:6693",
    "event": "DRAG",
    "navigation": "NAVIGATE",
    "targetNodeId": "825:6452",
    "transition": "SLIDE_FROM_RIGHT",
    "durationMs": 300.00001192092896,
    "prototypeDelayMs": 0,
    "easingType": "INOUT_CUBIC",
    "easingFunction": [
      0.41999998688697815,
      0,
      0.5799999833106995,
      1
    ]
  },
  {
    "nodeId": "825:6080",
    "interactionId": "825:6099",
    "event": "ON_HOVER",
    "navigation": "NAVIGATE",
    "targetNodeId": "188:16287",
    "transition": "SMART_ANIMATE",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "825:6100",
    "interactionId": "825:6119",
    "event": "ON_HOVER",
    "navigation": "NAVIGATE",
    "targetNodeId": "188:16287",
    "transition": "SMART_ANIMATE",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "825:6133",
    "interactionId": "825:6152",
    "event": "ON_HOVER",
    "navigation": "NAVIGATE",
    "targetNodeId": "188:16287",
    "transition": "SMART_ANIMATE",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "825:6153",
    "interactionId": "825:6170",
    "event": "ON_HOVER",
    "navigation": "NAVIGATE",
    "targetNodeId": "188:16287",
    "transition": "SMART_ANIMATE",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "825:6434",
    "interactionId": "825:6451",
    "event": "ON_HOVER",
    "navigation": "NAVIGATE",
    "targetNodeId": "188:16287",
    "transition": "SMART_ANIMATE",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "825:6488",
    "interactionId": "825:6694",
    "event": "DRAG",
    "navigation": "NAVIGATE",
    "targetNodeId": "168:6358",
    "transition": "SLIDE_FROM_RIGHT",
    "durationMs": 300.00001192092896,
    "prototypeDelayMs": 0,
    "easingType": "INOUT_CUBIC",
    "easingFunction": [
      0.41999998688697815,
      0,
      0.5799999833106995,
      1
    ]
  },
  {
    "nodeId": "825:6491",
    "interactionId": "825:6099",
    "event": "ON_HOVER",
    "navigation": "NAVIGATE",
    "targetNodeId": "188:16287",
    "transition": "SMART_ANIMATE",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "825:6532",
    "interactionId": "825:6119",
    "event": "ON_HOVER",
    "navigation": "NAVIGATE",
    "targetNodeId": "188:16287",
    "transition": "SMART_ANIMATE",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "825:6588",
    "interactionId": "825:6170",
    "event": "ON_HOVER",
    "navigation": "NAVIGATE",
    "targetNodeId": "188:16287",
    "transition": "SMART_ANIMATE",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "825:6606",
    "interactionId": "825:6152",
    "event": "ON_HOVER",
    "navigation": "NAVIGATE",
    "targetNodeId": "188:16287",
    "transition": "SMART_ANIMATE",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "825:6640",
    "interactionId": "825:6451",
    "event": "ON_HOVER",
    "navigation": "NAVIGATE",
    "targetNodeId": "188:16287",
    "transition": "SMART_ANIMATE",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "825:6672",
    "interactionId": "825:5885",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "266:21147",
    "transition": "SLIDE_FROM_TOP",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "825:6884",
    "interactionId": "228:19806",
    "event": "ON_CLICK",
    "navigation": "SWAP_STATE",
    "targetNodeId": "228:19793",
    "transition": "SMART_ANIMATE",
    "durationMs": 63.307903707027435,
    "prototypeDelayMs": 0,
    "easingType": "CUSTOM_SPRING",
    "easingFunction": [
      1,
      29030,
      240,
      0
    ]
  },
  {
    "nodeId": "825:6984",
    "interactionId": "825:6784",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "270:25363",
    "transition": "SLIDE_FROM_LEFT",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "845:3503",
    "interactionId": "392:4025",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "266:21147",
    "transition": "SLIDE_FROM_TOP",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "845:3539",
    "interactionId": "852:4336",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "846:3544",
    "transition": "SMART_ANIMATE",
    "durationMs": 1250.1229047775269,
    "prototypeDelayMs": 0,
    "easingType": "SPRING_PRESET_THREE",
    "easingFunction": [
      1,
      80,
      20,
      0
    ]
  },
  {
    "nodeId": "846:3544",
    "interactionId": "852:4337",
    "event": "AFTER_TIMEOUT",
    "navigation": "NAVIGATE",
    "targetNodeId": "849:3608",
    "transition": "SMART_ANIMATE",
    "durationMs": 1250.1229047775269,
    "prototypeDelayMs": 300.00001192092896,
    "easingType": "SPRING_PRESET_THREE",
    "easingFunction": [
      1,
      80,
      20,
      0
    ]
  },
  {
    "nodeId": "846:3568",
    "interactionId": "392:4025",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "266:21147",
    "transition": "SLIDE_FROM_TOP",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "849:3608",
    "interactionId": "852:4338",
    "event": "AFTER_TIMEOUT",
    "navigation": "NAVIGATE",
    "targetNodeId": "849:3705",
    "transition": "SMART_ANIMATE",
    "durationMs": 1250.1229047775269,
    "prototypeDelayMs": 300.00001192092896,
    "easingType": "SPRING_PRESET_THREE",
    "easingFunction": [
      1,
      80,
      20,
      0
    ]
  },
  {
    "nodeId": "849:3632",
    "interactionId": "392:4025",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "266:21147",
    "transition": "SLIDE_FROM_TOP",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "849:3705",
    "interactionId": "852:4339",
    "event": "AFTER_TIMEOUT",
    "navigation": "NAVIGATE",
    "targetNodeId": "849:3794",
    "transition": "SMART_ANIMATE",
    "durationMs": 1250.1229047775269,
    "prototypeDelayMs": 300.00001192092896,
    "easingType": "SPRING_PRESET_THREE",
    "easingFunction": [
      1,
      80,
      20,
      0
    ]
  },
  {
    "nodeId": "849:3729",
    "interactionId": "392:4025",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "266:21147",
    "transition": "SLIDE_FROM_TOP",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "849:3794",
    "interactionId": "852:4340",
    "event": "AFTER_TIMEOUT",
    "navigation": "NAVIGATE",
    "targetNodeId": "849:3883",
    "transition": "SMART_ANIMATE",
    "durationMs": 1250.1229047775269,
    "prototypeDelayMs": 300.00001192092896,
    "easingType": "SPRING_PRESET_THREE",
    "easingFunction": [
      1,
      80,
      20,
      0
    ]
  },
  {
    "nodeId": "849:3818",
    "interactionId": "392:4025",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "266:21147",
    "transition": "SLIDE_FROM_TOP",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "849:3883",
    "interactionId": "852:4341",
    "event": "AFTER_TIMEOUT",
    "navigation": "NAVIGATE",
    "targetNodeId": "849:3972",
    "transition": "SMART_ANIMATE",
    "durationMs": 1250.1229047775269,
    "prototypeDelayMs": 300.00001192092896,
    "easingType": "SPRING_PRESET_THREE",
    "easingFunction": [
      1,
      80,
      20,
      0
    ]
  },
  {
    "nodeId": "849:3907",
    "interactionId": "392:4025",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "266:21147",
    "transition": "SLIDE_FROM_TOP",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "849:3972",
    "interactionId": "852:4342",
    "event": "AFTER_TIMEOUT",
    "navigation": "NAVIGATE",
    "targetNodeId": "852:4061",
    "transition": "SMART_ANIMATE",
    "durationMs": 1250.1229047775269,
    "prototypeDelayMs": 300.00001192092896,
    "easingType": "SPRING_PRESET_THREE",
    "easingFunction": [
      1,
      80,
      20,
      0
    ]
  },
  {
    "nodeId": "849:3996",
    "interactionId": "392:4025",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "266:21147",
    "transition": "SLIDE_FROM_TOP",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "852:4061",
    "interactionId": "852:4343",
    "event": "AFTER_TIMEOUT",
    "navigation": "NAVIGATE",
    "targetNodeId": "852:4150",
    "transition": "SLIDE_FROM_BOTTOM",
    "durationMs": 800.000011920929,
    "prototypeDelayMs": 300.00001192092896,
    "easingType": "INOUT_CUBIC",
    "easingFunction": [
      0.41999998688697815,
      0,
      0.5799999833106995,
      1
    ]
  },
  {
    "nodeId": "852:4085",
    "interactionId": "392:4025",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "266:21147",
    "transition": "SLIDE_FROM_TOP",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "852:4150",
    "interactionId": "852:4364",
    "event": "AFTER_TIMEOUT",
    "navigation": "NAVIGATE",
    "targetNodeId": "852:4391",
    "transition": "SLIDE_FROM_BOTTOM",
    "durationMs": 800.000011920929,
    "prototypeDelayMs": 1000,
    "easingType": "INOUT_CUBIC",
    "easingFunction": [
      0.41999998688697815,
      0,
      0.5799999833106995,
      1
    ]
  },
  {
    "nodeId": "852:4174",
    "interactionId": "392:4025",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "266:21147",
    "transition": "SLIDE_FROM_TOP",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  },
  {
    "nodeId": "852:4415",
    "interactionId": "392:4025",
    "event": "ON_CLICK",
    "navigation": "NAVIGATE",
    "targetNodeId": "266:21147",
    "transition": "SLIDE_FROM_TOP",
    "durationMs": 1022.0937728881836,
    "prototypeDelayMs": 0,
    "easingType": "GENTLE_SPRING",
    "easingFunction": [
      1,
      100,
      15,
      0
    ]
  }
] as const satisfies readonly SourceMotion[];

export function getSourceMotion(
  nodeId: string,
  event: SourceMotion['event'],
  targetNodeId?: string,
): SourceMotion | null {
  return sourceMotions.find(
    (motion) =>
      motion.nodeId === nodeId &&
      motion.event === event &&
      (targetNodeId === undefined || motion.targetNodeId === targetNodeId),
  ) ?? null;
}
