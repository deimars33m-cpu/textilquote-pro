import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
const lines = env.split('\n')
const config = {}
for (const line of lines) {
  const parts = line.split('=')
  if (parts.length === 2) {
    config[parts[0].trim()] = parts[1].trim()
  }
}

const supabaseUrl = config['VITE_SUPABASE_URL']
const supabaseAnonKey = config['VITE_SUPABASE_ANON_KEY']

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  const { data: templates, error: tErr } = await supabase
    .from('product_templates')
    .select('*')
  console.log('Templates count:', templates ? templates.length : 0, tErr)
  if (templates) {
    console.log('Sample templates:', templates.slice(0, 3))
  }

  const { data: materials, error: mErr } = await supabase
    .from('product_template_materials')
    .select('*')
  console.log('Materials count:', materials ? materials.length : 0, mErr)
  if (materials) {
    console.log('Sample materials:', materials.slice(0, 3))
  }

  const { data: processes, error: pErr } = await supabase
    .from('product_template_processes')
    .select('*')
  console.log('Processes count:', processes ? processes.length : 0, pErr)
}

test()
