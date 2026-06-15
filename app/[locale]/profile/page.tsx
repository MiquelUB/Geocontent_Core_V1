"use client";

import { ProfileScreen } from "@/components/screens/ProfileScreen";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUserProfile } from "@/lib/actions/auth";

export default function ProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUserString = localStorage.getItem("core_user");
    if (savedUserString) {
      try {
        const savedUser = JSON.parse(savedUserString);
        if (savedUser?.id) {
          getUserProfile(savedUser.id).then((profile) => {
            if (profile) {
              setCurrentUser(profile);
            }
            setIsLoading(false);
          }).catch(() => {
            setIsLoading(false);
          });
        } else {
          setIsLoading(false);
        }
      } catch {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleNavigate = (screen: string) => {
    if (screen === 'home') router.push('/');
    else if (screen === 'legends') router.push('/?screen=legends');
    else if (screen === 'map') router.push('/?screen=map');
  };

  const handleUserUpdate = (updatedUser: any) => {
    setCurrentUser(updatedUser);
    localStorage.setItem("core_user", JSON.stringify(updatedUser));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9F7F2] dark:bg-[#1a211e] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    if (typeof window !== 'undefined') {
      router.push('/');
    }
    return null;
  }

  return (
    <ProfileScreen
      onNavigate={handleNavigate}
      currentUser={currentUser}
      onUserUpdate={handleUserUpdate}
    />
  );
}
