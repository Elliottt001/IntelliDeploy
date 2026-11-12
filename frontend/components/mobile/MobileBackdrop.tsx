import {
  ClipPath,
  Defs,
  FeGaussianBlur,
  Filter,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import { mobileAtmosphereEvidence as source } from "../../design/mobileAtmosphereEvidence";
import type { FigmaVectorLayer } from "../../design/figmaComponentEvidence";
export function MobileBackdrop({
  width,
  height,
  variant = "default",
  prefix = "mobile",
}: {
  width: number;
  height: number;
  variant?: "default" | "chatbot" | "profile";
  prefix?: string;
}) {
  const origin =
    variant === "chatbot" ? source.chatbotAtmosphere : variant === "profile" ? source.profileAtmosphere : source.atmosphere;
  const {
      m00: a,
      m10: b,
      m01: c,
      m11: d,
      m02: e,
      m12: f,
    } = source.background.fillPaints[0].transform,
    det = a * d - b * c;
  const inverse = `matrix(${d / det} ${-b / det} ${-c / det} ${a / det} ${(c * f - d * e) / det} ${(b * e - a * f) / det})`;
  const blur = source.effects.find(
    (effect) => effect.rawType === "FOREGROUND_BLUR",
  )!;
  return (
    <>
      <Defs>
        <ClipPath id={`${prefix}-atmosphere-clip`}>
          <Rect width={origin.size.x} height={origin.size.y} />
        </ClipPath>
        <LinearGradient
          id={`${prefix}-background-gradient`}
          x1="0"
          y1="0"
          x2="1"
          y2="0"
          gradientTransform={inverse}
        >
          <Stop offset="0" stopColor="#EFF3FF" />
          <Stop offset="1" stopColor="#FFFFFF" />
        </LinearGradient>
        <Filter
          id={`${prefix}-atmosphere-blur`}
          x="-100%"
          y="-100%"
          width="300%"
          height="300%"
        >
          <FeGaussianBlur stdDeviation={blur.radius / 2} />
        </Filter>
      </Defs>
      <Rect
        width={width}
        height={height}
        fill={`url(#${prefix}-background-gradient)`}
      />
      <G
        transform={`translate(${origin.transform.m02 + (width - source.background.size.x) / 2} ${origin.transform.m12})`}
        clipPath={`url(#${prefix}-atmosphere-clip)`}
      >
        <G filter={`url(#${prefix}-atmosphere-blur)`}>
          {(source.geometry as readonly FigmaVectorLayer[]).map(
            (layer, index) => (
              <Path
                key={index}
                d={layer.path}
                fill={layer.fill}
                fillRule={layer.fillRule}
                opacity={layer.opacity}
                transform={layer.transform}
              />
            ),
          )}
        </G>
      </G>
    </>
  );
}
