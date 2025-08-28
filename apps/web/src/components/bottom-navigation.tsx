import { Home, List, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface BottomNavigationProps {
  currentTab: "home" | "activity" | "profile";
}

export default function BottomNavigation({ currentTab }: BottomNavigationProps) {
  const [, setLocation] = useLocation();

  const tabs = [
    { id: "home", label: "Home", icon: Home, path: "/" },
    { id: "activity", label: "Activity", icon: List, path: "/activity" },
    { id: "profile", label: "Profile", icon: User, path: "/profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-sm bg-white border-t border-gray-200 z-30" data-testid="bottom-navigation">
      <div className="flex items-center justify-around py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          
          return (
            <Button
              key={tab.id}
              variant="ghost"
              className="flex flex-col items-center py-2 px-4 h-auto"
              onClick={() => setLocation(tab.path)}
              data-testid={`tab-${tab.id}`}
            >
              <Icon className={`text-xl mb-1 h-6 w-6 ${isActive ? 'text-uber-black' : 'text-gray-400'}`} />
              <span className={`text-xs font-medium ${isActive ? 'text-uber-black' : 'text-gray-400'}`}>
                {tab.label}
              </span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}