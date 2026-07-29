import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kwrtxbnaiuooeyixgkuh.supabase.co'
const supabaseKey = 'sb_publishable_le5DFZxNnavl5FJsIqZb_Q_WJacr-cf'
const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data: expenses } = await supabase.from('expenses').select('*')
  console.log("Total expenses in DB:", expenses?.length)
  
  if (!expenses) return

  const subExp = expenses.filter(e => e.subcategory === 'Sublimación')
  console.log("Sublimación expenses count:", subExp.length)
  subExp.forEach(e => {
    console.log(`ID: ${e.id} | Date: ${e.date} | CatKey: ${e.category_key || e.categoryKey} | Sub: ${e.subcategory} | Item: ${e.specific_item || e.specificItem} | Amt: ${e.amount}`)
  })
}

check()
