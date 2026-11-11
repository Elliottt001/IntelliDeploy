export const marketingCopy = {
  hero: {
    eyebrow: 'INTELLIDEPLOY / AI APP STUDIO',
    title: '让想法成为真正可用的应用',
    description: '描述你的需求，IntelliDeploy 会整理验收目标、选择实现路径、验证功能，并交付可以继续调整的应用。',
    primaryLabel: '开始创建', primaryHref: '/create',
    secondaryLabel: '浏览应用社区', secondaryHref: '/community',
  },
  capabilities: [
    ['自然语言需求', '从业务目标开始，而不是先填写云资源参数。'],
    ['持续对话调整', '在同一个应用和版本链路中继续修改。'],
    ['按验收项验证', '用实际业务操作和证据判断是否完成。'],
    ['独立运行交付', '应用、版本、实例和公开页面边界清晰。'],
  ],
  mibo: {
    label: 'MIBO / 01', title: '把需求说清楚，再开始实现',
    description: 'Mibo 会围绕用途、数据、权限和外部能力提出必要问题，并把确认结果保存为可验证的需求。',
    href: '/create', action: '和 Mibo 开始创建',
  },
  community: {
    label: 'COMMUNITY / 02', title: '使用真实公开应用，也可以创建独立副本',
    description: '公开应用展示经过发布的版本和可用入口。创建副本会获得独立应用、实例和数据空间，不复制作者的私有数据。',
    href: '/community', action: '进入应用社区',
  },
} as const;
