'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AuthForm({register=false}:{register?:boolean}) {
  const router=useRouter();const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('');
    const data=new FormData(event.currentTarget);const username=data.get('username'),password=data.get('password');
    try {
      if(register){const result=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password,email:data.get('email')})});if(!result.ok)throw new Error((await result.json()).error?.message??'注册失败');}
      const result=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
      if(!result.ok)throw new Error((await result.json()).error?.message??'登录失败');
      const next=new URLSearchParams(window.location.search).get('next');router.push(next?.startsWith('/')&&!next.startsWith('//')?next:'/apps');router.refresh();
    }catch(exc){setError(exc instanceof Error?exc.message:'暂时无法登录');}finally{setBusy(false);}
  }
  return <><h1>{register?'创建账号':'登录'}</h1><section><form onSubmit={submit}><label>用户名<input name="username" autoComplete="username" required/></label>{register&&<label>邮箱<input name="email" type="email" autoComplete="email" required/></label>}<label>密码<input name="password" type="password" autoComplete={register?'new-password':'current-password'} required/></label>{error&&<p role="alert" className="error">{error}</p>}<button disabled={busy}>{busy?'正在处理':register?'注册并登录':'登录'}</button></form><p>{register?<Link href="/login">已有账号，去登录</Link>:<Link href="/register">还没有账号，创建一个</Link>}</p></section></>;
}
