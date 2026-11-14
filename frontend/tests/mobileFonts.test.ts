import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';

const { useFontsMock } = vi.hoisted(() => ({
  useFontsMock: vi.fn(() => [true]),
}));
const nodeRequire = createRequire(path.resolve('tests/mobileFonts.test.ts'));
const previousTtfLoader = nodeRequire.extensions['.ttf'];

vi.mock('expo-font', () => ({ useFonts: useFontsMock }));
vi.mock('expo-router', () => {
  const Stack = Object.assign(() => null, { Screen: () => null });
  return {
    Stack,
    usePathname: () => '/login',
    useRouter: () => ({ replace: vi.fn() }),
  };
});
vi.mock('react', async () => ({
  ...await vi.importActual<typeof import('react')>('react'),
  useEffect: () => undefined,
  useState: <T,>(initial: T) => [initial, vi.fn()],
}));
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  LogBox: { ignoreLogs: vi.fn() },
  Platform: {
    OS: 'web',
    select: (options: Record<string, string>) => options.web ?? options.default,
  },
  View: 'View',
}));
vi.mock('../services/api', () => ({
  authAPI: {
    getToken: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}));

afterEach(() => {
  useFontsMock.mockClear();
  vi.resetModules();
  if (previousTtfLoader) {
    nodeRequire.extensions['.ttf'] = previousTtfLoader;
  } else {
    delete nodeRequire.extensions['.ttf'];
  }
});

test('root layout consumes the single tracked mobile font asset map', async () => {
  nodeRequire.extensions['.ttf'] = (module, filename) => {
    module.exports = `../assets/fonts/${path.basename(filename)}`;
  };

  const { mobileFontAssets } = await import('../theme/fonts');
  const { default: RootLayout } = await import('../app/_layout');
  const expectedAssets = {
    ZiTiQuanWeiJunHei: '../assets/fonts/ZiTiQuanWeiJunHei-W3.ttf',
    AlibabaPuHuiTiThin: '../assets/fonts/AlibabaPuHuiTi-3-35-Thin.ttf',
    AlibabaPuHuiTiLight: '../assets/fonts/AlibabaPuHuiTi-3-45-Light.ttf',
    AlibabaPuHuiTiRegular: '../assets/fonts/AlibabaPuHuiTi-3-55-Regular.ttf',
    AlibabaPuHuiTiRegularL3:
      '../assets/fonts/AlibabaPuHuiTi-3-55-RegularL3.ttf',
    AlibabaPuHuiTiSemiBold: '../assets/fonts/AlibabaPuHuiTi-3-75-SemiBold.ttf',
    AlibabaPuHuiTiBold: '../assets/fonts/AlibabaPuHuiTi-3-85-Bold.ttf',
  };

  expect(mobileFontAssets).toEqual(expectedAssets);
  for (const assetPath of Object.values(expectedAssets)) {
    const repoPath = `frontend/${assetPath.replace('../', '')}`;
    expect(() =>
      execFileSync('git', ['ls-files', '--error-unmatch', repoPath], {
        cwd: path.resolve('..'),
        stdio: 'pipe',
      }),
    ).not.toThrow();
  }

  RootLayout();
  expect(useFontsMock).toHaveBeenCalledTimes(1);
  expect(useFontsMock).toHaveBeenCalledWith(mobileFontAssets);
});
