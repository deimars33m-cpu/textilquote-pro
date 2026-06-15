import { Outlet } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background w-full">
      <Header />
      <div className="flex flex-1 w-full">
        <Sidebar />
        <div className="flex-1 flex justify-center w-full md:pl-[220px]">
          <main className="flex-1 w-full pt-20 pb-24 md:pb-8 px-4 md:px-10 max-w-[1400px]">
            <Outlet />
          </main>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
