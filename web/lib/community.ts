import { createApiClient } from '@intellideploy/api-client';
export const publicApi = createApiClient({baseUrl:process.env.API_BASE_URL??'http://127.0.0.1:9000',fetchImpl:(input,init)=>fetch(input,{...init,cache:'no-store'})});
