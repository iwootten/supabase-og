import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import handler from './handler.tsx'

console.log('Hello from og-image Function!')

serve(handler, { port: 9010})