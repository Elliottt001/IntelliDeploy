import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import * as ts from 'typescript';
import { describe, expect, test, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: {
    select: (options: Record<string, string>) => options.default,
  },
}));

import { mobileEvidence } from '../design/mobileEvidence';
import { approvedRootIds } from '../scripts/extract-mobile-design-evidence.mjs';
import { mobileColors, mobileRadii } from '../theme/tokens';
import { getMobileLayout } from '../theme/responsive';
import {
  mobileFontFamilies,
  mobileTypography,
} from '../theme/typography';

type ManifestEntry = {
  key: string;
  nodeId: string;
  requirePath: string;
};

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isAsExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function propertyNameText(name: ts.PropertyName): string | undefined {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }
  return undefined;
}

function readStringProperty(object: ts.ObjectLiteralExpression, name: string) {
  const property = object.properties.find(
    (candidate): candidate is ts.PropertyAssignment =>
      ts.isPropertyAssignment(candidate) &&
      propertyNameText(candidate.name) === name,
  );
  const value = property && unwrapExpression(property.initializer);
  if (!value || !ts.isStringLiteral(value)) {
    throw new Error(`Manifest property ${name} must be a string literal`);
  }
  return value.text;
}

function parseMobileAssetManifest(sourceText: string): ManifestEntry[] {
  const sourceFile = ts.createSourceFile(
    'mobileAssetManifest.ts',
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let mobileAssets: ts.ObjectLiteralExpression | undefined;

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === 'mobileAssets' &&
        declaration.initializer
      ) {
        const initializer = unwrapExpression(declaration.initializer);
        if (ts.isObjectLiteralExpression(initializer)) {
          mobileAssets = initializer;
        }
      }
    }
  }
  if (!mobileAssets) {
    throw new Error('mobileAssets object was not found');
  }

  return mobileAssets.properties.map((property) => {
    if (!ts.isPropertyAssignment(property)) {
      throw new Error('mobileAssets entries must be property assignments');
    }
    const key = propertyNameText(property.name);
    const value = unwrapExpression(property.initializer);
    if (!key || !ts.isObjectLiteralExpression(value)) {
      throw new Error('mobileAssets entry must use a literal key and object');
    }
    const sourceProperty = value.properties.find(
      (candidate): candidate is ts.PropertyAssignment =>
        ts.isPropertyAssignment(candidate) &&
        propertyNameText(candidate.name) === 'source',
    );
    const sourceCall =
      sourceProperty && unwrapExpression(sourceProperty.initializer);
    if (
      !sourceCall ||
      !ts.isCallExpression(sourceCall) ||
      !ts.isIdentifier(sourceCall.expression) ||
      sourceCall.expression.text !== 'require' ||
      sourceCall.arguments.length !== 1 ||
      !ts.isStringLiteral(sourceCall.arguments[0])
    ) {
      throw new Error(`mobileAssets entry ${key} must use require("path")`);
    }

    return {
      key,
      nodeId: readStringProperty(value, 'nodeId'),
      requirePath: sourceCall.arguments[0].text,
    };
  });
}

