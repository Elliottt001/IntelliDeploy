import CreateAppForm from '@/components/CreateAppForm';

export const metadata = { title: '创建应用 · IntelliDeploy', description: '描述需求并创建可以持续调整的应用' };

export default function CreatePage() {
  return <CreateAppForm />;
}
