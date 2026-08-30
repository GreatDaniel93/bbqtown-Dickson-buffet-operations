import { sites } from "@openai/sites-vite-plugin";
import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
export default defineConfig(async()=>{const {cloudflare}=await import("@cloudflare/vite-plugin");return{plugins:[vinext(),sites(),cloudflare({viteEnvironment:{name:"rsc",childEnvironments:["ssr"]},config:{main:"./worker/index.ts",compatibility_flags:["nodejs_compat"],d1_databases:hostingConfig.d1?[{binding:hostingConfig.d1,database_name:"bbqtown-ops",database_id:"00000000-0000-4000-8000-000000000000"}]:[]}})]}});