describe('mobile design evidence', () => {
  test('pins every formal family to approved pages and real frame ids', () => {
    expect(mobileEvidence).toEqual({
      login: {
        pages: ['page-01'],
        frameIds: ['119:76618'],
        size: [375, 812],
      },
      home: {
        pages: [
          'page-02',
          'page-29',
          'page-30',
          'page-31',
          'page-32',
          'page-33',
          'page-34',
          'page-35',
        ],
        frameIds: [
          '270:26263',
          '188:16287',
          '188:16759',
          '266:21147',
          '268:22904',
          '268:23238',
          '268:23572',
          '268:23906',
        ],
        size: [375, 812],
      },
      store: {
        pages: ['page-03', 'page-40'],
        frameIds: ['270:26597', '825:6804'],
        size: [375, 812],
      },
      chatbot: {
        pages: [
          'page-46',
          'page-47',
          'page-48',
          'page-49',
          'page-50',
          'page-51',
          'page-52',
          'page-53',
          'page-54',
          'page-55',
          'page-58',
        ],
        frameIds: [
          '845:3479',
          '846:3544',
          '849:3608',
          '849:3705',
          '849:3794',
          '849:3883',
          '849:3972',
          '852:4061',
          '852:4150',
          '852:4242',
          '852:4391',
        ],
        size: [375, 812],
      },
      products: {
        pages: ['page-56', 'page-57'],
        frameIds: ['168:6299', '380:147'],
        size: [375, 812],
      },
      community: {
        pages: ['page-59', 'page-60'],
        frameIds: ['168:6358', '825:6452'],
        size: [375, 812],
      },
    });

    for (const evidence of Object.values(mobileEvidence)) {
      expect(evidence.frameIds).toHaveLength(evidence.pages.length);
      expect(evidence.frameIds.every((id) => /^\d+:\d+$/.test(id))).toBe(true);
      expect(evidence.size).toEqual([375, 812]);
    }
    expect(approvedRootIds).toEqual(
      Object.values(mobileEvidence).flatMap((evidence) => evidence.frameIds),
    );
  });

  test('uses canonical tokens and responsive gutters without canvas scaling', () => {
    expect(mobileColors.primary).toBe('#7C62FF');
    expect(mobileColors.text).toBe('#494A64');
    expect(mobileRadii.card).toEqual({ min: 20, max: 30 });
    expect(getMobileLayout(320, { left: 0, right: 0 })).toMatchObject({
      gutter: 16,
      contentWidth: 288,
      scale: 1,
    });
    expect(getMobileLayout(430, { left: 0, right: 0 })).toMatchObject({
      gutter: 24,
      contentWidth: 382,
      scale: 1,
    });
  });

  test('defines the approved typography aliases and metrics', () => {
    expect(mobileFontFamilies).toMatchObject({
      display: 'ZiTiQuanWeiJunHei',
      body: 'AlibabaPuHuiTiRegular',
      emphasis: 'AlibabaPuHuiTiSemiBold',
    });
    expect(mobileFontFamilies.pingFang).toBeTruthy();
    expect(mobileFontFamilies.inter).toBeTruthy();
    expect(mobileTypography).toEqual({
      display: {
        fontFamily: 'ZiTiQuanWeiJunHei',
        fontSize: 32,
        lineHeight: 40,
      },
      title: {
        fontFamily: 'AlibabaPuHuiTiSemiBold',
        fontSize: 22,
        lineHeight: 30,
      },
      body: {
        fontFamily: 'AlibabaPuHuiTiRegular',
        fontSize: 16,
        lineHeight: 24,
      },
      caption: {
        fontFamily: 'AlibabaPuHuiTiRegular',
        fontSize: 13,
        lineHeight: 19,
      },
    });
  });

  test('maps all manifest entries one-to-one onto generated local files', async () => {
    const manifestPath = path.resolve(
      'design/generated/mobileAssetManifest.ts',
    );
    const generatedDirectory = path.resolve('assets/mobile/generated');
    const entries = parseMobileAssetManifest(
      await readFile(manifestPath, 'utf8'),
    );

    expect(entries).toHaveLength(178);
    expect(new Set(entries.map((entry) => entry.key)).size).toBe(178);
    expect(new Set(entries.map((entry) => entry.nodeId)).size).toBe(178);

    const requiredFiles: string[] = [];
    for (const [index, entry] of entries.entries()) {
      expect(entry.nodeId).toMatch(/^\d+:\d+$/);
      expect(entry.key).toBe(`${entry.nodeId}:${index}`);
      expect(entry.requirePath).toMatch(
        /^\.\.\/\.\.\/assets\/mobile\/generated\/[^/]+\.(png|jpg)$/,
      );
      const requiredFile = path.resolve(
        path.dirname(manifestPath),
        entry.requirePath,
      );
      expect((await stat(requiredFile)).isFile()).toBe(true);
      requiredFiles.push(path.basename(requiredFile));
    }

    expect(requiredFiles.sort()).toEqual(
      (await readdir(generatedDirectory)).sort(),
    );
  });
});
