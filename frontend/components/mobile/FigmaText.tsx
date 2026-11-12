import { Platform } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
type Color = { r: number; g: number; b: number; a?: number };
type Matrix = {
  m00: number;
  m01: number;
  m02: number;
  m10: number;
  m11: number;
  m12: number;
};
type Glyph = {
  path: string;
  position: { x: number; y: number };
  fontSize: number;
  fill: string;
  opacity: number;
  paint?: {
    type: string;
    transform?: Matrix;
    stops?: readonly { position: number; color: Color }[];
  };
};
export type FigmaTextEvidence = {
  sourceNodeId: string;
  characters: string;
  size: { x: number; y: number };
  glyphs: readonly Glyph[];
};
const hex = (c: Color) =>
  "#" +
  [c.r, c.g, c.b]
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
export function FigmaText({
  evidence,
  testID,
  color,
}: {
  evidence: FigmaTextEvidence;
  testID?: string;
  color?: string;
}) {
  const prefix = `text-${evidence.sourceNodeId.replace(":", "-")}`;
  return (
    <Svg
      accessibilityLabel={evidence.characters}
      {...(Platform.OS === "web"
        ? { role: "img" }
        : { accessibilityRole: "image" as const })}
      testID={testID}
      width={evidence.size.x}
      height={evidence.size.y}
      viewBox={`0 0 ${evidence.size.x} ${evidence.size.y}`}
    >
      <Defs>
        {evidence.glyphs.map((glyph, index) => {
          const p = glyph.paint,
            t = p?.transform;
          if (p?.type !== "GRADIENT_LINEAR" || !t) return null;
          const { m00: a, m10: b, m01: c, m11: d, m02: e, m12: f } = t,
            det = a * d - b * c;
          return (
            <LinearGradient
              key={index}
              id={`${prefix}-${index}`}
              x1="0"
              y1="0"
              x2="1"
              y2="0"
              gradientUnits="userSpaceOnUse"
              gradientTransform={`matrix(${(evidence.size.x * d) / det / glyph.fontSize} ${(evidence.size.y * b) / det / glyph.fontSize} ${(-evidence.size.x * c) / det / glyph.fontSize} ${(-evidence.size.y * a) / det / glyph.fontSize} ${((evidence.size.x * (c * f - d * e)) / det - glyph.position.x) / glyph.fontSize} ${(glyph.position.y - (evidence.size.y * (b * e - a * f)) / det) / glyph.fontSize})`}
            >
              {p.stops?.map((stop, i) => (
                <Stop
                  key={i}
                  offset={stop.position}
                  stopColor={hex(stop.color)}
                  stopOpacity={stop.color.a ?? 1}
                />
              ))}
            </LinearGradient>
          );
        })}
      </Defs>
      {evidence.glyphs.map((glyph, index) => (
        <Path
          key={index}
          d={glyph.path}
          fill={color ?? (
            glyph.paint?.type === "GRADIENT_LINEAR"
              ? `url(#${prefix}-${index})`
              : glyph.fill
          )}
          opacity={glyph.opacity}
          transform={`translate(${glyph.position.x} ${glyph.position.y}) scale(${glyph.fontSize} -${glyph.fontSize})`}
        />
      ))}
    </Svg>
  );
}
