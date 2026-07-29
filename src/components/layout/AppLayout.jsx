import { Outlet } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import NotificationRightSidebar from './NotificationRightSidebar'
import MobileNotificationModal from './MobileNotificationModal'
import { useNotifications } from '@/context/NotificationContext'

export default function AppLayout() {
  const { sidebarCollapsed } = useNotifications()

  return (
    <div className="min-h-screen flex flex-col bg-transparent w-full overflow-x-hidden">
      <Header />
      <div className="flex flex-1 w-full">
        <Sidebar />
        <div className={`flex-1 flex justify-center w-full md:pl-[220px] transition-all duration-300 ${
          sidebarCollapsed ? 'xl:pr-[60px]' : 'xl:pr-[280px]'
        }`}>
          <main className="flex-1 w-full pt-20 pb-24 md:pb-8 px-4 md:px-8 max-w-[1400px]">
            <Outlet />
          </main>
        </div>
        <NotificationRightSidebar />
      </div>
      <MobileNotificationModal />
      <BottomNav />
    </div>
  )
}
